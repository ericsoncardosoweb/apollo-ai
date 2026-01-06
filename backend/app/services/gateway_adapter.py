"""
Apollo A.I. Advanced - Gateway Adapters
=======================================

Adapter Pattern implementation for normalizing different 
WhatsApp gateway payloads into a standard internal format.

Supports:
- Evolution API
- Z-API
- Meta Cloud API (Official)
- UAZAPI (Coming soon)
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Any, Type
from enum import Enum
import structlog

from app.schemas.whatsapp import (
    StandardMessage,
    EvolutionWebhookPayload,
    ZAPIWebhookPayload,
    MetaCloudWebhookPayload,
    UAZAPIWebhookPayload,
)

logger = structlog.get_logger()


class GatewayProvider(str, Enum):
    """Supported WhatsApp gateway providers"""
    EVOLUTION = "evolution"
    ZAPI = "zapi"
    META_CLOUD = "meta"
    UAZAPI = "uazapi"


class BaseGatewayAdapter(ABC):
    """Base adapter for WhatsApp gateway integrations"""
    
    provider: GatewayProvider
    
    @abstractmethod
    def validate_payload(self, payload: dict) -> bool:
        """Check if payload matches this provider's format"""
        pass
    
    @abstractmethod
    def parse_messages(self, payload: dict) -> List[StandardMessage]:
        """Parse payload into list of StandardMessages"""
        pass
    
    @abstractmethod
    def is_message_event(self, payload: dict) -> bool:
        """Check if this is a new message event (vs status update, etc)"""
        pass


class EvolutionAdapter(BaseGatewayAdapter):
    """Adapter for Evolution API"""
    
    provider = GatewayProvider.EVOLUTION
    
    def validate_payload(self, payload: dict) -> bool:
        return "event" in payload and "instance" in payload
    
    def is_message_event(self, payload: dict) -> bool:
        event = payload.get("event", "")
        return event in ["messages.upsert", "message"]
    
    def parse_messages(self, payload: dict) -> List[StandardMessage]:
        try:
            parsed = EvolutionWebhookPayload(**payload)
            msg = parsed.to_standard_message()
            return [msg] if msg and not msg.is_from_me else []
        except Exception as e:
            logger.error("Evolution parse error", error=str(e), payload=payload)
            return []


class ZAPIAdapter(BaseGatewayAdapter):
    """Adapter for Z-API"""
    
    provider = GatewayProvider.ZAPI
    
    def validate_payload(self, payload: dict) -> bool:
        return "phone" in payload and "messageId" in payload
    
    def is_message_event(self, payload: dict) -> bool:
        # Z-API sends message payloads directly, filter out status updates
        return not payload.get("status") and not payload.get("fromMe", False)
    
    def parse_messages(self, payload: dict) -> List[StandardMessage]:
        try:
            parsed = ZAPIWebhookPayload(**payload)
            if parsed.fromMe:
                return []
            return [parsed.to_standard_message()]
        except Exception as e:
            logger.error("Z-API parse error", error=str(e), payload=payload)
            return []


class MetaCloudAdapter(BaseGatewayAdapter):
    """Adapter for Meta Cloud API (Official WhatsApp Business API)"""
    
    provider = GatewayProvider.META_CLOUD
    
    def validate_payload(self, payload: dict) -> bool:
        return payload.get("object") == "whatsapp_business_account"
    
    def is_message_event(self, payload: dict) -> bool:
        try:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    if change.get("value", {}).get("messages"):
                        return True
        except:
            pass
        return False
    
    def parse_messages(self, payload: dict) -> List[StandardMessage]:
        try:
            parsed = MetaCloudWebhookPayload(**payload)
            return parsed.to_standard_messages()
        except Exception as e:
            logger.error("Meta Cloud parse error", error=str(e), payload=payload)
            return []


class UAZAPIAdapter(BaseGatewayAdapter):
    """Adapter for UAZAPI (Brazilian WhatsApp API)"""
    
    provider = GatewayProvider.UAZAPI
    
    def validate_payload(self, payload: dict) -> bool:
        """
        Check if payload matches UAZAPI format.
        UAZAPI can send different structures:
        - With 'event' field for event type
        - With 'instanceId' or 'instance' for instance identification
        - Direct message fields like 'phone', 'chatId', 'messageId'
        """
        # Check for UAZAPI-specific fields
        has_instance = "instanceId" in payload or "instance" in payload
        has_message_fields = "phone" in payload or "chatId" in payload
        has_event = "event" in payload
        
        # UAZAPI typically has instance + event or direct message fields
        if has_instance and (has_event or has_message_fields):
            return True
        
        # Also check for nested message structure with from/to
        if has_message_fields and ("messageId" in payload or "message" in payload):
            return True
            
        return False
    
    def is_message_event(self, payload: dict) -> bool:
        """Check if this is a new message event"""
        event = payload.get("event", "")
        
        # Skip status updates and connection events
        if event in ["status", "connection.update", "qrcode", "messages.update"]:
            return False
        
        # Accept message events
        if event in ["messages", "messages.upsert", "message", "received"]:
            return True
        
        # If no event field, check for message content
        if payload.get("phone") or payload.get("chatId"):
            # Has message data and not a status update
            if not payload.get("status"):
                return True
        
        return False
    
    def parse_messages(self, payload: dict) -> List[StandardMessage]:
        try:
            parsed = UAZAPIWebhookPayload(**payload)
            msg = parsed.to_standard_message()
            return [msg] if msg else []
        except Exception as e:
            logger.error("UAZAPI parse error", error=str(e), payload=payload)
            return []


class GatewayAdapterFactory:
    """
    Factory for creating the appropriate gateway adapter.
    Auto-detects provider from payload structure.
    """
    
    _adapters: List[BaseGatewayAdapter] = [
        EvolutionAdapter(),
        ZAPIAdapter(),
        MetaCloudAdapter(),
        UAZAPIAdapter(),
    ]
    
    @classmethod
    def get_adapter(cls, provider: str) -> Optional[BaseGatewayAdapter]:
        """Get adapter by provider name"""
        for adapter in cls._adapters:
            if adapter.provider.value == provider.lower():
                return adapter
        return None
    
    @classmethod
    def detect_and_get_adapter(cls, payload: dict) -> Optional[BaseGatewayAdapter]:
        """Auto-detect provider from payload and return appropriate adapter"""
        for adapter in cls._adapters:
            if adapter.validate_payload(payload):
                return adapter
        return None
    
    @classmethod
    def parse_webhook(
        cls, 
        payload: dict, 
        provider: Optional[str] = None
    ) -> List[StandardMessage]:
        """
        Parse webhook payload into StandardMessages.
        
        If provider is specified, uses that adapter.
        Otherwise, auto-detects from payload structure.
        """
        if provider:
            adapter = cls.get_adapter(provider)
        else:
            adapter = cls.detect_and_get_adapter(payload)
        
        if not adapter:
            logger.warning("No matching adapter found", payload_keys=list(payload.keys()))
            return []
        
        if not adapter.is_message_event(payload):
            logger.debug("Not a message event", provider=adapter.provider.value)
            return []
        
        messages = adapter.parse_messages(payload)
        
        logger.info(
            "Webhook parsed",
            provider=adapter.provider.value,
            message_count=len(messages)
        )
        
        return messages


# Convenience function
def parse_webhook_payload(
    payload: dict, 
    provider: Optional[str] = None
) -> List[StandardMessage]:
    """Parse a webhook payload into StandardMessages"""
    return GatewayAdapterFactory.parse_webhook(payload, provider)
