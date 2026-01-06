"""
Apollo A.I. Advanced - Enhanced RAG Service
============================================

Production-grade RAG with:
- Complete tenant isolation (NEVER mix data between companies)
- Agent-level knowledge binding
- Multiple source types (documents, instructions, websites)
- Hybrid search (semantic + keyword)
- Reranking for quality
- Source attribution

Best Practices Implemented:
- Paragraph-aware chunking with overlap
- Instruction priority over documents
- Category filtering
- Confidence scoring
"""

import asyncio
import hashlib
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from enum import Enum
from dataclasses import dataclass
import structlog

from app.db.supabase import get_supabase
from app.core.config import settings

logger = structlog.get_logger()


# ===========================================
# ENUMS AND CONFIGURATION
# ===========================================

class DocumentStatus(str, Enum):
    """Document processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceType(str, Enum):
    """Types of knowledge sources"""
    DOCUMENT = "document"      # PDFs, DOCx, etc
    INSTRUCTION = "instruction"  # Manual instructions (always priority)
    WEBSITE = "website"        # Web scraping
    FAQ = "faq"               # Question-Answer pairs
    API_DOC = "api_doc"       # API documentation


class KnowledgeCategory(str, Enum):
    """Knowledge categories for filtering"""
    PRODUCT = "product"        # Product information
    PRICING = "pricing"        # Prices and plans
    POLICY = "policy"          # Terms, policies
    FAQ = "faq"               # Common questions
    PROCESS = "process"        # Business processes
    TECHNICAL = "technical"    # Technical documentation
    GENERAL = "general"        # General info


@dataclass
class RAGConfig:
    """RAG configuration with best practice defaults"""
    CHUNK_SIZE: int = 500         # Characters per chunk
    CHUNK_OVERLAP: int = 100      # Overlap between chunks
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    
    # Search parameters
    TOP_K_INITIAL: int = 20       # Initial retrieval (before reranking)
    TOP_K_FINAL: int = 5          # Final results (after reranking)
    SIMILARITY_THRESHOLD: float = 0.65  # Minimum similarity
    
    # Hybrid search weights
    SEMANTIC_WEIGHT: float = 0.7
    KEYWORD_WEIGHT: float = 0.3


@dataclass
class RetrievedChunk:
    """A retrieved knowledge chunk with metadata"""
    id: str
    content: str
    score: float
    source_title: str
    source_type: str
    is_instruction: bool
    category: Optional[str] = None
    chunk_index: int = 0
    
    def to_context_string(self, include_source: bool = True) -> str:
        """Format for LLM context injection"""
        if include_source:
            source_info = f"[Fonte: {self.source_title}]"
            return f"{source_info}\n{self.content}"
        return self.content


# ===========================================
# RAG SERVICE
# ===========================================

class RAGService:
    """
    Production-grade RAG Service with tenant isolation.
    
    Key Features:
    - STRICT tenant isolation (company data never mixes)
    - Agent-level knowledge binding
    - Multiple ingestion sources
    - Hybrid search with reranking
    - Instruction priority
    """
    
    def __init__(self):
        self._openai_client = None
        self.config = RAGConfig()
    
    @property
    def openai(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client
    
    # ===========================================
    # INGESTION
    # ===========================================
    
    async def ingest_document(
        self,
        tenant_id: str,
        title: str,
        content: str,
        source_type: SourceType = SourceType.DOCUMENT,
        agent_id: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        source_url: Optional[str] = None,
        is_instruction: bool = False,
        priority: int = 0,
    ) -> str:
        """
        Ingest a document into the knowledge base.
        
        Args:
            tenant_id: REQUIRED - Company ID for isolation
            title: Display name of the document
            content: Text content to process
            source_type: Type of source (document, instruction, etc)
            agent_id: Optional - Bind to specific agent (NULL = all agents)
            category: Category for filtering
            tags: Tags for additional filtering
            source_url: Original URL if applicable
            is_instruction: If True, prioritized in search results
            priority: Manual priority (higher = more important)
        
        Returns: document_id
        """
        supabase = get_supabase()
        
        # Hash content to detect duplicates
        content_hash = hashlib.md5(content.encode()).hexdigest()
        
        # Check for duplicate
        existing = supabase.table("knowledge_base").select("id").eq(
            "tenant_id", tenant_id
        ).eq("agent_id", agent_id or "").ilike(
            "description", f"%{content_hash}%"
        ).execute()
        
        if existing.data:
            logger.warning(
                "Duplicate document detected, skipping",
                tenant_id=tenant_id,
                title=title
            )
            return existing.data[0]["id"]
        
        # Create document record
        doc_data = {
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "title": title,
            "description": f"Hash: {content_hash}",
            "source_type": source_type.value,
            "source_url": source_url,
            "status": DocumentStatus.PENDING.value,
            "category": category,
            "tags": tags or [],
            "is_instruction": is_instruction,
            "priority": priority,
        }
        
        doc = supabase.table("knowledge_base").insert(doc_data).execute()
        document_id = doc.data[0]["id"]
        
        logger.info(
            "Document created for ingestion",
            document_id=document_id,
            tenant_id=tenant_id,
            title=title,
            is_instruction=is_instruction
        )
        
        # Process asynchronously
        asyncio.create_task(
            self._process_document(document_id, tenant_id, content)
        )
        
        return document_id
    
    async def ingest_instruction(
        self,
        tenant_id: str,
        title: str,
        instruction: str,
        agent_id: Optional[str] = None,
        category: str = KnowledgeCategory.GENERAL.value,
    ) -> str:
        """
        Ingest a manual instruction (highest priority in search).
        
        Use this for:
        - Business rules
        - Specific guidelines
        - Override behaviors
        """
        return await self.ingest_document(
            tenant_id=tenant_id,
            title=title,
            content=instruction,
            source_type=SourceType.INSTRUCTION,
            agent_id=agent_id,
            category=category,
            is_instruction=True,
            priority=100,  # High priority
        )
    
    async def ingest_faq(
        self,
        tenant_id: str,
        questions_answers: List[Dict[str, str]],
        agent_id: Optional[str] = None,
    ) -> List[str]:
        """
        Ingest FAQ pairs (question + answer).
        
        Each Q&A becomes a separate document for precise matching.
        """
        doc_ids = []
        
        for qa in questions_answers:
            question = qa.get("question", "")
            answer = qa.get("answer", "")
            
            content = f"Pergunta: {question}\n\nResposta: {answer}"
            
            doc_id = await self.ingest_document(
                tenant_id=tenant_id,
                title=f"FAQ: {question[:50]}...",
                content=content,
                source_type=SourceType.FAQ,
                agent_id=agent_id,
                category=KnowledgeCategory.FAQ.value,
                is_instruction=False,
            )
            doc_ids.append(doc_id)
        
        return doc_ids
    
    async def _process_document(
        self,
        document_id: str,
        tenant_id: str,
        content: str,
    ):
        """Background processing: chunk → embed → store"""
        supabase = get_supabase()
        
        try:
            # Update status
            supabase.table("knowledge_base").update({
                "status": DocumentStatus.PROCESSING.value
            }).eq("id", document_id).execute()
            
            # Chunk content
            chunks = self._chunk_text(content)
            
            logger.info(
                "Document chunked",
                document_id=document_id,
                chunk_count=len(chunks)
            )
            
            # Generate embeddings in batches
            batch_size = 20
            all_embeddings = []
            
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                embeddings = await self._generate_embeddings([c["text"] for c in batch])
                all_embeddings.extend(embeddings)
            
            # Store chunks with embeddings
            for idx, (chunk, embedding) in enumerate(zip(chunks, all_embeddings)):
                supabase.table("knowledge_chunks").insert({
                    "knowledge_base_id": document_id,
                    "tenant_id": tenant_id,  # Redundant for RLS performance
                    "content": chunk["text"],
                    "chunk_index": idx,
                    "embedding": embedding,
                    "metadata": chunk["metadata"],
                }).execute()
            
            # Update document status
            supabase.table("knowledge_base").update({
                "status": DocumentStatus.COMPLETED.value,
                "chunk_count": len(chunks),
                "processed_at": datetime.utcnow().isoformat(),
            }).eq("id", document_id).execute()
            
            logger.info(
                "Document processing completed",
                document_id=document_id,
                chunk_count=len(chunks)
            )
            
        except Exception as e:
            logger.error(
                "Document processing failed",
                document_id=document_id,
                error=str(e)
            )
            
            supabase.table("knowledge_base").update({
                "status": DocumentStatus.FAILED.value,
                "error_message": str(e)
            }).eq("id", document_id).execute()
    
    def _chunk_text(self, text: str) -> List[Dict]:
        """
        Intelligent chunking with paragraph awareness.
        
        Returns list of dicts with 'text' and 'metadata'.
        """
        # Split by double newlines (paragraphs)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for para_idx, para in enumerate(paragraphs):
            para_length = len(para)
            
            # If adding this paragraph exceeds chunk size
            if current_length + para_length > self.config.CHUNK_SIZE and current_chunk:
                # Save current chunk
                chunk_text = "\n\n".join(current_chunk)
                chunks.append({
                    "text": chunk_text,
                    "metadata": {
                        "char_count": len(chunk_text),
                        "paragraph_count": len(current_chunk),
                        "chunk_type": "paragraph",
                    }
                })
                
                # Start new chunk with overlap (keep last paragraph)
                if self.config.CHUNK_OVERLAP > 0 and current_chunk:
                    current_chunk = [current_chunk[-1]]
                    current_length = len(current_chunk[0])
                else:
                    current_chunk = []
                    current_length = 0
            
            current_chunk.append(para)
            current_length += para_length
        
        # Last chunk
        if current_chunk:
            chunk_text = "\n\n".join(current_chunk)
            chunks.append({
                "text": chunk_text,
                "metadata": {
                    "char_count": len(chunk_text),
                    "paragraph_count": len(current_chunk),
                    "chunk_type": "paragraph",
                }
            })
        
        return chunks
    
    async def _generate_embeddings(
        self,
        texts: List[str]
    ) -> List[List[float]]:
        """Generate embeddings using OpenAI"""
        response = await self.openai.embeddings.create(
            model=self.config.EMBEDDING_MODEL,
            input=texts,
            dimensions=self.config.EMBEDDING_DIMENSIONS,
        )
        return [item.embedding for item in response.data]
    
    # ===========================================
    # SEARCH / RETRIEVAL
    # ===========================================
    
    async def search(
        self,
        tenant_id: str,
        query: str,
        agent_id: Optional[str] = None,
        categories: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        include_instructions: bool = True,
        use_hybrid: bool = True,
    ) -> List[RetrievedChunk]:
        """
        Search knowledge base with semantic + optional keyword matching.
        
        Args:
            tenant_id: REQUIRED - Company ID (strict isolation)
            query: User's question/query
            agent_id: Filter to specific agent's knowledge
            categories: Filter by categories
            top_k: Number of results (default from config)
            include_instructions: Include manual instructions
            use_hybrid: Use hybrid search (semantic + keyword)
        
        Returns:
            List of RetrievedChunk ordered by relevance
        """
        supabase = get_supabase()
        top_k = top_k or self.config.TOP_K_INITIAL
        
        # Generate query embedding
        embeddings = await self._generate_embeddings([query])
        query_embedding = embeddings[0]
        
        if use_hybrid:
            # Use hybrid search function
            result = supabase.rpc(
                "hybrid_knowledge_search",
                {
                    "query_text": query,
                    "query_embedding": query_embedding,
                    "match_tenant_id": tenant_id,
                    "match_agent_id": agent_id,
                    "match_threshold": self.config.SIMILARITY_THRESHOLD,
                    "match_count": top_k,
                    "keyword_weight": self.config.KEYWORD_WEIGHT,
                    "semantic_weight": self.config.SEMANTIC_WEIGHT,
                }
            ).execute()
        else:
            # Use semantic-only search
            result = supabase.rpc(
                "match_knowledge_chunks",
                {
                    "query_embedding": query_embedding,
                    "match_tenant_id": tenant_id,
                    "match_agent_id": agent_id,
                    "match_threshold": self.config.SIMILARITY_THRESHOLD,
                    "match_count": top_k,
                    "match_categories": categories,
                }
            ).execute()
        
        if not result.data:
            return []
        
        # Convert to RetrievedChunk objects
        chunks = []
        for item in result.data:
            score = item.get("final_score") or item.get("similarity", 0)
            
            chunks.append(RetrievedChunk(
                id=item["id"],
                content=item["content"],
                score=float(score),
                source_title=item.get("source_title", "Unknown"),
                source_type=item.get("source_type", "document"),
                is_instruction=item.get("is_instruction", False),
                category=item.get("category"),
                chunk_index=item.get("chunk_index", 0),
            ))
        
        # Rerank: Instructions first, then by score
        chunks.sort(key=lambda x: (not x.is_instruction, -x.score))
        
        return chunks[:self.config.TOP_K_FINAL]
    
    async def get_context_for_query(
        self,
        tenant_id: str,
        query: str,
        agent_id: Optional[str] = None,
        max_tokens: int = 2000,
        include_sources: bool = True,
    ) -> Tuple[str, List[str]]:
        """
        Get formatted context for LLM prompt injection.
        
        Returns:
            Tuple of (formatted_context, source_titles)
        """
        chunks = await self.search(tenant_id, query, agent_id)
        
        if not chunks:
            return "", []
        
        context_parts = []
        sources = []
        current_tokens = 0
        estimated_tokens_per_char = 0.25
        
        for chunk in chunks:
            chunk_tokens = int(len(chunk.content) * estimated_tokens_per_char)
            
            if current_tokens + chunk_tokens > max_tokens:
                break
            
            context_parts.append(chunk.to_context_string(include_source=include_sources))
            
            if chunk.source_title not in sources:
                sources.append(chunk.source_title)
            
            current_tokens += chunk_tokens
        
        if not context_parts:
            return "", []
        
        formatted = "\n\n---\n\n".join(context_parts)
        return formatted, sources
    
    # ===========================================
    # MANAGEMENT
    # ===========================================
    
    async def delete_document(
        self,
        document_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete a document and all its chunks"""
        supabase = get_supabase()
        
        # Verify ownership
        doc = supabase.table("knowledge_base").select("id").eq(
            "id", document_id
        ).eq("tenant_id", tenant_id).execute()
        
        if not doc.data:
            logger.warning("Document not found or access denied", document_id=document_id)
            return False
        
        # Delete chunks first (FK constraint)
        supabase.table("knowledge_chunks").delete().eq(
            "knowledge_base_id", document_id
        ).execute()
        
        # Delete document
        supabase.table("knowledge_base").delete().eq(
            "id", document_id
        ).execute()
        
        logger.info("Document deleted", document_id=document_id)
        return True
    
    async def get_stats(
        self,
        tenant_id: str,
        agent_id: Optional[str] = None,
    ) -> Dict:
        """Get knowledge base statistics for a tenant"""
        supabase = get_supabase()
        
        query = supabase.table("knowledge_base").select(
            "id, status, is_instruction, category"
        ).eq("tenant_id", tenant_id)
        
        if agent_id:
            query = query.eq("agent_id", agent_id)
        
        result = query.execute()
        
        docs = result.data or []
        
        return {
            "total_documents": len(docs),
            "completed": len([d for d in docs if d["status"] == "completed"]),
            "processing": len([d for d in docs if d["status"] == "processing"]),
            "failed": len([d for d in docs if d["status"] == "failed"]),
            "instructions": len([d for d in docs if d["is_instruction"]]),
            "by_category": self._count_by_key(docs, "category"),
        }
    
    def _count_by_key(self, items: List[Dict], key: str) -> Dict[str, int]:
        """Count items by a key"""
        counts = {}
        for item in items:
            val = item.get(key) or "uncategorized"
            counts[val] = counts.get(val, 0) + 1
        return counts


# ===========================================
# SINGLETON
# ===========================================

_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get singleton RAGService instance"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
