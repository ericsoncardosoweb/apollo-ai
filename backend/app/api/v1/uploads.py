"""
Upload Router - File Upload API with 15-day retention
======================================================

Handles temporary file uploads for:
- Chat attachments (images, audio, documents)
- Message media
- Knowledge base documents

Files are stored locally and auto-deleted after 15 days.
"""

import os
import uuid
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import get_current_tenant_id
from app.core.config import settings

import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# ===========================================
# CONFIGURATION
# ===========================================

# Base upload directory
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/apollo_uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Max file sizes
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB

# Retention period
RETENTION_DAYS = 15

# Allowed MIME types
ALLOWED_TYPES = {
    "image": ["image/jpeg", "image/png", "image/gif", "image/webp"],
    "audio": ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm", "audio/aac"],
    "video": ["video/mp4", "video/webm", "video/quicktime"],
    "document": [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/csv",
    ],
}


# ===========================================
# SCHEMAS
# ===========================================

class UploadResponse(BaseModel):
    """Response for successful upload"""
    success: bool
    file_id: str
    filename: str
    content_type: str
    size: int
    url: str
    expires_at: str


class UploadError(BaseModel):
    """Response for upload errors"""
    error: bool
    message: str
    code: str


# ===========================================
# HELPERS
# ===========================================

def get_upload_path(tenant_id: str, file_id: str, extension: str) -> Path:
    """Get the full path for an upload"""
    tenant_dir = UPLOAD_DIR / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    return tenant_dir / f"{file_id}{extension}"


def get_file_category(content_type: str) -> Optional[str]:
    """Determine file category from MIME type"""
    for category, types in ALLOWED_TYPES.items():
        if content_type in types:
            return category
    return None


def is_allowed_type(content_type: str) -> bool:
    """Check if content type is allowed"""
    return get_file_category(content_type) is not None


def get_max_size(content_type: str) -> int:
    """Get max file size based on type"""
    category = get_file_category(content_type)
    if category == "image":
        return MAX_IMAGE_SIZE
    elif category == "audio":
        return MAX_AUDIO_SIZE
    return MAX_FILE_SIZE


async def cleanup_old_files():
    """Background task to remove expired files"""
    cutoff = datetime.now() - timedelta(days=RETENTION_DAYS)
    
    for tenant_dir in UPLOAD_DIR.iterdir():
        if not tenant_dir.is_dir():
            continue
            
        for file_path in tenant_dir.iterdir():
            try:
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff:
                    file_path.unlink()
                    logger.info("Deleted expired file", path=str(file_path))
            except Exception as e:
                logger.warning("Failed to cleanup file", path=str(file_path), error=str(e))


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/file", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Upload a file to temporary storage.
    
    Files are automatically deleted after 15 days.
    
    Supported types:
    - Images: JPEG, PNG, GIF, WebP (max 10MB)
    - Audio: MP3, OGG, WAV, WebM, AAC (max 25MB)
    - Video: MP4, WebM, QuickTime (max 50MB)
    - Documents: PDF, DOC, DOCX, TXT, CSV (max 50MB)
    """
    
    # Validate content type
    content_type = file.content_type or "application/octet-stream"
    if not is_allowed_type(content_type):
        raise HTTPException(
            status_code=400,
            detail={
                "error": True,
                "code": "INVALID_FILE_TYPE",
                "message": f"File type '{content_type}' is not allowed",
            }
        )
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Validate size
    max_size = get_max_size(content_type)
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail={
                "error": True,
                "code": "FILE_TOO_LARGE",
                "message": f"File size {file_size} exceeds maximum {max_size}",
            }
        )
    
    # Generate file ID and path
    file_id = str(uuid.uuid4())
    extension = Path(file.filename).suffix if file.filename else ""
    file_path = get_upload_path(tenant_id, file_id, extension)
    
    # Save file
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error("Failed to save file", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error": True,
                "code": "UPLOAD_FAILED",
                "message": "Failed to save file",
            }
        )
    
    # Calculate expiration
    expires_at = datetime.now() + timedelta(days=RETENTION_DAYS)
    
    # Schedule cleanup
    if background_tasks:
        background_tasks.add_task(cleanup_old_files)
    
    logger.info(
        "File uploaded",
        file_id=file_id,
        tenant_id=tenant_id,
        content_type=content_type,
        size=file_size
    )
    
    # Return response with URL
    base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    file_url = f"{base_url}/api/v1/uploads/file/{tenant_id}/{file_id}{extension}"
    
    return UploadResponse(
        success=True,
        file_id=file_id,
        filename=file.filename or f"{file_id}{extension}",
        content_type=content_type,
        size=file_size,
        url=file_url,
        expires_at=expires_at.isoformat(),
    )


@router.get("/file/{tenant_id}/{file_id}")
async def get_file(tenant_id: str, file_id: str):
    """
    Retrieve an uploaded file.
    
    Files expire after 15 days.
    """
    
    # Find file with any extension
    tenant_dir = UPLOAD_DIR / tenant_id
    if not tenant_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Look for file with matching ID
    matching_files = list(tenant_dir.glob(f"{file_id}*"))
    if not matching_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = matching_files[0]
    
    # Check if expired
    mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
    if datetime.now() - mtime > timedelta(days=RETENTION_DAYS):
        file_path.unlink()
        raise HTTPException(status_code=410, detail="File expired")
    
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream",
    )


@router.delete("/file/{file_id}")
async def delete_file(
    file_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Delete an uploaded file.
    """
    
    tenant_dir = UPLOAD_DIR / tenant_id
    if not tenant_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    matching_files = list(tenant_dir.glob(f"{file_id}*"))
    if not matching_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = matching_files[0]
    file_path.unlink()
    
    logger.info("File deleted", file_id=file_id, tenant_id=tenant_id)
    
    return {"success": True, "message": "File deleted"}


@router.post("/cleanup")
async def trigger_cleanup(background_tasks: BackgroundTasks):
    """
    Manually trigger cleanup of expired files.
    
    This runs automatically but can be triggered manually.
    """
    background_tasks.add_task(cleanup_old_files)
    return {"success": True, "message": "Cleanup scheduled"}
