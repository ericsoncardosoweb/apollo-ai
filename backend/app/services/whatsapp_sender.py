"""
Apollo A.I. Advanced - WhatsApp Gateway Sender
==============================================

Handles outgoing messages to WhatsApp via multiple gateway providers.
Supports:
- Evolution API
- Z-API
- Meta Cloud API (Official)

Uses Adapter Pattern to abstract provider-specific implementations.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from enum import Enum
import httpx
import structlog

from app.core.config import settings
from app.db.supabase import get_supabase

logger = structlog.get_logger()


class MessageType(str, Enum):
    """Types of outgoing messages"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    DOCUMENT = "document"
    TEMPLATE = "template"
    BUTTON = "button"
    LIST = "list"


class SendResult:
    """Result of a message send operation"""
    
    def __init__(
        self,
        success: bool,
        message_id: Optional[str] = None,
        error: Optional[str] = None,
        raw_response: Optional[dict] = None
    ):
        self.success = success
        self.message_id = message_id
        self.error = error
        self.raw_response = raw_response


class BaseGatewaySender(ABC):
    """Base class for WhatsApp gateway senders"""
    
    @abstractmethod
    async def send_text(
        self,
        phone: str,
        message: str,
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send a text message"""
        pass
    
    @abstractmethod
    async def send_image(
        self,
        phone: str,
        image_url: str,
        caption: Optional[str],
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send an image message"""
        pass


class EvolutionSender(BaseGatewaySender):
    """Evolution API message sender"""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.EVOLUTION_API_URL
    
    async def send_text(
        self,
        phone: str,
        message: str,
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send text message via Evolution API"""
        url = f"{self.base_url}/message/sendText/{instance_id}"
        
        payload = {
            "number": phone,
            "text": message
        }
        
        headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code == 200 or response.status_code == 201:
                    return SendResult(
                        success=True,
                        message_id=data.get("key", {}).get("id"),
                        raw_response=data
                    )
                else:
                    return SendResult(
                        success=False,
                        error=data.get("message", str(data)),
                        raw_response=data
                    )
        except Exception as e:
            logger.error("Evolution send failed", error=str(e))
            return SendResult(success=False, error=str(e))
    
    async def send_image(
        self,
        phone: str,
        image_url: str,
        caption: Optional[str],
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send image via Evolution API"""
        url = f"{self.base_url}/message/sendMedia/{instance_id}"
        
        payload = {
            "number": phone,
            "mediatype": "image",
            "media": image_url,
            "caption": caption or ""
        }
        
        headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code in [200, 201]:
                    return SendResult(
                        success=True,
                        message_id=data.get("key", {}).get("id"),
                        raw_response=data
                    )
                else:
                    return SendResult(success=False, error=str(data), raw_response=data)
        except Exception as e:
            logger.error("Evolution image send failed", error=str(e))
            return SendResult(success=False, error=str(e))


class ZAPISender(BaseGatewaySender):
    """Z-API message sender"""
    
    def __init__(self, base_url: str = "https://api.z-api.io"):
        self.base_url = base_url
    
    async def send_text(
        self,
        phone: str,
        message: str,
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send text message via Z-API"""
        url = f"{self.base_url}/instances/{instance_id}/token/{api_key}/send-text"
        
        payload = {
            "phone": phone,
            "message": message
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                data = response.json()
                
                if data.get("zapiMessageId"):
                    return SendResult(
                        success=True,
                        message_id=data.get("zapiMessageId"),
                        raw_response=data
                    )
                else:
                    return SendResult(
                        success=False,
                        error=data.get("error", str(data)),
                        raw_response=data
                    )
        except Exception as e:
            logger.error("Z-API send failed", error=str(e))
            return SendResult(success=False, error=str(e))
    
    async def send_image(
        self,
        phone: str,
        image_url: str,
        caption: Optional[str],
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send image via Z-API"""
        url = f"{self.base_url}/instances/{instance_id}/token/{api_key}/send-image"
        
        payload = {
            "phone": phone,
            "image": image_url,
            "caption": caption or ""
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                data = response.json()
                
                if data.get("zapiMessageId"):
                    return SendResult(
                        success=True,
                        message_id=data.get("zapiMessageId"),
                        raw_response=data
                    )
                else:
                    return SendResult(success=False, error=str(data), raw_response=data)
        except Exception as e:
            return SendResult(success=False, error=str(e))


class MetaCloudSender(BaseGatewaySender):
    """Meta Cloud API message sender (Official WhatsApp Business API)"""
    
    def __init__(self, api_version: str = "v18.0"):
        self.base_url = f"https://graph.facebook.com/{api_version}"
    
    async def send_text(
        self,
        phone: str,
        message: str,
        instance_id: str,  # phone_number_id for Meta
        api_key: str       # access_token for Meta
    ) -> SendResult:
        """Send text message via Meta Cloud API"""
        url = f"{self.base_url}/{instance_id}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": phone,
            "type": "text",
            "text": {
                "preview_url": True,
                "body": message
            }
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code == 200 and "messages" in data:
                    return SendResult(
                        success=True,
                        message_id=data["messages"][0].get("id"),
                        raw_response=data
                    )
                else:
                    return SendResult(
                        success=False,
                        error=data.get("error", {}).get("message", str(data)),
                        raw_response=data
                    )
        except Exception as e:
            logger.error("Meta Cloud send failed", error=str(e))
            return SendResult(success=False, error=str(e))
    
    async def send_image(
        self,
        phone: str,
        image_url: str,
        caption: Optional[str],
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send image via Meta Cloud API"""
        url = f"{self.base_url}/{instance_id}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": phone,
            "type": "image",
            "image": {
                "link": image_url,
                "caption": caption or ""
            }
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code == 200 and "messages" in data:
                    return SendResult(
                        success=True,
                        message_id=data["messages"][0].get("id"),
                        raw_response=data
                    )
                else:
                    return SendResult(success=False, error=str(data), raw_response=data)
        except Exception as e:
            return SendResult(success=False, error=str(e))


class UAZAPISender(BaseGatewaySender):
    """UAZAPI message sender (Brazilian WhatsApp API)"""
    
    def __init__(self, base_url: str = None):
        # UAZAPI base URL comes from tenant config, not global settings
        self.base_url = base_url
    
    async def send_text(
        self,
        phone: str,
        message: str,
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send text message via UAZAPI"""
        # Get base URL from tenant config (passed as instance_id prefix if needed)
        # For now, use default UAZAPI endpoint
        base_url = self.base_url or "https://api.uazapi.com.br"
        url = f"{base_url}/message/send-text/{instance_id}"
        
        # Format phone for UAZAPI
        phone_formatted = phone
        if not phone.endswith("@s.whatsapp.net"):
            phone_formatted = f"{phone}@s.whatsapp.net"
        
        payload = {
            "number": phone_formatted,
            "text": message
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code in [200, 201]:
                    return SendResult(
                        success=True,
                        message_id=data.get("messageId") or data.get("id"),
                        raw_response=data
                    )
                else:
                    return SendResult(
                        success=False,
                        error=data.get("error", str(data)),
                        raw_response=data
                    )
        except Exception as e:
            logger.error("UAZAPI send failed", error=str(e))
            return SendResult(success=False, error=str(e))
    
    async def send_image(
        self,
        phone: str,
        image_url: str,
        caption: Optional[str],
        instance_id: str,
        api_key: str
    ) -> SendResult:
        """Send image via UAZAPI"""
        base_url = self.base_url or "https://api.uazapi.com.br"
        url = f"{base_url}/message/send-image/{instance_id}"
        
        phone_formatted = phone
        if not phone.endswith("@s.whatsapp.net"):
            phone_formatted = f"{phone}@s.whatsapp.net"
        
        payload = {
            "number": phone_formatted,
            "imageUrl": image_url,
            "caption": caption or ""
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code in [200, 201]:
                    return SendResult(
                        success=True,
                        message_id=data.get("messageId") or data.get("id"),
                        raw_response=data
                    )
                else:
                    return SendResult(success=False, error=str(data), raw_response=data)
        except Exception as e:
            logger.error("UAZAPI image send failed", error=str(e))
            return SendResult(success=False, error=str(e))


class WhatsAppSender:
    """
    High-level WhatsApp message sender.
    
    Automatically selects the correct gateway based on tenant configuration.
    """
    
    _senders = {
        "evolution": EvolutionSender(),
        "zapi": ZAPISender(),
        "meta": MetaCloudSender(),
    }
    
    async def send_text(
        self,
        tenant_id: str,
        phone: str,
        message: str
    ) -> SendResult:
        """Send a text message using tenant's configured gateway"""
        supabase = get_supabase()
        
        # Get tenant configuration
        tenant = supabase.table("tenants").select(
            "whatsapp_gateway, whatsapp_instance_id, whatsapp_api_key"
        ).eq("id", tenant_id).single().execute()
        
        if not tenant.data:
            return SendResult(success=False, error="Tenant not found")
        
        gateway = tenant.data.get("whatsapp_gateway", "evolution")
        instance_id = tenant.data.get("whatsapp_instance_id")
        api_key = tenant.data.get("whatsapp_api_key")
        
        if not instance_id or not api_key:
            return SendResult(success=False, error="WhatsApp not configured for tenant")
        
        sender = self._senders.get(gateway)
        if not sender:
            return SendResult(success=False, error=f"Unknown gateway: {gateway}")
        
        result = await sender.send_text(
            phone=self._format_phone(phone),
            message=message,
            instance_id=instance_id,
            api_key=api_key
        )
        
        logger.info(
            "Message sent",
            tenant_id=tenant_id,
            phone=phone,
            gateway=gateway,
            success=result.success,
            message_id=result.message_id
        )
        
        return result
    
    async def send_image(
        self,
        tenant_id: str,
        phone: str,
        image_url: str,
        caption: Optional[str] = None
    ) -> SendResult:
        """Send an image message using tenant's configured gateway"""
        supabase = get_supabase()
        
        tenant = supabase.table("tenants").select(
            "whatsapp_gateway, whatsapp_instance_id, whatsapp_api_key"
        ).eq("id", tenant_id).single().execute()
        
        if not tenant.data:
            return SendResult(success=False, error="Tenant not found")
        
        gateway = tenant.data.get("whatsapp_gateway", "evolution")
        instance_id = tenant.data.get("whatsapp_instance_id")
        api_key = tenant.data.get("whatsapp_api_key")
        
        if not instance_id or not api_key:
            return SendResult(success=False, error="WhatsApp not configured")
        
        sender = self._senders.get(gateway)
        if not sender:
            return SendResult(success=False, error=f"Unknown gateway: {gateway}")
        
        return await sender.send_image(
            phone=self._format_phone(phone),
            image_url=image_url,
            caption=caption,
            instance_id=instance_id,
            api_key=api_key
        )
    
    def _format_phone(self, phone: str) -> str:
        """Ensure phone is in correct format"""
        digits = "".join(c for c in phone if c.isdigit())
        
        if len(digits) == 11:
            digits = "55" + digits
        elif len(digits) == 10:
            digits = "55" + digits
        
        return digits


# Singleton instance
_sender: Optional[WhatsAppSender] = None


def get_whatsapp_sender() -> WhatsAppSender:
    """Get singleton WhatsAppSender instance"""
    global _sender
    if _sender is None:
        _sender = WhatsAppSender()
    return _sender
