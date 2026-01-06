"""
Apollo A.I. Advanced - AI Orchestrator
=======================================

The brain of the system. Orchestrates AI interactions including:
- Message processing from buffer
- Context management (memory window)
- RAG knowledge injection
- Tool execution
- Response generation

Architecture:
- Uses LangChain for LLM interactions
- Supports multiple providers (OpenAI, Anthropic)
- Implements conversation memory
- Integrates with RAG for knowledge grounding
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import structlog
import json

from app.schemas.whatsapp import BufferedMessagePacket, StandardMessage
from app.services.rag import get_rag_service
from app.services.prompt_security import (
    get_prompt_security_service,
    PromptSecurityService,
    GuardrailsConfig
)
from app.db.supabase import get_supabase
from app.core.config import settings

logger = structlog.get_logger()


class MessageIntent(str, Enum):
    """Detected message intents"""
    GREETING = "greeting"
    QUESTION = "question"
    PURCHASE_INTENT = "purchase_intent"
    SUPPORT = "support"
    COMPLAINT = "complaint"
    SCHEDULING = "scheduling"
    FAREWELL = "farewell"
    UNKNOWN = "unknown"


class AgentConfig:
    """Loaded agent configuration"""
    
    def __init__(self, data: dict):
        self.id = data.get("id")
        self.tenant_id = data.get("tenant_id")
        self.name = data.get("name")
        self.model_provider = data.get("model_provider", "openai")
        self.model_name = data.get("model_name", "gpt-4o-mini")
        self.temperature = float(data.get("temperature", 0.7))
        self.max_tokens = data.get("max_tokens", 1000)
        self.system_prompt = data.get("system_prompt", "")
        self.greeting_message = data.get("greeting_message")
        self.fallback_message = data.get("fallback_message", "Desculpe, não entendi. Pode reformular?")
        self.handoff_message = data.get("handoff_message", "Vou transferir você para um atendente humano.")
        self.memory_enabled = data.get("memory_enabled", True)
        self.memory_window = data.get("memory_window", 10)
        self.rag_enabled = data.get("rag_enabled", False)
        self.intent_router_enabled = data.get("intent_router_enabled", True)
        
        # Guardrails (Security)
        self.guardrails_enabled = data.get("guardrails_enabled", False)
        self.guardrails_config = GuardrailsConfig(
            enabled=self.guardrails_enabled,
            input_prompt=data.get("guardrails_input_prompt", ""),
            output_prompt=data.get("guardrails_output_prompt", ""),
            blocked_patterns=data.get("guardrails_blocked_patterns"),
            sensitive_patterns=data.get("guardrails_sensitive_patterns"),
            block_message=data.get("guardrails_block_message", "Desculpe, não posso ajudar com esse tipo de solicitação."),
            use_llm_validation=data.get("guardrails_use_llm", True)
        )


class ConversationContext:
    """Context for a conversation including history and metadata"""
    
    def __init__(
        self,
        conversation_id: str,
        lead_id: Optional[str] = None,
        lead_name: Optional[str] = None,
        history: Optional[List[Dict]] = None,
        custom_data: Optional[Dict] = None
    ):
        self.conversation_id = conversation_id
        self.lead_id = lead_id
        self.lead_name = lead_name
        self.history = history or []
        self.custom_data = custom_data or {}
    
    def add_message(self, role: str, content: str):
        """Add a message to history"""
        self.history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_formatted_history(self, window: int = 10) -> List[Dict]:
        """Get last N messages formatted for LLM"""
        return self.history[-window:]


class AIOrchestrator:
    """
    Main AI orchestration service.
    
    Handles the complete flow from receiving a message packet
    to generating and sending the AI response.
    """
    
    def __init__(self):
        self._openai_client = None
        self._rag_service = None
        self._security_service = None
    
    @property
    def openai(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client
    
    @property
    def rag(self):
        """Get RAG service"""
        if self._rag_service is None:
            self._rag_service = get_rag_service()
        return self._rag_service
    
    @property
    def security(self) -> PromptSecurityService:
        """Get Prompt Security service"""
        if self._security_service is None:
            self._security_service = get_prompt_security_service()
        return self._security_service
    
    # ===========================================
    # MAIN PROCESSING FLOW
    # ===========================================
    
    async def process_message_packet(
        self, 
        packet: BufferedMessagePacket
    ) -> Optional[str]:
        """
        Process a buffered message packet and generate AI response.
        
        Flow:
        1. Load agent configuration
        2. Load/create conversation context
        3. Combine packet messages
        4. Detect intent (if enabled)
        5. Fetch RAG context (if enabled)
        6. Generate LLM response
        7. Save to database
        8. Return response for sending
        """
        supabase = get_supabase()
        
        # Step 1: Get or create conversation
        conversation = await self._get_or_create_conversation(
            tenant_id=packet.tenant_id,
            phone=packet.phone,
            chat_id=packet.chat_id
        )
        
        if not conversation:
            logger.error("Failed to get/create conversation", chat_id=packet.chat_id)
            return None
        
        # Check if conversation is in AI mode
        if conversation.get("mode") != "ai":
            logger.info("Conversation not in AI mode, skipping", mode=conversation.get("mode"))
            return None
        
        # Step 2: Load agent configuration
        agent_id = conversation.get("agent_id")
        if not agent_id:
            # Get default agent for tenant
            agent_result = supabase.table("agents").select("*").eq(
                "tenant_id", packet.tenant_id
            ).eq("is_default", True).eq("status", "active").single().execute()
            
            if not agent_result.data:
                logger.warning("No default agent found", tenant_id=packet.tenant_id)
                return None
            
            agent_id = agent_result.data["id"]
        
        agent_result = supabase.table("agents").select("*").eq(
            "id", agent_id
        ).single().execute()
        
        if not agent_result.data:
            logger.error("Agent not found", agent_id=agent_id)
            return None
        
        agent = AgentConfig(agent_result.data)
        
        # Step 3: Load conversation context (history)
        context = await self._load_context(conversation, agent.memory_window)
        
        # Step 4: Combine user messages
        user_message = self._format_user_message(packet)
        context.add_message("user", user_message)
        
        # Step 4.5: Guardrails INPUT check
        if agent.guardrails_enabled:
            input_check = await self.security.check_input(
                message=user_message,
                config=agent.guardrails_config
            )
            if input_check.blocked:
                logger.warning(
                    "Guardrails blocked user input",
                    conversation_id=conversation["id"],
                    reason=input_check.reason.value,
                    pattern=input_check.matched_pattern
                )
                # Save blocked attempt to database
                await self._save_messages(
                    conversation_id=conversation["id"],
                    tenant_id=packet.tenant_id,
                    user_message=user_message,
                    ai_response=agent.guardrails_config.block_message,
                    packet=packet
                )
                return agent.guardrails_config.block_message
        
        # Step 5: Detect intent (if enabled)
        intent = MessageIntent.UNKNOWN
        if agent.intent_router_enabled:
            intent = await self._detect_intent(user_message)
            logger.info("Intent detected", intent=intent.value)
        
        # Step 6: Get RAG context (if enabled)
        rag_context = ""
        if agent.rag_enabled:
            rag_context = await self.rag.get_context_for_query(
                tenant_id=packet.tenant_id,
                query=user_message,
                agent_id=agent.id
            )
            if rag_context:
                logger.info("RAG context retrieved", length=len(rag_context))
        
        # Step 7: Generate response
        response = await self._generate_response(
            agent=agent,
            context=context,
            user_message=user_message,
            rag_context=rag_context,
            intent=intent
        )
        
        # Step 7.5: Guardrails OUTPUT check
        if agent.guardrails_enabled:
            output_check = await self.security.check_output(
                response=response,
                config=agent.guardrails_config
            )
            if output_check.blocked:
                logger.warning(
                    "Guardrails blocked AI output (sensitive data)",
                    conversation_id=conversation["id"],
                    reason=output_check.reason.value,
                    pattern=output_check.matched_pattern
                )
                # Replace response with safe message
                response = agent.guardrails_config.block_message
        
        # Step 8: Save messages to database
        await self._save_messages(
            conversation_id=conversation["id"],
            tenant_id=packet.tenant_id,
            user_message=user_message,
            ai_response=response,
            packet=packet
        )
        
        logger.info(
            "AI response generated",
            conversation_id=conversation["id"],
            response_length=len(response)
        )
        
        return response
    
    # ===========================================
    # CONVERSATION MANAGEMENT
    # ===========================================
    
    async def _get_or_create_conversation(
        self,
        tenant_id: str,
        phone: str,
        chat_id: str
    ) -> Optional[dict]:
        """Get existing conversation or create new one"""
        supabase = get_supabase()
        
        # Try to find existing active conversation
        result = supabase.table("conversations").select("*").eq(
            "tenant_id", tenant_id
        ).eq("phone_number", phone).eq("status", "active").single().execute()
        
        if result.data:
            # Update last message timestamp
            supabase.table("conversations").update({
                "last_message_at": datetime.utcnow().isoformat()
            }).eq("id", result.data["id"]).execute()
            
            return result.data
        
        # Get or create lead
        lead = await self._get_or_create_lead(tenant_id, phone)
        
        # Get default agent
        agent_result = supabase.table("agents").select("id").eq(
            "tenant_id", tenant_id
        ).eq("is_default", True).eq("status", "active").single().execute()
        
        agent_id = agent_result.data["id"] if agent_result.data else None
        
        # Create new conversation
        new_conv = supabase.table("conversations").insert({
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "lead_id": lead.get("id") if lead else None,
            "external_id": chat_id,
            "channel": "whatsapp",
            "phone_number": phone,
            "status": "active",
            "mode": "ai",
            "started_at": datetime.utcnow().isoformat(),
            "last_message_at": datetime.utcnow().isoformat(),
        }).execute()
        
        return new_conv.data[0] if new_conv.data else None
    
    async def _get_or_create_lead(
        self,
        tenant_id: str,
        phone: str
    ) -> Optional[dict]:
        """Get or create a lead for the phone number"""
        supabase = get_supabase()
        
        # Try to find existing lead
        result = supabase.table("crm_leads").select("*").eq(
            "tenant_id", tenant_id
        ).eq("whatsapp", phone).single().execute()
        
        if result.data:
            # Update last contact
            supabase.table("crm_leads").update({
                "last_contact_at": datetime.utcnow().isoformat()
            }).eq("id", result.data["id"]).execute()
            return result.data
        
        # Get first pipeline stage for tenant
        stage = supabase.table("crm_pipeline_stages").select("id").eq(
            "tenant_id", tenant_id
        ).order("position").limit(1).single().execute()
        
        # Create new lead
        new_lead = supabase.table("crm_leads").insert({
            "tenant_id": tenant_id,
            "pipeline_stage_id": stage.data["id"] if stage.data else None,
            "whatsapp": phone,
            "phone": phone,
            "source": "whatsapp",
            "temperature": "warm",
            "status": "new",
        }).execute()
        
        return new_lead.data[0] if new_lead.data else None
    
    async def _load_context(
        self,
        conversation: dict,
        window: int = 10
    ) -> ConversationContext:
        """Load conversation context including message history"""
        supabase = get_supabase()
        
        # Get lead info
        lead_name = None
        lead_id = conversation.get("lead_id")
        
        if lead_id:
            lead = supabase.table("crm_leads").select("name").eq(
                "id", lead_id
            ).single().execute()
            if lead.data:
                lead_name = lead.data.get("name")
        
        # Get message history
        messages = supabase.table("messages").select(
            "sender_type, content"
        ).eq(
            "conversation_id", conversation["id"]
        ).eq(
            "is_deleted", False
        ).order(
            "created_at", desc=False
        ).limit(window * 2).execute()
        
        history = []
        for msg in (messages.data or []):
            role = "assistant" if msg["sender_type"] in ["ai", "agent"] else "user"
            history.append({
                "role": role,
                "content": msg["content"]
            })
        
        return ConversationContext(
            conversation_id=conversation["id"],
            lead_id=lead_id,
            lead_name=lead_name,
            history=history[-window:]
        )
    
    # ===========================================
    # MESSAGE PROCESSING
    # ===========================================
    
    def _format_user_message(self, packet: BufferedMessagePacket) -> str:
        """Format buffered messages into single user message"""
        parts = []
        
        for msg in packet.messages:
            if msg.content_type == "text" and msg.content:
                parts.append(msg.content)
            elif msg.content_type == "audio":
                # Audio transcription placeholder
                parts.append("[Áudio recebido - transcrição pendente]")
            elif msg.content_type == "image":
                caption = msg.content or ""
                parts.append(f"[Imagem recebida]{': ' + caption if caption else ''}")
        
        return "\n".join(parts) if parts else "[Mensagem sem conteúdo de texto]"
    
    async def _detect_intent(self, message: str) -> MessageIntent:
        """Detect the intent of a message using LLM"""
        try:
            response = await self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """Classifique a intenção da mensagem em uma das categorias:
                        - greeting: Saudação ou início de conversa
                        - question: Pergunta sobre produtos/serviços/informações
                        - purchase_intent: Interesse em comprar ou contratar
                        - support: Solicitação de suporte ou ajuda
                        - complaint: Reclamação ou insatisfação
                        - scheduling: Agendamento ou horários
                        - farewell: Despedida ou encerramento
                        - unknown: Não se encaixa em nenhuma categoria
                        
                        Responda APENAS com a categoria, sem explicação."""
                    },
                    {"role": "user", "content": message}
                ],
                max_tokens=20,
                temperature=0
            )
            
            intent_str = response.choices[0].message.content.strip().lower()
            
            try:
                return MessageIntent(intent_str)
            except ValueError:
                return MessageIntent.UNKNOWN
                
        except Exception as e:
            logger.error("Intent detection failed", error=str(e))
            return MessageIntent.UNKNOWN
    
    async def _generate_response(
        self,
        agent: AgentConfig,
        context: ConversationContext,
        user_message: str,
        rag_context: str = "",
        intent: MessageIntent = MessageIntent.UNKNOWN
    ) -> str:
        """Generate AI response using configured LLM"""
        
        # Build system prompt
        system_prompt = agent.system_prompt
        
        # Add customer context
        if context.lead_name:
            system_prompt += f"\n\nNome do cliente: {context.lead_name}"
        
        # Add RAG context
        if rag_context:
            system_prompt += f"""

### Base de Conhecimento
Use as informações abaixo para responder de forma precisa:

{rag_context}

---
Se a informação não estiver na base de conhecimento acima, diga que não tem essa informação no momento."""
        
        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(context.get_formatted_history(agent.memory_window))
        messages.append({"role": "user", "content": user_message})
        
        try:
            response = await self.openai.chat.completions.create(
                model=agent.model_name,
                messages=messages,
                max_tokens=agent.max_tokens,
                temperature=agent.temperature
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error("LLM generation failed", error=str(e))
            return agent.fallback_message
    
    async def _save_messages(
        self,
        conversation_id: str,
        tenant_id: str,
        user_message: str,
        ai_response: str,
        packet: BufferedMessagePacket
    ):
        """Save user and AI messages to database"""
        supabase = get_supabase()
        
        # Save user message
        supabase.table("messages").insert({
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "sender_type": "customer",
            "sender_name": None,
            "content": user_message,
            "content_type": "text" if not packet.has_audio else "mixed",
        }).execute()
        
        # Save AI response
        supabase.table("messages").insert({
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "sender_type": "ai",
            "content": ai_response,
            "content_type": "text",
        }).execute()
        
        # Update conversation message count
        supabase.table("conversations").update({
            "message_count": supabase.table("messages").select("id", count="exact").eq(
                "conversation_id", conversation_id
            ).execute().count,
            "last_message_at": datetime.utcnow().isoformat(),
            "ai_message_count": supabase.table("messages").select("id", count="exact").eq(
                "conversation_id", conversation_id
            ).eq("sender_type", "ai").execute().count
        }).eq("id", conversation_id).execute()


# Singleton instance
_orchestrator: Optional[AIOrchestrator] = None


def get_ai_orchestrator() -> AIOrchestrator:
    """Get singleton AIOrchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AIOrchestrator()
    return _orchestrator
