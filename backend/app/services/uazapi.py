"""
Apollo A.I. Advanced - UAZAPI Service
======================================

Service for managing UAZAPI WhatsApp connections.
Handles:
- Instance creation
- QR code generation
- Connection status
- Sending messages
"""

from typing import Optional, Literal
from datetime import datetime
import httpx
import structlog
from pydantic import BaseModel

from app.core.config import settings
from app.db.supabase import get_supabase

logger = structlog.get_logger()


# ===========================================
# MODELS
# ===========================================

class UAZAPIConfig(BaseModel):
    """UAZAPI connection configuration per tenant"""
    api_url: str
    api_token: str
    instance_id: Optional[str] = None
    instance_name: Optional[str] = None
    is_connected: bool = False


class UAZAPIQRCode(BaseModel):
    """QR Code response"""
    qrcode: Optional[str] = None  # Base64 or data URL
    status: str = "disconnected"
    message: Optional[str] = None


class UAZAPISendResult(BaseModel):
    """Send message result"""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


# ===========================================
# UAZAPI SERVICE
# ===========================================

class UAZAPIService:
    """
    Service for interacting with UAZAPI.
    
    Each tenant has its own UAZAPI configuration stored in the database.
    The service manages:
    - Creating WhatsApp instances
    - Generating QR codes for connection
    - Sending messages
    - Checking connection status
    """
    
    def __init__(self, config: UAZAPIConfig):
        self.config = config
        self.base_url = config.api_url.rstrip('/')
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_token}"
        }
    
    # ===========================================
    # INSTANCE MANAGEMENT
    # ===========================================
    
    async def create_instance(self, instance_name: str) -> dict:
        """
        Create a new WhatsApp instance.
        Returns the instance ID.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/instance/create",
                headers=self.headers,
                json={"name": instance_name}
            )
            
            if response.status_code not in [200, 201]:
                logger.error(
                    "Failed to create UAZAPI instance",
                    status=response.status_code,
                    response=response.text
                )
                return {"error": response.text}
            
            data = response.json()
            logger.info("UAZAPI instance created", data=data)
            return data
    
    async def get_qr_code(self) -> UAZAPIQRCode:
        """
        Get QR code for connecting WhatsApp.
        The QR code should be displayed to the user for scanning.
        """
        if not self.config.instance_id:
            return UAZAPIQRCode(
                status="error",
                message="No instance configured"
            )
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/instance/{self.config.instance_id}/qrcode",
                    headers=self.headers,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return UAZAPIQRCode(
                        qrcode=data.get("qrcode") or data.get("qr"),
                        status=data.get("status", "awaiting_scan"),
                        message="Escaneie o QR code com seu WhatsApp"
                    )
                elif response.status_code == 404:
                    return UAZAPIQRCode(
                        status="not_found",
                        message="Instância não encontrada"
                    )
                else:
                    return UAZAPIQRCode(
                        status="error",
                        message=f"Erro ao obter QR code: {response.text}"
                    )
            except Exception as e:
                logger.error("UAZAPI QR code error", error=str(e))
                return UAZAPIQRCode(
                    status="error",
                    message=str(e)
                )
    
    async def check_connection_status(self) -> dict:
        """Check if the WhatsApp instance is connected"""
        if not self.config.instance_id:
            return {"connected": False, "status": "no_instance"}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/instance/{self.config.instance_id}/status",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "connected": data.get("connected", False),
                        "status": data.get("status", "unknown"),
                        "phone": data.get("phone"),
                        "name": data.get("name")
                    }
                else:
                    return {"connected": False, "status": "error"}
                    
            except Exception as e:
                logger.error("UAZAPI status check error", error=str(e))
                return {"connected": False, "status": "error", "error": str(e)}
    
    async def configure_webhook(self, webhook_url: str) -> bool:
        """
        Configure webhook URL for this instance.
        UAZAPI will send all events to this URL.
        """
        if not self.config.instance_id:
            return False
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/instance/{self.config.instance_id}/webhook",
                    headers=self.headers,
                    json={
                        "url": webhook_url,
                        "events": [
                            "messages",
                            "messages.upsert",
                            "connection.update",
                            "qrcode"
                        ]
                    }
                )
                
                success = response.status_code in [200, 201]
                if success:
                    logger.info("UAZAPI webhook configured", url=webhook_url)
                else:
                    logger.error(
                        "Failed to configure UAZAPI webhook",
                        status=response.status_code,
                        response=response.text
                    )
                return success
                
            except Exception as e:
                logger.error("UAZAPI webhook config error", error=str(e))
                return False
    
    # ===========================================
    # MESSAGING
    # ===========================================
    
    async def send_text(
        self,
        phone: str,
        message: str,
        reply_to: Optional[str] = None
    ) -> UAZAPISendResult:
        """Send a text message via UAZAPI"""
        if not self.config.instance_id:
            return UAZAPISendResult(
                success=False,
                error="No instance configured"
            )
        
        # Normalize phone number
        phone = phone.replace("+", "").replace("-", "").replace(" ", "")
        if not phone.endswith("@s.whatsapp.net"):
            phone = f"{phone}@s.whatsapp.net"
        
        payload = {
            "number": phone,
            "text": message
        }
        
        if reply_to:
            payload["replyTo"] = reply_to
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/message/send-text/{self.config.instance_id}",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    return UAZAPISendResult(
                        success=True,
                        message_id=data.get("messageId") or data.get("id")
                    )
                else:
                    return UAZAPISendResult(
                        success=False,
                        error=f"HTTP {response.status_code}: {response.text}"
                    )
                    
            except Exception as e:
                logger.error("UAZAPI send error", error=str(e))
                return UAZAPISendResult(
                    success=False,
                    error=str(e)
                )


# ===========================================
# FACTORY FUNCTION
# ===========================================

async def get_uazapi_service_for_tenant(tenant_id: str) -> Optional[UAZAPIService]:
    """
    Get UAZAPI service configured for a specific tenant.
    Loads configuration from database.
    """
    supabase = get_supabase()
    
    # Fetch tenant's UAZAPI configuration
    result = supabase.table("tenants").select(
        "whatsapp_gateway, whatsapp_api_url, whatsapp_api_key, whatsapp_instance_id"
    ).eq("id", tenant_id).single().execute()
    
    if not result.data:
        return None
    
    tenant = result.data
    
    # Check if tenant uses UAZAPI
    if tenant.get("whatsapp_gateway") != "uazapi":
        return None
    
    config = UAZAPIConfig(
        api_url=tenant.get("whatsapp_api_url", ""),
        api_token=tenant.get("whatsapp_api_key", ""),
        instance_id=tenant.get("whatsapp_instance_id")
    )
    
    if not config.api_url or not config.api_token:
        logger.warning("UAZAPI not configured for tenant", tenant_id=tenant_id)
        return None
    
    return UAZAPIService(config)
