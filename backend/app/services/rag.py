"""
Apollo A.I. Advanced - RAG (Retrieval-Augmented Generation) Service
===================================================================

Handles document ingestion, chunking, embedding, and retrieval
for reducing AI hallucinations with grounded knowledge.

Pipeline:
1. Upload document → Signed URL in Supabase Storage
2. Background worker extracts text
3. Intelligent chunking (semantic + size-based)
4. Generate embeddings via OpenAI
5. Store in Supabase pgvector
6. Query with similarity search during conversations
"""

import asyncio
import hashlib
from datetime import datetime
from typing import Optional, List, Tuple
from enum import Enum
import structlog

from app.db.supabase import get_supabase
from app.core.config import settings

logger = structlog.get_logger()


class DocumentStatus(str, Enum):
    """Document processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ChunkingStrategy(str, Enum):
    """Text chunking strategies"""
    FIXED_SIZE = "fixed_size"
    SEMANTIC = "semantic"
    PARAGRAPH = "paragraph"


class RAGConfig:
    """RAG configuration"""
    CHUNK_SIZE = 500  # tokens/characters
    CHUNK_OVERLAP = 50
    EMBEDDING_MODEL = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS = 1536
    TOP_K_RESULTS = 5
    SIMILARITY_THRESHOLD = 0.7


class RAGService:
    """
    RAG (Retrieval-Augmented Generation) Service
    
    Provides document ingestion, embedding, and semantic search
    capabilities for grounding AI responses in factual content.
    """
    
    def __init__(self):
        self._openai_client = None
    
    @property
    def openai(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client
    
    # ===========================================
    # DOCUMENT INGESTION
    # ===========================================
    
    async def ingest_document(
        self,
        tenant_id: str,
        agent_id: Optional[str],
        title: str,
        content: str,
        source_type: str = "text",
        source_url: Optional[str] = None,
    ) -> str:
        """
        Ingest a document into the knowledge base.
        
        This is the main entry point for adding knowledge.
        Processing happens asynchronously.
        
        Returns: document_id
        """
        supabase = get_supabase()
        
        # Create document record
        doc = supabase.table("knowledge_base").insert({
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "title": title,
            "description": f"Ingested from {source_type}",
            "source_type": source_type,
            "source_url": source_url,
            "status": DocumentStatus.PENDING.value,
        }).execute()
        
        document_id = doc.data[0]["id"]
        
        logger.info(
            "Document created for ingestion",
            document_id=document_id,
            title=title
        )
        
        # Process asynchronously
        asyncio.create_task(
            self._process_document(document_id, tenant_id, content)
        )
        
        return document_id
    
    async def _process_document(
        self,
        document_id: str,
        tenant_id: str,
        content: str,
    ):
        """
        Background task to process document.
        
        1. Update status to processing
        2. Chunk the content
        3. Generate embeddings
        4. Store chunks with embeddings
        5. Update status to completed
        """
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
                embeddings = await self._generate_embeddings([c[0] for c in batch])
                all_embeddings.extend(embeddings)
            
            # Store chunks with embeddings
            for idx, ((chunk_text, metadata), embedding) in enumerate(zip(chunks, all_embeddings)):
                supabase.table("knowledge_chunks").insert({
                    "knowledge_base_id": document_id,
                    "tenant_id": tenant_id,
                    "content": chunk_text,
                    "chunk_index": idx,
                    "embedding": embedding,
                    "metadata": metadata,
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
    
    def _chunk_text(
        self,
        text: str,
        chunk_size: int = RAGConfig.CHUNK_SIZE,
        overlap: int = RAGConfig.CHUNK_OVERLAP
    ) -> List[Tuple[str, dict]]:
        """
        Split text into overlapping chunks.
        
        Uses paragraph-aware chunking for better context preservation.
        
        Returns: List of (chunk_text, metadata) tuples
        """
        # Split by paragraphs first
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for para in paragraphs:
            para_length = len(para)
            
            if current_length + para_length > chunk_size and current_chunk:
                # Save current chunk
                chunk_text = "\n\n".join(current_chunk)
                chunks.append((chunk_text, {
                    "char_count": len(chunk_text),
                    "paragraph_count": len(current_chunk),
                }))
                
                # Start new chunk with overlap
                # Keep last paragraph for context
                if overlap > 0 and current_chunk:
                    current_chunk = [current_chunk[-1]]
                    current_length = len(current_chunk[0])
                else:
                    current_chunk = []
                    current_length = 0
            
            current_chunk.append(para)
            current_length += para_length
        
        # Don't forget the last chunk
        if current_chunk:
            chunk_text = "\n\n".join(current_chunk)
            chunks.append((chunk_text, {
                "char_count": len(chunk_text),
                "paragraph_count": len(current_chunk),
            }))
        
        return chunks
    
    async def _generate_embeddings(
        self,
        texts: List[str]
    ) -> List[List[float]]:
        """Generate embeddings for a list of texts using OpenAI"""
        response = await self.openai.embeddings.create(
            model=RAGConfig.EMBEDDING_MODEL,
            input=texts,
            dimensions=RAGConfig.EMBEDDING_DIMENSIONS,
        )
        
        return [item.embedding for item in response.data]
    
    # ===========================================
    # RETRIEVAL
    # ===========================================
    
    async def search(
        self,
        tenant_id: str,
        query: str,
        agent_id: Optional[str] = None,
        top_k: int = RAGConfig.TOP_K_RESULTS,
        threshold: float = RAGConfig.SIMILARITY_THRESHOLD,
    ) -> List[dict]:
        """
        Search for relevant chunks using semantic similarity.
        
        Uses pgvector's cosine similarity for efficient search.
        
        Returns: List of relevant chunks with scores
        """
        supabase = get_supabase()
        
        # Generate query embedding
        embeddings = await self._generate_embeddings([query])
        query_embedding = embeddings[0]
        
        # Use Supabase RPC for vector similarity search
        # This requires a function in Supabase:
        result = supabase.rpc(
            "match_knowledge_chunks",
            {
                "query_embedding": query_embedding,
                "match_tenant_id": tenant_id,
                "match_agent_id": agent_id,
                "match_threshold": threshold,
                "match_count": top_k,
            }
        ).execute()
        
        return result.data or []
    
    async def get_context_for_query(
        self,
        tenant_id: str,
        query: str,
        agent_id: Optional[str] = None,
        max_tokens: int = 2000,
    ) -> str:
        """
        Get formatted context for AI prompt injection.
        
        Returns a string of relevant knowledge chunks,
        formatted for inclusion in the system prompt.
        """
        chunks = await self.search(tenant_id, query, agent_id)
        
        if not chunks:
            return ""
        
        context_parts = []
        current_tokens = 0
        estimated_tokens_per_char = 0.25
        
        for chunk in chunks:
            chunk_tokens = int(len(chunk.get("content", "")) * estimated_tokens_per_char)
            
            if current_tokens + chunk_tokens > max_tokens:
                break
            
            context_parts.append(chunk.get("content", ""))
            current_tokens += chunk_tokens
        
        if not context_parts:
            return ""
        
        return "\n\n---\n\n".join(context_parts)


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get singleton RAGService instance"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
