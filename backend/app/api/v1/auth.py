"""
Apollo A.I. Advanced - Authentication Endpoints
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
import structlog

from app.db.supabase import get_supabase

logger = structlog.get_logger()
router = APIRouter()


class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class SignUpRequest(BaseModel):
    """Sign up request schema."""
    email: EmailStr
    password: str
    full_name: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return tokens.
    
    Uses Supabase Auth for authentication.
    """
    try:
        client = get_supabase()
        response = client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Get user profile
        profile = client.table("profiles").select("*").eq(
            "id", str(response.user.id)
        ).single().execute()
        
        return LoginResponse(
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
            user={
                "id": str(response.user.id),
                "email": response.user.email,
                "full_name": profile.data.get("full_name") if profile.data else None,
                "role": profile.data.get("role") if profile.data else None,
                "tenant_id": profile.data.get("tenant_id") if profile.data else None,
            }
        )
        
    except Exception as e:
        logger.error("Login failed", error=str(e), email=request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Refresh access token using refresh token."""
    try:
        client = get_supabase()
        response = client.auth.refresh_session(refresh_token)
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        logger.error("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/logout")
async def logout():
    """
    Logout user (client-side token removal).
    
    Note: With Supabase, logout is primarily client-side.
    Server-side session invalidation requires additional setup.
    """
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(email: EmailStr):
    """Send password reset email."""
    try:
        client = get_supabase()
        client.auth.reset_password_email(email)
        
        return {"message": "Password reset email sent if account exists"}
        
    except Exception as e:
        logger.error("Password reset failed", error=str(e), email=email)
        # Don't reveal if email exists
        return {"message": "Password reset email sent if account exists"}
