"""
Deal Manager Service - Cycle Management for CRM
================================================

Handles the lifecycle of Deals (cycles) in the CRM:
- Create, move, close deals
- Track history and duration
- Trigger automations on stage change
- Reset cycles for returning contacts
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
import structlog

from app.core.database import get_tenant_supabase

logger = structlog.get_logger()


class DealManager:
    """Manages CRM deals (cycles) and their lifecycle"""
    
    def __init__(self, tenant_id: str, supabase_url: str, supabase_key: str):
        self.tenant_id = tenant_id
        self.supabase = get_tenant_supabase(supabase_url, supabase_key)
    
    async def get_deal(self, deal_id: str) -> Optional[Dict[str, Any]]:
        """Get a deal by ID with its history"""
        result = self.supabase.table("crm_deals").select("*").eq("id", deal_id).single().execute()
        return result.data if result.data else None
    
    async def get_deals_by_pipeline(
        self, 
        pipeline_id: str, 
        status: str = "open",
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get all deals for a pipeline, optionally filtered by status"""
        query = self.supabase.table("crm_deals").select("*").eq("pipeline_id", pipeline_id)
        if status:
            query = query.eq("status", status)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data or []
    
    async def get_deals_by_contact(self, contact_id: str) -> List[Dict[str, Any]]:
        """Get all deals (cycles) for a contact"""
        result = self.supabase.table("crm_deals").select("*").eq("contact_id", contact_id).order("cycle_number", desc=True).execute()
        return result.data or []
    
    async def create_deal(
        self,
        contact_id: str,
        pipeline_id: str,
        initial_stage_id: str,
        contact_name: Optional[str] = None,
        contact_phone: Optional[str] = None,
        value: float = 0,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Create a new deal (cycle) for a contact.
        Automatically calculates cycle_number based on previous deals.
        """
        # Get existing deals for this contact in this pipeline
        existing = await self.get_deals_by_contact(contact_id)
        pipeline_cycles = [d for d in existing if d.get("pipeline_id") == pipeline_id]
        cycle_number = len(pipeline_cycles) + 1
        
        # Create the deal
        deal_data = {
            "contact_id": contact_id,
            "contact_name": contact_name,
            "contact_phone": contact_phone,
            "pipeline_id": pipeline_id,
            "current_stage_id": initial_stage_id,
            "value": value,
            "cycle_number": cycle_number,
            "status": "open",
            "metadata": metadata or {},
        }
        
        result = self.supabase.table("crm_deals").insert(deal_data).execute()
        deal = result.data[0] if result.data else None
        
        if deal:
            # Log initial entry in history
            await self._log_history(
                deal_id=deal["id"],
                from_stage=None,
                to_stage=initial_stage_id,
                triggered_by="system",
                notes="Deal criado"
            )
            
            # Check for automation triggers
            await self._check_stage_automations(deal, None, initial_stage_id)
            
            logger.info("Deal created", deal_id=deal["id"], contact_id=contact_id, cycle=cycle_number)
        
        return deal
    
    async def move_deal(
        self,
        deal_id: str,
        target_stage_id: str,
        triggered_by: str = "user",
        triggered_by_id: Optional[str] = None,
        triggered_by_name: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Move a deal to a new stage.
        - Updates current_stage
        - Logs history with duration
        - Triggers automations if applicable
        """
        deal = await self.get_deal(deal_id)
        if not deal:
            logger.warning("Deal not found", deal_id=deal_id)
            return None
        
        from_stage = deal.get("current_stage_id")
        if from_stage == target_stage_id:
            logger.info("Deal already in target stage", deal_id=deal_id, stage=target_stage_id)
            return deal
        
        # Calculate duration in previous stage
        duration = await self._calculate_stage_duration(deal_id, from_stage)
        
        # Update the deal
        update_data = {
            "current_stage_id": target_stage_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = self.supabase.table("crm_deals").update(update_data).eq("id", deal_id).execute()
        updated_deal = result.data[0] if result.data else None
        
        if updated_deal:
            # Log history
            await self._log_history(
                deal_id=deal_id,
                from_stage=from_stage,
                to_stage=target_stage_id,
                duration_in_stage=duration,
                triggered_by=triggered_by,
                triggered_by_id=triggered_by_id,
                triggered_by_name=triggered_by_name,
                notes=notes
            )
            
            # Check for automation triggers
            await self._check_stage_automations(updated_deal, from_stage, target_stage_id)
            
            logger.info("Deal moved", deal_id=deal_id, from_stage=from_stage, to_stage=target_stage_id)
        
        return updated_deal
    
    async def close_deal(
        self,
        deal_id: str,
        status: str,  # "won" or "lost"
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Close a deal as won or lost.
        This marks the deal as closed and records the closing time.
        """
        if status not in ("won", "lost"):
            raise ValueError("Status must be 'won' or 'lost'")
        
        deal = await self.get_deal(deal_id)
        if not deal:
            return None
        
        # Calculate final stage duration
        duration = await self._calculate_stage_duration(deal_id, deal.get("current_stage_id"))
        
        # Update deal
        update_data = {
            "status": status,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = self.supabase.table("crm_deals").update(update_data).eq("id", deal_id).execute()
        closed_deal = result.data[0] if result.data else None
        
        if closed_deal:
            # Log history
            await self._log_history(
                deal_id=deal_id,
                from_stage=deal.get("current_stage_id"),
                to_stage=f"_closed_{status}",
                duration_in_stage=duration,
                triggered_by="user",
                notes=notes or f"Deal fechado como {status}"
            )
            
            logger.info("Deal closed", deal_id=deal_id, status=status)
        
        return closed_deal
    
    async def reset_cycle(
        self,
        contact_id: str,
        pipeline_id: str,
        initial_stage_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a new cycle (deal) for a contact who already had previous deals.
        This is used when a contact re-enters the funnel after won/lost.
        """
        # Simply create a new deal - cycle_number is auto-calculated
        return await self.create_deal(
            contact_id=contact_id,
            pipeline_id=pipeline_id,
            initial_stage_id=initial_stage_id,
            **kwargs
        )
    
    async def delete_deal(self, deal_id: str) -> bool:
        """Delete a deal and its history"""
        try:
            self.supabase.table("crm_deals").delete().eq("id", deal_id).execute()
            logger.info("Deal deleted", deal_id=deal_id)
            return True
        except Exception as e:
            logger.error("Failed to delete deal", deal_id=deal_id, error=str(e))
            return False
    
    async def update_deal(
        self,
        deal_id: str,
        value: Optional[float] = None,
        tags: Optional[List[str]] = None,
        interested_services: Optional[List[str]] = None,
        notes: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """Update deal fields (value, tags, services, notes)"""
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if value is not None:
            update_data["value"] = value
        if tags is not None:
            update_data["tags"] = tags
        if interested_services is not None:
            update_data["interested_services"] = interested_services
        if notes is not None:
            update_data["notes"] = notes
        if metadata is not None:
            update_data["metadata"] = metadata
        
        result = self.supabase.table("crm_deals").update(update_data).eq("id", deal_id).execute()
        return result.data[0] if result.data else None
    
    async def get_deal_history(self, deal_id: str) -> List[Dict[str, Any]]:
        """Get the movement history of a deal"""
        result = self.supabase.table("crm_deal_history").select("*").eq("deal_id", deal_id).order("created_at", desc=True).execute()
        return result.data or []
    
    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================
    
    async def _log_history(
        self,
        deal_id: str,
        from_stage: Optional[str],
        to_stage: str,
        duration_in_stage: Optional[int] = None,
        triggered_by: str = "user",
        triggered_by_id: Optional[str] = None,
        triggered_by_name: Optional[str] = None,
        notes: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Insert a record in crm_deal_history"""
        history_data = {
            "deal_id": deal_id,
            "from_stage": from_stage,
            "to_stage": to_stage,
            "duration_in_stage": duration_in_stage,
            "triggered_by": triggered_by,
            "triggered_by_id": triggered_by_id,
            "triggered_by_name": triggered_by_name,
            "notes": notes,
            "metadata": metadata or {}
        }
        
        self.supabase.table("crm_deal_history").insert(history_data).execute()
    
    async def _calculate_stage_duration(self, deal_id: str, stage_id: str) -> int:
        """Calculate how long the deal was in the current stage (in seconds)"""
        # Get the last history entry for this stage
        result = self.supabase.table("crm_deal_history").select("created_at").eq("deal_id", deal_id).eq("to_stage", stage_id).order("created_at", desc=True).limit(1).execute()
        
        if result.data:
            entry_time = datetime.fromisoformat(result.data[0]["created_at"].replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            return int((now - entry_time).total_seconds())
        return 0
    
    async def _check_stage_automations(
        self,
        deal: Dict[str, Any],
        from_stage: Optional[str],
        to_stage: str
    ):
        """Check if there are automations to trigger for this stage entry"""
        # Get automations for pipeline_entry
        result = self.supabase.table("automation_journeys").select("*").eq("trigger_type", "pipeline_entry").eq("is_active", True).execute()
        
        journeys = result.data or []
        
        for journey in journeys:
            trigger_config = journey.get("trigger_config", {})
            if trigger_config.get("stage_id") == to_stage:
                # Check if "only_first_time" is set
                if trigger_config.get("only_first_time", False):
                    # Check history if this deal has been in this stage before
                    has_been = await self._has_been_in_stage(deal["id"], to_stage)
                    if has_been:
                        continue  # Skip, not first time
                
                # Schedule automation execution
                await self._schedule_automation(journey, deal)
    
    async def _has_been_in_stage(self, deal_id: str, stage_id: str) -> bool:
        """Check if deal has been in this stage before (excluding current entry)"""
        result = self.supabase.table("crm_deal_history").select("id").eq("deal_id", deal_id).eq("to_stage", stage_id).execute()
        # More than 1 means it's been there before (current entry is already logged)
        return len(result.data or []) > 1
    
    async def _schedule_automation(self, journey: Dict[str, Any], deal: Dict[str, Any]):
        """Schedule an automation execution"""
        delay_config = journey.get("delay_config", {})
        delay_seconds = self._calculate_delay_seconds(delay_config)
        
        scheduled_at = datetime.now(timezone.utc)
        if delay_seconds > 0:
            from datetime import timedelta
            scheduled_at += timedelta(seconds=delay_seconds)
        
        execution_data = {
            "journey_id": journey["id"],
            "deal_id": deal["id"],
            "contact_id": deal.get("contact_id"),
            "scheduled_at": scheduled_at.isoformat(),
            "status": "pending"
        }
        
        self.supabase.table("automation_executions").insert(execution_data).execute()
        logger.info("Automation scheduled", journey_id=journey["id"], deal_id=deal["id"], scheduled_at=scheduled_at)
    
    def _calculate_delay_seconds(self, delay_config: Dict) -> int:
        """Convert delay config to seconds"""
        value = delay_config.get("value", 0)
        unit = delay_config.get("unit", "seconds")
        
        multipliers = {
            "seconds": 1,
            "minutes": 60,
            "hours": 3600,
            "days": 86400
        }
        
        return value * multipliers.get(unit, 1)
