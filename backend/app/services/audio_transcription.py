"""
Apollo A.I. Advanced - Audio Transcription Service
===================================================

Handles audio message transcription using OpenAI Whisper.
Supports multiple audio formats commonly used in WhatsApp.
"""

import os
import tempfile
import time
from typing import Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import aiohttp
import structlog

logger = structlog.get_logger()


class AudioFormat(str, Enum):
    """Supported audio formats."""
    OGG = "ogg"
    OPUS = "opus"
    MP3 = "mp3"
    WAV = "wav"
    M4A = "m4a"
    WEBM = "webm"
    MP4 = "mp4"
    MPEG = "mpeg"
    MPGA = "mpga"


@dataclass
class TranscriptionResult:
    """Result of audio transcription."""
    text: str
    duration_seconds: float
    language: str
    confidence: Optional[float] = None
    processing_time_ms: int = 0


class AudioTranscriptionService:
    """
    Service for transcribing audio messages.
    
    Uses OpenAI Whisper API for high-quality transcription.
    Supports automatic language detection.
    
    Usage:
        service = AudioTranscriptionService()
        result = await service.transcribe_from_url(audio_url)
        print(result.text)
    """
    
    MAX_FILE_SIZE_MB = 25  # OpenAI limit
    SUPPORTED_FORMATS = {f.value for f in AudioFormat}
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OpenAI API key not configured for transcription")
        
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def transcribe_from_url(
        self,
        audio_url: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None
    ) -> TranscriptionResult:
        """
        Transcribe audio from a URL.
        
        Args:
            audio_url: URL of the audio file
            language: Optional language code (e.g., 'pt', 'en')
            prompt: Optional prompt to guide transcription
            
        Returns:
            TranscriptionResult with text and metadata
        """
        start_time = time.time()
        
        # Download audio file
        session = await self._get_session()
        async with session.get(audio_url) as response:
            if response.status != 200:
                raise ValueError(f"Failed to download audio: HTTP {response.status}")
            
            content = await response.read()
            content_type = response.headers.get("Content-Type", "")
            
            # Check file size
            size_mb = len(content) / (1024 * 1024)
            if size_mb > self.MAX_FILE_SIZE_MB:
                raise ValueError(f"Audio file too large: {size_mb:.1f}MB (max {self.MAX_FILE_SIZE_MB}MB)")
        
        # Determine format from URL or content type
        format_ext = self._detect_format(audio_url, content_type)
        
        # Transcribe
        result = await self._transcribe_bytes(
            content,
            format_ext,
            language=language,
            prompt=prompt
        )
        
        result.processing_time_ms = int((time.time() - start_time) * 1000)
        return result
    
    async def transcribe_bytes(
        self,
        audio_data: bytes,
        format_ext: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None
    ) -> TranscriptionResult:
        """
        Transcribe audio from bytes.
        
        Args:
            audio_data: Raw audio bytes
            format_ext: File extension (e.g., 'ogg', 'mp3')
            language: Optional language code
            prompt: Optional prompt to guide transcription
            
        Returns:
            TranscriptionResult with text and metadata
        """
        start_time = time.time()
        result = await self._transcribe_bytes(audio_data, format_ext, language, prompt)
        result.processing_time_ms = int((time.time() - start_time) * 1000)
        return result
    
    async def _transcribe_bytes(
        self,
        audio_data: bytes,
        format_ext: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None
    ) -> TranscriptionResult:
        """Internal transcription method."""
        if not self.api_key:
            raise ValueError("OpenAI API key not configured")
        
        # Validate format
        format_ext = format_ext.lower().lstrip(".")
        if format_ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported audio format: {format_ext}")
        
        # Write to temp file (OpenAI API requires file)
        with tempfile.NamedTemporaryFile(suffix=f".{format_ext}", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name
        
        try:
            session = await self._get_session()
            
            # Prepare multipart form data
            form_data = aiohttp.FormData()
            form_data.add_field(
                "file",
                open(tmp_path, "rb"),
                filename=f"audio.{format_ext}",
                content_type=self._get_mime_type(format_ext)
            )
            form_data.add_field("model", "whisper-1")
            form_data.add_field("response_format", "verbose_json")
            
            if language:
                form_data.add_field("language", language)
            
            if prompt:
                form_data.add_field("prompt", prompt)
            
            # Call OpenAI API
            async with session.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                data=form_data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error("Transcription API error", status=response.status, error=error_text)
                    raise ValueError(f"Transcription failed: {error_text}")
                
                result = await response.json()
            
            return TranscriptionResult(
                text=result.get("text", "").strip(),
                duration_seconds=result.get("duration", 0),
                language=result.get("language", language or "unknown"),
                confidence=None  # Whisper doesn't provide confidence
            )
            
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    
    def _detect_format(self, url: str, content_type: str) -> str:
        """Detect audio format from URL or content type."""
        # Try URL extension first
        url_lower = url.lower().split("?")[0]  # Remove query params
        for fmt in AudioFormat:
            if url_lower.endswith(f".{fmt.value}"):
                return fmt.value
        
        # Try content type
        content_type_map = {
            "audio/ogg": "ogg",
            "audio/opus": "opus",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mp4": "m4a",
            "audio/m4a": "m4a",
            "audio/webm": "webm",
            "video/mp4": "mp4",
        }
        
        for ct, fmt in content_type_map.items():
            if ct in content_type.lower():
                return fmt
        
        # Default to ogg (common for WhatsApp)
        logger.warning("Could not detect audio format, defaulting to ogg", url=url, content_type=content_type)
        return "ogg"
    
    def _get_mime_type(self, format_ext: str) -> str:
        """Get MIME type for audio format."""
        mime_types = {
            "ogg": "audio/ogg",
            "opus": "audio/opus",
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "m4a": "audio/mp4",
            "webm": "audio/webm",
            "mp4": "video/mp4",
            "mpeg": "audio/mpeg",
            "mpga": "audio/mpeg",
        }
        return mime_types.get(format_ext, "application/octet-stream")


# Singleton instance
_transcription_service: Optional[AudioTranscriptionService] = None


def get_transcription_service() -> AudioTranscriptionService:
    """Get singleton AudioTranscriptionService instance."""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = AudioTranscriptionService()
    return _transcription_service


# ===========================================
# Helper functions for message processing
# ===========================================

async def transcribe_whatsapp_audio(
    audio_url: str,
    message_id: Optional[str] = None
) -> Tuple[str, float]:
    """
    Convenience function to transcribe WhatsApp audio messages.
    
    Args:
        audio_url: URL of the audio file from WhatsApp
        message_id: Optional message ID for logging
        
    Returns:
        Tuple of (transcription_text, duration_seconds)
    """
    service = get_transcription_service()
    
    try:
        # Use Portuguese prompt for Brazilian context
        result = await service.transcribe_from_url(
            audio_url,
            language="pt",
            prompt="Esta é uma mensagem de áudio do WhatsApp em português brasileiro."
        )
        
        logger.info(
            "Audio transcribed",
            message_id=message_id,
            duration=result.duration_seconds,
            text_length=len(result.text),
            processing_time_ms=result.processing_time_ms
        )
        
        return result.text, result.duration_seconds
        
    except Exception as e:
        logger.error(
            "Audio transcription failed",
            message_id=message_id,
            error=str(e)
        )
        raise
