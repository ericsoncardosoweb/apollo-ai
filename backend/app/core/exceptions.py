"""
Apollo A.I. Advanced - Custom Exceptions

Application-specific exceptions with proper error handling.
"""

from typing import Any


class ApolloException(Exception):
    """Base exception for Apollo application."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(ApolloException):
    """Authentication failed."""

    def __init__(self, message: str = "Authentication failed", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=401,
            details=details,
        )


class AuthorizationError(ApolloException):
    """Authorization/Permission denied."""

    def __init__(self, message: str = "Permission denied", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="AUTHORIZATION_ERROR",
            status_code=403,
            details=details,
        )


class NotFoundError(ApolloException):
    """Resource not found."""

    def __init__(self, message: str = "Resource not found", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details=details,
        )


class ValidationError(ApolloException):
    """Validation error."""

    def __init__(self, message: str = "Validation failed", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details=details,
        )


class ConflictError(ApolloException):
    """Resource conflict (e.g., duplicate)."""

    def __init__(self, message: str = "Resource conflict", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409,
            details=details,
        )


class RateLimitError(ApolloException):
    """Rate limit exceeded."""

    def __init__(self, message: str = "Rate limit exceeded", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details=details,
        )


class ExternalServiceError(ApolloException):
    """External service (OpenAI, WhatsApp, etc.) error."""

    def __init__(
        self,
        message: str = "External service error",
        service: str = "unknown",
        details: dict[str, Any] | None = None,
    ):
        details = details or {}
        details["service"] = service
        super().__init__(
            message=message,
            code="EXTERNAL_SERVICE_ERROR",
            status_code=502,
            details=details,
        )


class TenantError(ApolloException):
    """Tenant-related error (e.g., suspended, not found)."""

    def __init__(self, message: str = "Tenant error", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="TENANT_ERROR",
            status_code=403,
            details=details,
        )


class QuotaExceededError(ApolloException):
    """Quota/limit exceeded (tokens, messages, etc.)."""

    def __init__(
        self,
        message: str = "Quota exceeded",
        quota_type: str = "unknown",
        details: dict[str, Any] | None = None,
    ):
        details = details or {}
        details["quota_type"] = quota_type
        super().__init__(
            message=message,
            code="QUOTA_EXCEEDED",
            status_code=429,
            details=details,
        )


# Alias for backwards compatibility
TenantNotFoundError = NotFoundError

