"""
Apollo A.I. Advanced - FastAPI Application Entry Point
======================================================

Production-grade FastAPI application with:
- Structured logging (JSON in prod, console in dev)
- Background workers (Message Buffer, Re-engagement Watchdog)
- Tenant context middleware
- Comprehensive exception handling
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from app.core.config import settings
from app.core.exceptions import ApolloException
from app.api.v1 import router as api_v1_router


# ===========================================
# STRUCTURED LOGGING
# ===========================================

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer() if not settings.debug else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


# ===========================================
# LIFESPAN (STARTUP/SHUTDOWN)
# ===========================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler for startup and shutdown events.
    
    Starts background workers:
    - Message Buffer Watchdog (anti-picote)
    - Re-engagement Watchdog (arremate)
    """
    from app.services.message_buffer import get_message_buffer, BufferWatchdog
    from app.services.reengagement import get_reengagement_watchdog
    
    logger.info(
        "Starting Apollo A.I. Advanced API",
        environment=settings.environment,
        debug=settings.debug
    )
    
    # Initialize services
    buffer_service = get_message_buffer()
    reengagement_watchdog = get_reengagement_watchdog()
    
    # Register buffer handler (sends to AI when buffer expires)
    async def handle_buffered_messages(packet):
        """Process buffered messages - send to AI for response and reply via WhatsApp"""
        from app.services.ai_orchestrator import get_ai_orchestrator
        from app.services.whatsapp_sender import get_whatsapp_sender
        
        logger.info(
            "Buffer ready for AI processing",
            chat_id=packet.chat_id,
            message_count=packet.message_count,
            has_audio=packet.has_audio,
            tenant_id=packet.tenant_id
        )
        
        try:
            # Generate AI response
            orchestrator = get_ai_orchestrator()
            response = await orchestrator.process_message_packet(packet)
            
            if response:
                # Send response via WhatsApp
                sender = get_whatsapp_sender()
                result = await sender.send_text(
                    tenant_id=packet.tenant_id,
                    phone=packet.phone,
                    message=response
                )
                
                if result.success:
                    logger.info(
                        "AI response sent",
                        chat_id=packet.chat_id,
                        message_id=result.message_id
                    )
                else:
                    logger.error(
                        "Failed to send AI response",
                        chat_id=packet.chat_id,
                        error=result.error
                    )
        except Exception as e:
            logger.error(
                "Error processing message packet",
                chat_id=packet.chat_id,
                error=str(e)
            )
    
    buffer_service.on_buffer_ready(handle_buffered_messages)
    
    # Register re-engagement handler
    async def handle_reengagement(event):
        """Handle re-engagement trigger - generate contextual follow-up"""
        from app.services.whatsapp_sender import get_whatsapp_sender
        from app.db.supabase import get_supabase
        
        logger.info(
            "Re-engagement triggered",
            conversation_id=event.conversation_id,
            attempt=event.attempt_number,
            silence_minutes=event.silence_duration_minutes
        )
        
        try:
            supabase = get_supabase()
            
            # Get agent's re-engagement prompts
            agent = supabase.table("agents").select(
                "reengagement_prompts"
            ).eq("id", event.agent_id).single().execute()
            
            prompts = agent.data.get("reengagement_prompts", []) if agent.data else []
            
            # Select prompt based on attempt number
            prompt_index = min(event.attempt_number - 1, len(prompts) - 1)
            if prompts and prompt_index >= 0:
                message = prompts[prompt_index]
            else:
                message = "Olá! Ainda posso ajudar com algo?"
            
            # Send re-engagement message
            sender = get_whatsapp_sender()
            result = await sender.send_text(
                tenant_id=event.tenant_id,
                phone=event.phone,
                message=message
            )
            
            if result.success:
                # Save message to database
                supabase.table("messages").insert({
                    "conversation_id": event.conversation_id,
                    "tenant_id": event.tenant_id,
                    "sender_type": "ai",
                    "content": message,
                    "content_type": "text",
                }).execute()
                
                logger.info("Re-engagement message sent", conversation_id=event.conversation_id)
            
        except Exception as e:
            logger.error(
                "Re-engagement failed",
                conversation_id=event.conversation_id,
                error=str(e)
            )
    
    reengagement_watchdog.on_reengagement_needed(handle_reengagement)
    
    # Start background workers
    buffer_watchdog = BufferWatchdog(buffer_service)
    
    try:
        await buffer_watchdog.start()
        await reengagement_watchdog.start()
        logger.info("Background workers started")
    except Exception as e:
        logger.warning(f"Failed to start some workers: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Apollo A.I. Advanced API")
    
    try:
        await buffer_watchdog.stop()
        await reengagement_watchdog.stop()
        logger.info("Background workers stopped")
    except Exception as e:
        logger.warning(f"Error stopping workers: {e}")


# ===========================================
# APP FACTORY
# ===========================================

def create_app() -> FastAPI:
    """Application factory for creating FastAPI app instance."""
    
    app = FastAPI(
        title="Apollo A.I. Advanced API",
        description="""
# Apollo A.I. Advanced API

SaaS Multi-Tenant Platform for AI Conversational Agents.

## Features

- **Multi-tenant Architecture**: Complete data isolation per tenant
- **WhatsApp Integration**: Support for Evolution API, Z-API, Meta Cloud
- **Anti-Picote Buffer**: Aggregates rapid sequential messages
- **Re-engagement (Arremate)**: Automatic follow-up for cold leads
- **RAG Knowledge Base**: Grounded AI responses with document context
- **CRM Integration**: Lead management and pipeline tracking

## Authentication

All endpoints (except webhooks) require JWT authentication via Supabase Auth.
Include the token in the `Authorization: Bearer <token>` header.
        """,
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
    )

    # ===========================================
    # EXCEPTION HANDLERS
    # ===========================================
    
    @app.exception_handler(ApolloException)
    async def apollo_exception_handler(request: Request, exc: ApolloException):
        """Handle all Apollo custom exceptions"""
        logger.warning(
            "Apollo exception",
            error_code=exc.error_code,
            message=exc.message,
            path=request.url.path
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            }
        )
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle FastAPI HTTP exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle unexpected exceptions"""
        logger.error(
            "Unhandled exception",
            error=str(exc),
            path=request.url.path,
            exc_info=True
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred" if not settings.debug else str(exc),
            }
        )

    # ===========================================
    # MIDDLEWARE
    # ===========================================
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ===========================================
    # ROUTES
    # ===========================================
    
    # Include API v1 routers
    app.include_router(api_v1_router, prefix="/api/v1")

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        """
        Health check endpoint for load balancers and monitoring.
        
        Returns service status and version information.
        """
        from app.db.redis import get_redis
        
        redis_ok = False
        try:
            redis = get_redis()
            await redis.client.ping()
            redis_ok = True
        except:
            pass
        
        return {
            "status": "healthy",
            "version": "0.1.0",
            "environment": settings.environment,
            "services": {
                "redis": "connected" if redis_ok else "disconnected",
            }
        }
    
    # Root redirect to docs
    @app.get("/", include_in_schema=False)
    async def root():
        """Redirect root to API docs"""
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/docs" if settings.debug else "/health")

    return app


# ===========================================
# APPLICATION INSTANCE
# ===========================================

app = create_app()
