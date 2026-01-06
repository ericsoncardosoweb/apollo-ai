"""
Apollo A.I. Advanced - Messages Endpoints
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
import structlog

from app.api.deps import CurrentUser, TenantContext
from app.db.supabase import fetch_one, fetch_many, insert_one, get_supabase

logger = structlog.get_logger()
router = APIRouter()


# ===========================================
# Schemas
# ===========================================

class MessageResponse(BaseModel):
    """Message response schema."""
    id: UUID
    conversation_id: UUID
    sender_type: str
    sender_id: Optional[UUID]
    sender_name: Optional[str]
    content: str
    content_type: str
    media_url: Optional[str]
    ai_model: Optional[str]
    ai_confidence: Optional[float]
    created_at: datetime


class MessageCreate(BaseModel):
    """Message creation schema (for human agents)."""
    content: str
    content_type: str = "text"
    media_url: Optional[str] = None
    is_internal: bool = False


# ===========================================
# Endpoints
# ===========================================

@router.get("/conversation/{conversation_id}", response_model=List[MessageResponse])
async def list_messages(
    conversation_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext,
    limit: int = Query(50, le=200),
    before: Optional[datetime] = None
):
    """
    List messages for a conversation.
    
    Supports pagination using 'before' timestamp for infinite scroll.
    """
    # Verify conversation belongs to tenant
    conversation = await fetch_one("conversations", {
        "id": str(conversation_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    client = get_supabase()
    query = client.table("messages").select("*").eq(
        "conversation_id", str(conversation_id)
    ).eq("is_deleted", False)
    
    if before:
        query = query.lt("created_at", before.isoformat())
    
    query = query.order("created_at", desc=True).limit(limit)
    
    result = query.execute()
    
    # Return in chronological order
    messages = result.data or []
    messages.reverse()
    
    return messages


@router.post("/conversation/{conversation_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: UUID,
    message_data: MessageCreate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Send a message as a human agent.
    
    This endpoint is for human agents responding in conversations.
    AI messages are created through the AI processing pipeline.
    """
    # Verify conversation exists and belongs to tenant
    conversation = await fetch_one("conversations", {
        "id": str(conversation_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Create message
    message = await insert_one("messages", {
        "conversation_id": str(conversation_id),
        "tenant_id": tenant["tenant_id"],
        "sender_type": "human_agent",
        "sender_id": current_user["id"],
        "sender_name": current_user.get("full_name", "Agent"),
        "content": message_data.content,
        "content_type": message_data.content_type,
        "media_url": message_data.media_url,
        "is_internal": message_data.is_internal,
    })
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message"
        )
    
    # Update conversation last_message_at
    from app.db.supabase import update_one
    await update_one(
        "conversations",
        {"id": str(conversation_id)},
        {
            "last_message_at": datetime.utcnow().isoformat(),
            "human_message_count": conversation.get("human_message_count", 0) + 1,
            "message_count": conversation.get("message_count", 0) + 1
        }
    )
    
    # TODO: Send message through WhatsApp gateway if not internal
    if not message_data.is_internal:
        # Trigger Celery task to send via WhatsApp
        pass
    
    logger.info(
        "Human agent sent message",
        conversation_id=str(conversation_id),
        agent_id=current_user["id"],
        is_internal=message_data.is_internal
    )
    
    return message


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Get a specific message by ID."""
    message = await fetch_one("messages", {
        "id": str(message_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    return message


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Soft delete a message.
    
    Only the sender or an admin can delete a message.
    """
    message = await fetch_one("messages", {
        "id": str(message_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Check permission
    is_sender = message.get("sender_id") == current_user["id"]
    is_admin = current_user.get("role") in ["admin", "super_admin"]
    
    if not is_sender and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete this message"
        )
    
    from app.db.supabase import update_one
    await update_one(
        "messages",
        {"id": str(message_id)},
        {"is_deleted": True}
    )
    
    logger.info("Message deleted", message_id=str(message_id))


# ===========================================
# Audio Transcription
# ===========================================

class TranscriptionRequest(BaseModel):
    """Transcription request schema."""
    audio_url: str
    language: Optional[str] = "pt"
    

class TranscriptionResponse(BaseModel):
    """Transcription response schema."""
    text: str
    duration_seconds: float
    language: str
    processing_time_ms: int


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: TranscriptionRequest,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Transcribe an audio message.
    
    Uses OpenAI Whisper for high-quality Portuguese transcription.
    Supports formats: OGG, OPUS, MP3, WAV, M4A, WEBM
    """
    from app.services.audio_transcription import get_transcription_service
    
    service = get_transcription_service()
    
    try:
        result = await service.transcribe_from_url(
            audio_url=request.audio_url,
            language=request.language,
            prompt="Esta é uma mensagem de áudio do WhatsApp em português brasileiro."
        )
        
        logger.info(
            "Audio transcribed via API",
            tenant_id=tenant["tenant_id"],
            duration=result.duration_seconds
        )
        
        return TranscriptionResponse(
            text=result.text,
            duration_seconds=result.duration_seconds,
            language=result.language,
            processing_time_ms=result.processing_time_ms
        )
        
    except Exception as e:
        logger.error("Transcription failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )


@router.patch("/{message_id}/transcription")
async def update_message_transcription(
    message_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Transcribe and update an audio message with its text content.
    
    Fetches the audio from the message's media_url, transcribes it,
    and updates the message with the transcription.
    """
    # Get message
    message = await fetch_one("messages", {
        "id": str(message_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    if message.get("content_type") != "audio":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is not an audio message"
        )
    
    audio_url = message.get("media_url")
    if not audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message has no audio URL"
        )
    
    # Transcribe
    from app.services.audio_transcription import get_transcription_service
    service = get_transcription_service()
    
    try:
        result = await service.transcribe_from_url(audio_url, language="pt")
        
        # Update message with transcription
        from app.db.supabase import update_one
        updated = await update_one(
            "messages",
            {"id": str(message_id)},
            {
                "content": result.text,
                "ai_response_metadata": {
                    "transcription": {
                        "duration_seconds": result.duration_seconds,
                        "language": result.language,
                        "processing_time_ms": result.processing_time_ms
                    }
                }
            }
        )
        
        logger.info(
            "Message transcription updated",
            message_id=str(message_id),
            duration=result.duration_seconds
        )
        
        return {
            "message": "Transcription completed",
            "text": result.text,
            "duration_seconds": result.duration_seconds
        }
        
    except Exception as e:
        logger.error("Message transcription failed", message_id=str(message_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )
