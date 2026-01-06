"""
Journey Processor Worker - Background Automation Engine
========================================================

Cron job that processes scheduled automation executions.
Runs every minute to check for pending automations.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import asyncio
import structlog

from app.services.condition_evaluator import ConditionEvaluator
from app.services.tool_executor import ToolExecutor
from app.core.database import get_tenant_supabase

logger = structlog.get_logger()


class JourneyProcessor:
    """
    Background worker that processes automation executions.
    
    Flow:
    1. Fetch pending executions where scheduled_at <= NOW()
    2. For each execution:
       a. Load journey configuration
       b. Load deal/contact context
       c. Evaluate conditions
       d. Execute actions if conditions pass
       e. Update execution status
    """
    
    def __init__(self, tenant_id: str, supabase_url: str, supabase_key: str):
        self.tenant_id = tenant_id
        self.supabase = get_tenant_supabase(supabase_url, supabase_key)
        self.condition_evaluator = ConditionEvaluator()
        self.tool_executor = None  # Initialized with DealManager in process()
    
    async def process(self, batch_size: int = 50):
        """
        Process pending automation executions.
        Called by cron job every minute.
        """
        logger.info("Starting journey processor", tenant_id=self.tenant_id)
        
        # Get pending executions
        executions = await self._get_pending_executions(batch_size)
        
        if not executions:
            logger.debug("No pending executions")
            return
        
        logger.info("Processing executions", count=len(executions))
        
        # Process each execution
        for execution in executions:
            try:
                await self._process_single(execution)
            except Exception as e:
                logger.error(
                    "Execution failed",
                    execution_id=execution["id"],
                    error=str(e)
                )
                await self._mark_failed(execution["id"], str(e))
    
    async def _get_pending_executions(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch pending executions that are due"""
        now = datetime.now(timezone.utc).isoformat()
        
        result = self.supabase.table("automation_executions") \
            .select("*") \
            .eq("status", "pending") \
            .lte("scheduled_at", now) \
            .order("scheduled_at") \
            .limit(limit) \
            .execute()
        
        return result.data or []
    
    async def _process_single(self, execution: Dict[str, Any]):
        """Process a single automation execution"""
        execution_id = execution["id"]
        journey_id = execution["journey_id"]
        deal_id = execution.get("deal_id")
        contact_id = execution.get("contact_id")
        
        # Mark as running
        await self._update_status(execution_id, "running")
        
        # Load journey configuration
        journey = await self._get_journey(journey_id)
        if not journey:
            await self._mark_failed(execution_id, "Journey not found")
            return
        
        if not journey.get("is_active"):
            await self._update_status(execution_id, "cancelled", {"reason": "Journey disabled"})
            return
        
        # Load context
        context = await self._build_context(deal_id, contact_id)
        
        # Evaluate conditions
        conditions = journey.get("conditions", [])
        if conditions:
            passes = self.condition_evaluator.evaluate_all(conditions, context)
            if not passes:
                await self._update_status(execution_id, "cancelled", {"reason": "Conditions not met"})
                logger.info("Execution cancelled - conditions not met", execution_id=execution_id)
                return
        
        # Execute actions
        actions = journey.get("actions", [])
        if not actions:
            await self._update_status(execution_id, "completed", {"actions_executed": 0})
            return
        
        # Initialize tool executor with deal manager
        from app.services.deal_manager import DealManager
        deal_manager = DealManager(
            tenant_id=self.tenant_id,
            supabase_url=self.supabase._supabase_url,
            supabase_key=self.supabase._supabase_key
        )
        self.tool_executor = ToolExecutor(deal_manager=deal_manager)
        
        # Execute action sequence
        results = await self.tool_executor.execute_sequence(actions, context)
        
        # Check results
        all_success = all(r["result"].get("success") for r in results)
        
        if all_success:
            await self._update_status(execution_id, "completed", {
                "actions_executed": len(results),
                "results": results
            })
            
            # Update journey stats
            await self._increment_journey_count(journey_id)
        else:
            # Find first failure
            failures = [r for r in results if not r["result"].get("success")]
            error_msg = failures[0]["result"].get("error", "Unknown error") if failures else "Unknown"
            await self._mark_failed(execution_id, error_msg, results)
        
        logger.info(
            "Execution completed",
            execution_id=execution_id,
            success=all_success,
            actions_count=len(results)
        )
    
    async def _get_journey(self, journey_id: str) -> Optional[Dict[str, Any]]:
        """Load journey configuration"""
        result = self.supabase.table("automation_journeys") \
            .select("*") \
            .eq("id", journey_id) \
            .single() \
            .execute()
        return result.data
    
    async def _build_context(
        self, 
        deal_id: Optional[str], 
        contact_id: Optional[str]
    ) -> Dict[str, Any]:
        """Build execution context from deal and contact data"""
        context = {}
        
        if deal_id:
            deal_result = self.supabase.table("crm_deals") \
                .select("*") \
                .eq("id", deal_id) \
                .single() \
                .execute()
            if deal_result.data:
                deal = deal_result.data
                context.update({
                    "deal_id": deal["id"],
                    "deal_value": deal.get("value"),
                    "current_stage_id": deal.get("current_stage_id"),
                    "cycle_number": deal.get("cycle_number"),
                    "deal_status": deal.get("status"),
                    "contact_id": deal.get("contact_id"),
                    "contact_name": deal.get("contact_name"),
                    "contact_phone": deal.get("contact_phone"),
                    "tags": deal.get("tags", []),
                    "interested_services": deal.get("interested_services", []),
                    "deal_metadata": deal.get("metadata", {}),
                })
        
        if contact_id and not context.get("contact_name"):
            # Load contact if not from deal
            contact_result = self.supabase.table("contacts") \
                .select("*") \
                .eq("id", contact_id) \
                .single() \
                .execute()
            if contact_result.data:
                contact = contact_result.data
                context.update({
                    "contact_id": contact["id"],
                    "contact_name": contact.get("name"),
                    "contact_phone": contact.get("phone"),
                    "contact_email": contact.get("email"),
                    "contact_tags": contact.get("tags", []),
                })
        
        return context
    
    async def _update_status(
        self, 
        execution_id: str, 
        status: str, 
        result: Dict[str, Any] = None
    ):
        """Update execution status"""
        update_data = {"status": status}
        
        if status == "completed" or status == "failed":
            update_data["executed_at"] = datetime.now(timezone.utc).isoformat()
        
        if result:
            update_data["result"] = result
        
        self.supabase.table("automation_executions") \
            .update(update_data) \
            .eq("id", execution_id) \
            .execute()
    
    async def _mark_failed(
        self, 
        execution_id: str, 
        error: str, 
        partial_results: List = None
    ):
        """Mark execution as failed with error details"""
        update_data = {
            "status": "failed",
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": error,
            "result": {"partial_results": partial_results} if partial_results else {}
        }
        
        # Check retry count
        exec_result = self.supabase.table("automation_executions") \
            .select("retry_count") \
            .eq("id", execution_id) \
            .single() \
            .execute()
        
        if exec_result.data:
            retry_count = exec_result.data.get("retry_count", 0)
            update_data["retry_count"] = retry_count + 1
        
        self.supabase.table("automation_executions") \
            .update(update_data) \
            .eq("id", execution_id) \
            .execute()
    
    async def _increment_journey_count(self, journey_id: str):
        """Increment execution count on journey"""
        # Get current count
        result = self.supabase.table("automation_journeys") \
            .select("execution_count") \
            .eq("id", journey_id) \
            .single() \
            .execute()
        
        if result.data:
            current = result.data.get("execution_count", 0)
            self.supabase.table("automation_journeys") \
                .update({
                    "execution_count": current + 1,
                    "last_executed_at": datetime.now(timezone.utc).isoformat()
                }) \
                .eq("id", journey_id) \
                .execute()


async def run_journey_processor(tenant_id: str, supabase_url: str, supabase_key: str):
    """
    Entry point for cron job.
    Call this from a scheduler (e.g., APScheduler, Celery Beat, or external cron).
    """
    processor = JourneyProcessor(tenant_id, supabase_url, supabase_key)
    await processor.process()


# For running as standalone script
if __name__ == "__main__":
    import os
    
    tenant_id = os.getenv("TENANT_ID")
    supabase_url = os.getenv("CLIENT_SUPABASE_URL")
    supabase_key = os.getenv("CLIENT_SUPABASE_KEY")
    
    if tenant_id and supabase_url and supabase_key:
        asyncio.run(run_journey_processor(tenant_id, supabase_url, supabase_key))
    else:
        print("Missing required environment variables")
