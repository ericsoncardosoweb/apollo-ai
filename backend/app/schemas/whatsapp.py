"""
Apollo A.I. Advanced - WhatsApp Message Schemas
Defensive Pydantic models for webhook payload validation
"""

from typing import Optional, List, Literal, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
import re


# ===========================================
# STANDARD INTERNAL MESSAGE FORMAT
# All adapters normalize to this format
# ===========================================

class StandardMessage(BaseModel):
    """
    Normalized message format used internally.
    All gateway adapters convert their payloads to this format.
    """
    message_id: str = Field(..., description="Unique message ID from provider")
    chat_id: str = Field(..., description="Unique conversation/chat identifier")
    phone: str = Field(..., description="Phone number in E.164 format")
    content: str = Field(default="", description="Text content of message")
    content_type: Literal["text", "audio", "image", "video", "document", "sticker", "location", "contact"] = "text"
    media_url: Optional[str] = None
    media_mime_type: Optional[str] = None
    media_duration_seconds: Optional[int] = None
    is_from_me: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    raw_payload: Optional[dict] = Field(default=None, exclude=True)
    
    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        """Remove any non-digit characters and ensure E.164 format"""
        digits = re.sub(r'\D', '', v)
        # Brazilian numbers: ensure country code
        if len(digits) == 11:  # Without country code
            digits = "55" + digits
        elif len(digits) == 10:  # Landline without country code
            digits = "55" + digits
        return digits


class BufferedMessagePacket(BaseModel):
    """
    A packet of messages accumulated in the buffer.
    Sent to AI processing after silence detection.
    """
    chat_id: str
    tenant_id: str
    phone: str
    messages: List[StandardMessage]
    total_duration_seconds: int = Field(default=0, description="Total audio duration if applicable")
    first_message_at: datetime
    last_message_at: datetime
    
    @property
    def combined_text(self) -> str:
        """Combine all text messages into a single string"""
        texts = [m.content for m in self.messages if m.content and m.content_type == "text"]
        return " ".join(texts)
    
    @property
    def has_audio(self) -> bool:
        return any(m.content_type == "audio" for m in self.messages)
    
    @property
    def message_count(self) -> int:
        return len(self.messages)


# ===========================================
# EVOLUTION API SCHEMAS
# ===========================================

class EvolutionMessageKey(BaseModel):
    """Evolution API message key structure"""
    remoteJid: str
    fromMe: bool = False
    id: str

class EvolutionMessageContent(BaseModel):
    """Evolution API message content variations"""
    conversation: Optional[str] = None
    extendedTextMessage: Optional[dict] = None
    audioMessage: Optional[dict] = None
    imageMessage: Optional[dict] = None
    videoMessage: Optional[dict] = None
    documentMessage: Optional[dict] = None


class EvolutionData(BaseModel):
    """Evolution API data payload"""
    key: EvolutionMessageKey
    pushName: Optional[str] = None
    message: Optional[EvolutionMessageContent] = None
    messageType: Optional[str] = None
    messageTimestamp: Optional[int] = None


class EvolutionWebhookPayload(BaseModel):
    """Evolution API webhook payload"""
    event: str
    instance: str
    data: Optional[EvolutionData] = None
    
    def to_standard_message(self) -> Optional[StandardMessage]:
        """Convert Evolution payload to StandardMessage"""
        if not self.data or not self.data.key:
            return None
        
        key = self.data.key
        msg = self.data.message
        
        # Extract phone from remoteJid (format: 5511999999999@s.whatsapp.net)
        phone = key.remoteJid.split("@")[0]
        
        # Determine content type and extract content
        content = ""
        content_type = "text"
        media_url = None
        
        if msg:
            if msg.conversation:
                content = msg.conversation
            elif msg.extendedTextMessage:
                content = msg.extendedTextMessage.get("text", "")
            elif msg.audioMessage:
                content_type = "audio"
                media_url = msg.audioMessage.get("url")
            elif msg.imageMessage:
                content_type = "image"
                content = msg.imageMessage.get("caption", "")
                media_url = msg.imageMessage.get("url")
        
        return StandardMessage(
            message_id=key.id,
            chat_id=key.remoteJid,
            phone=phone,
            content=content,
            content_type=content_type,
            media_url=media_url,
            is_from_me=key.fromMe,
            raw_payload=self.model_dump()
        )


# ===========================================
# Z-API SCHEMAS
# ===========================================

class ZAPIWebhookPayload(BaseModel):
    """Z-API webhook payload"""
    phone: str
    messageId: str
    momment: Optional[str] = None  # timestamp
    text: Optional[dict] = None
    audio: Optional[dict] = None
    image: Optional[dict] = None
    fromMe: bool = False
    
    def to_standard_message(self) -> StandardMessage:
        """Convert Z-API payload to StandardMessage"""
        content = ""
        content_type = "text"
        media_url = None
        
        if self.text:
            content = self.text.get("message", "")
        elif self.audio:
            content_type = "audio"
            media_url = self.audio.get("audioUrl")
        elif self.image:
            content_type = "image"
            content = self.image.get("caption", "")
            media_url = self.image.get("imageUrl")
        
        return StandardMessage(
            message_id=self.messageId,
            chat_id=self.phone,
            phone=self.phone,
            content=content,
            content_type=content_type,
            media_url=media_url,
            is_from_me=self.fromMe,
            raw_payload=self.model_dump()
        )


# ===========================================
# META CLOUD API SCHEMAS
# ===========================================

class MetaCloudMessage(BaseModel):
    """Meta Cloud API message structure"""
    id: str
    type: str
    timestamp: str
    text: Optional[dict] = None
    audio: Optional[dict] = None
    image: Optional[dict] = None


class MetaCloudContact(BaseModel):
    """Meta Cloud API contact"""
    wa_id: str
    profile: Optional[dict] = None


class MetaCloudValue(BaseModel):
    """Meta Cloud API value structure"""
    messaging_product: str = "whatsapp"
    messages: Optional[List[MetaCloudMessage]] = None
    contacts: Optional[List[MetaCloudContact]] = None


class MetaCloudChange(BaseModel):
    """Meta Cloud API change structure"""
    value: MetaCloudValue
    field: str = "messages"


class MetaCloudEntry(BaseModel):
    """Meta Cloud API entry structure"""
    id: str
    changes: List[MetaCloudChange]


class MetaCloudWebhookPayload(BaseModel):
    """Meta Cloud API webhook payload"""
    object: str = "whatsapp_business_account"
    entry: List[MetaCloudEntry]
    
    def to_standard_messages(self) -> List[StandardMessage]:
        """Convert Meta Cloud payload to list of StandardMessages"""
        messages = []
        
        for entry in self.entry:
            for change in entry.changes:
                if not change.value.messages:
                    continue
                    
                contacts = {c.wa_id: c for c in (change.value.contacts or [])}
                
                for msg in change.value.messages:
                    content = ""
                    content_type = "text"
                    media_url = None
                    
                    if msg.text:
                        content = msg.text.get("body", "")
                    elif msg.audio:
                        content_type = "audio"
                        media_url = msg.audio.get("id")  # Media ID, needs download
                    elif msg.image:
                        content_type = "image"
                        media_url = msg.image.get("id")
                    
                    # Get phone from contacts
                    contact = contacts.get(msg.id.split("_")[0]) if contacts else None
                    phone = contact.wa_id if contact else ""
                    
                    messages.append(StandardMessage(
                        message_id=msg.id,
                        chat_id=phone,
                        phone=phone,
                        content=content,
                        content_type=content_type,
                        media_url=media_url,
                        is_from_me=False,
                        raw_payload=self.model_dump()
                    ))
        
        return messages
