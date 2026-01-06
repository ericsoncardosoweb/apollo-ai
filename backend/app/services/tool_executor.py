"""
Tool Executor Service - The "Hand" of the Automation System
============================================================

Executes actions defined in automation journeys:
- WhatsAppTool: Send messages via messaging adapter
- HttpTool: External webhook requests
- CrmTool: Move deals, update values, add tags
- NotificationTool: Push/email notifications
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import httpx
import structlog

logger = structlog.get_logger()


class BaseTool(ABC):
    """Abstract base class for all tools"""
    
    tool_type: str = "base"
    
    @abstractmethod
    async def execute(self, payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the tool action.
        
        Args:
            payload: Tool-specific configuration
            context: Execution context (deal, contact, tenant info)
            
        Returns:
            Result dict with {success: bool, data: Any, error: str?}
        """
        pass
    
    def log_execution(self, success: bool, context: Dict, result: Any = None, error: str = None):
        """Log tool execution for debugging"""
        logger.info(
            "Tool executed",
            tool_type=self.tool_type,
            success=success,
            context_id=context.get("deal_id") or context.get("contact_id"),
            error=error
        )


class WhatsAppTool(BaseTool):
    """Send WhatsApp messages via messaging adapter"""
    
    tool_type = "whatsapp_send"
    
    def __init__(self, whatsapp_sender=None):
        self.sender = whatsapp_sender
    
    async def execute(self, payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a WhatsApp message.
        
        Payload:
            - message: str (text content, supports {contact_name}, {deal_value} placeholders)
            - template_id: str (optional, for template messages)
            - media_url: str (optional, for media messages)
        """
        try:
            phone = context.get("contact_phone")
            if not phone:
                return {"success": False, "error": "No phone number in context"}
            
            # Process message placeholders
            message = payload.get("message", "")
            message = self._replace_placeholders(message, context)
            
            # Send via adapter
            if self.sender:
                result = await self.sender.send_message(
                    phone=phone,
                    message=message,
                    media_url=payload.get("media_url")
                )
                self.log_execution(True, context, result)
                return {"success": True, "data": result}
            else:
                # Mock for testing
                self.log_execution(True, context)
                return {"success": True, "data": {"message_id": "mock", "status": "sent"}}
                
        except Exception as e:
            self.log_execution(False, context, error=str(e))
            return {"success": False, "error": str(e)}
    
    def _replace_placeholders(self, message: str, context: Dict) -> str:
        """Replace placeholders in message with context values"""
        replacements = {
            "{contact_name}": context.get("contact_name", ""),
            "{deal_value}": str(context.get("deal_value", 0)),
            "{deal_stage}": context.get("current_stage_id", ""),
            "{cycle_number}": str(context.get("cycle_number", 1)),
        }
        
        for placeholder, value in replacements.items():
            message = message.replace(placeholder, value)
        
        return message


class HttpTool(BaseTool):
    """Make HTTP requests to external webhooks"""
    
    tool_type = "http_request"
    
    async def execute(self, payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make an HTTP request.
        
        Payload:
            - url: str (required)
            - method: str (GET, POST, PUT, PATCH, DELETE)
            - headers: dict (optional)
            - body: dict (optional, merged with context data)
            - timeout: int (optional, default 30)
        """
        try:
            url = payload.get("url")
            if not url:
                return {"success": False, "error": "No URL provided"}
            
            method = payload.get("method", "POST").upper()
            headers = payload.get("headers", {})
            timeout = payload.get("timeout", 30)
            
            # Build request body with context
            body = payload.get("body", {})
            body.update({
                "deal_id": context.get("deal_id"),
                "contact_id": context.get("contact_id"),
                "contact_name": context.get("contact_name"),
                "contact_phone": context.get("contact_phone"),
                "deal_value": context.get("deal_value"),
                "current_stage": context.get("current_stage_id"),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                if method == "GET":
                    response = await client.get(url, headers=headers)
                elif method == "POST":
                    response = await client.post(url, json=body, headers=headers)
                elif method == "PUT":
                    response = await client.put(url, json=body, headers=headers)
                elif method == "PATCH":
                    response = await client.patch(url, json=body, headers=headers)
                elif method == "DELETE":
                    response = await client.delete(url, headers=headers)
                else:
                    return {"success": False, "error": f"Invalid method: {method}"}
                
                self.log_execution(response.is_success, context)
                return {
                    "success": response.is_success,
                    "data": {
                        "status_code": response.status_code,
                        "body": response.text[:1000]  # Limit response size
                    }
                }
                
        except Exception as e:
            self.log_execution(False, context, error=str(e))
            return {"success": False, "error": str(e)}


class CrmTool(BaseTool):
    """CRM actions: move deals, update values, add tags"""
    
    tool_type = "crm_action"
    
    def __init__(self, deal_manager=None):
        self.deal_manager = deal_manager
    
    async def execute(self, payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute CRM action.
        
        Payload:
            - action: str (move_stage, update_value, add_tag, remove_tag, close_won, close_lost)
            - stage_id: str (for move_stage)
            - value: float (for update_value)
            - tag: str (for add_tag, remove_tag)
        """
        try:
            action = payload.get("action")
            deal_id = context.get("deal_id")
            
            if not deal_id or not self.deal_manager:
                return {"success": False, "error": "No deal_id or deal_manager"}
            
            if action == "move_stage":
                result = await self.deal_manager.move_deal(
                    deal_id=deal_id,
                    target_stage_id=payload.get("stage_id"),
                    triggered_by="automation"
                )
                self.log_execution(bool(result), context)
                return {"success": bool(result), "data": result}
            
            elif action == "update_value":
                result = await self.deal_manager.update_deal(
                    deal_id=deal_id,
                    value=payload.get("value")
                )
                self.log_execution(bool(result), context)
                return {"success": bool(result), "data": result}
            
            elif action == "add_tag":
                # Get current tags and add new one
                deal = await self.deal_manager.get_deal(deal_id)
                tags = deal.get("tags", []) if deal else []
                new_tag = payload.get("tag")
                if new_tag and new_tag not in tags:
                    tags.append(new_tag)
                result = await self.deal_manager.update_deal(deal_id=deal_id, tags=tags)
                self.log_execution(bool(result), context)
                return {"success": bool(result), "data": result}
            
            elif action == "remove_tag":
                deal = await self.deal_manager.get_deal(deal_id)
                tags = deal.get("tags", []) if deal else []
                tag_to_remove = payload.get("tag")
                if tag_to_remove in tags:
                    tags.remove(tag_to_remove)
                result = await self.deal_manager.update_deal(deal_id=deal_id, tags=tags)
                self.log_execution(bool(result), context)
                return {"success": bool(result), "data": result}
            
            elif action == "close_won":
                result = await self.deal_manager.close_deal(deal_id, "won")
                self.log_execution(bool(result), context)
                return {"success": bool(result), "data": result}
            
            elif action == "close_lost":
                result = await self.deal_manager.close_deal(deal_id, "lost")
                self.log_execution(bool(result), context)
                return {"success": bool(result), "data": result}
            
            else:
                return {"success": False, "error": f"Unknown action: {action}"}
                
        except Exception as e:
            self.log_execution(False, context, error=str(e))
            return {"success": False, "error": str(e)}


class NotificationTool(BaseTool):
    """Send notifications (internal, email, push)"""
    
    tool_type = "notification"
    
    async def execute(self, payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send notification.
        
        Payload:
            - type: str (internal, email, push)
            - title: str
            - message: str
            - recipient_id: str (user ID to notify)
        """
        try:
            notif_type = payload.get("type", "internal")
            title = payload.get("title", "Notificação")
            message = payload.get("message", "")
            
            # Replace placeholders
            message = message.replace("{contact_name}", context.get("contact_name", ""))
            message = message.replace("{deal_value}", str(context.get("deal_value", 0)))
            
            # For now, just log the notification
            # In production, integrate with notification service
            logger.info(
                "Notification triggered",
                type=notif_type,
                title=title,
                message=message,
                context=context.get("deal_id")
            )
            
            self.log_execution(True, context)
            return {"success": True, "data": {"sent": True}}
            
        except Exception as e:
            self.log_execution(False, context, error=str(e))
            return {"success": False, "error": str(e)}


class ToolExecutor:
    """
    Main executor that routes actions to appropriate tools.
    Used by both JourneyProcessor and AI agents.
    """
    
    def __init__(self, deal_manager=None, whatsapp_sender=None):
        self.tools: Dict[str, BaseTool] = {
            "whatsapp_send": WhatsAppTool(whatsapp_sender),
            "http_request": HttpTool(),
            "crm_move": CrmTool(deal_manager),
            "crm_update": CrmTool(deal_manager),
            "tag_add": CrmTool(deal_manager),
            "tag_remove": CrmTool(deal_manager),
            "notification": NotificationTool(),
        }
    
    def register_tool(self, tool_type: str, tool: BaseTool):
        """Register a custom tool"""
        self.tools[tool_type] = tool
    
    async def execute(
        self,
        action_type: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a single action.
        
        Args:
            action_type: Type of tool to use
            payload: Tool-specific configuration
            context: Deal/contact context
            
        Returns:
            Execution result
        """
        tool = self.tools.get(action_type)
        if not tool:
            return {"success": False, "error": f"Unknown tool type: {action_type}"}
        
        return await tool.execute(payload, context)
    
    async def execute_sequence(
        self,
        actions: list,
        context: Dict[str, Any],
        stop_on_failure: bool = True
    ) -> list:
        """
        Execute a sequence of actions.
        
        Args:
            actions: List of {type, payload} dicts
            context: Shared context
            stop_on_failure: Whether to stop if an action fails
            
        Returns:
            List of results
        """
        results = []
        
        for action in actions:
            action_type = action.get("type")
            payload = action.get("payload", {})
            
            result = await self.execute(action_type, payload, context)
            results.append({
                "action_type": action_type,
                "result": result
            })
            
            if not result.get("success") and stop_on_failure:
                break
        
        return results
