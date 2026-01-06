"""
Apollo A.I. Advanced - Security Utilities

JWT token handling, password hashing, and security helpers.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None
) -> str:
    """Create a JWT refresh token with longer expiration."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)  # 7 days
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


# ===========================================
# CREDENTIAL ENCRYPTION (Fernet)
# ===========================================

_fernet = None


def _get_fernet():
    """Get or create Fernet instance for encryption."""
    global _fernet
    if _fernet is None:
        from cryptography.fernet import Fernet
        
        encryption_key = getattr(settings, 'encryption_key', None)
        if not encryption_key:
            # Fallback to secret_key if no encryption_key is set
            # Convert to valid Fernet key (32 bytes, base64)
            import base64
            import hashlib
            key_bytes = hashlib.sha256(settings.secret_key.encode()).digest()
            encryption_key = base64.urlsafe_b64encode(key_bytes).decode()
        
        _fernet = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
    
    return _fernet


def encrypt_credential(value: str) -> str:
    """
    Encrypt a sensitive credential for storage.
    
    Args:
        value: Plain text credential (e.g., Supabase key)
        
    Returns:
        Encrypted string (base64 encoded)
    """
    if not value:
        return ""
    
    fernet = _get_fernet()
    encrypted = fernet.encrypt(value.encode())
    return encrypted.decode()


def decrypt_credential(encrypted: str) -> str:
    """
    Decrypt a stored credential.
    
    Args:
        encrypted: Encrypted credential string
        
    Returns:
        Plain text credential
    """
    if not encrypted:
        return ""
    
    fernet = _get_fernet()
    decrypted = fernet.decrypt(encrypted.encode())
    return decrypted.decode()


def is_encrypted(value: str) -> bool:
    """Check if a value appears to be encrypted (Fernet format)."""
    if not value:
        return False
    # Fernet tokens start with 'gAAAAA'
    return value.startswith('gAAAAA')
