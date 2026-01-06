"""
Apollo A.I. Advanced - Knowledge Base (RAG) Endpoints
=====================================================

Endpoints for managing knowledge documents, processing PDFs,
and searching the vector store.
"""

import os
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
import structlog

from app.api.deps import CurrentUser, TenantContext, ClientSupabase
from app.services.rag import get_rag_service

logger = structlog.get_logger()
router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


# ===========================================
# Schemas
# ===========================================

class DocumentBase(BaseModel):
    """Base document schema."""
    title: str
    content: Optional[str] = None
    file_type: Optional[str] = None
    agent_id: Optional[UUID] = None


class DocumentCreate(DocumentBase):
    """Document creation schema."""
    pass


class DocumentResponse(BaseModel):
    """Document response schema."""
    id: UUID
    title: str
    content: Optional[str]
    file_url: Optional[str]
    file_type: Optional[str]
    file_size: Optional[int]
    chunk_count: int
    embedding_status: str
    agent_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class FAQCreate(BaseModel):
    """FAQ creation schema."""
    question: str
    answer: str


class FAQBulkCreate(BaseModel):
    """Bulk FAQ creation."""
    agent_id: Optional[UUID] = None
    faqs: List[FAQCreate]


class InstructionCreate(BaseModel):
    """Instruction creation schema."""
    title: str
    instruction: str
    category: Optional[str] = "general"
    agent_id: Optional[UUID] = None


class SearchRequest(BaseModel):
    """RAG search request."""
    query: str
    agent_id: Optional[UUID] = None
    top_k: int = 5
    threshold: float = 0.7


class SearchResult(BaseModel):
    """RAG search result."""
    content: str
    score: float
    source_title: str
    source_type: str
    chunk_index: int


class SearchResponse(BaseModel):
    """RAG search response."""
    results: List[SearchResult]
    query_embedding_time_ms: int
    search_time_ms: int


class KnowledgeStats(BaseModel):
    """Knowledge base statistics."""
    total_documents: int
    total_chunks: int
    completed: int
    processing: int
    pending: int
    failed: int


# ===========================================
# Endpoints
# ===========================================

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    current_user: CurrentUser,
    client_db: ClientSupabase,
    agent_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0
):
    """List knowledge documents with filters."""
    query = client_db.table("knowledge_documents").select("*")
    
    if agent_id:
        query = query.eq("agent_id", str(agent_id))
    
    if status_filter:
        query = query.eq("embedding_status", status_filter)
    
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data or []


@router.get("/stats", response_model=KnowledgeStats)
async def get_knowledge_stats(
    current_user: CurrentUser,
    client_db: ClientSupabase,
    agent_id: Optional[UUID] = None
):
    """Get knowledge base statistics."""
    query = client_db.table("knowledge_documents").select("id, embedding_status, chunk_count")
    
    if agent_id:
        query = query.eq("agent_id", str(agent_id))
    
    result = query.execute()
    docs = result.data or []
    
    total = len(docs)
    completed = sum(1 for d in docs if d.get("embedding_status") == "completed")
    processing = sum(1 for d in docs if d.get("embedding_status") == "processing")
    pending = sum(1 for d in docs if d.get("embedding_status") == "pending")
    failed = sum(1 for d in docs if d.get("embedding_status") == "failed")
    total_chunks = sum(d.get("chunk_count", 0) for d in docs)
    
    return KnowledgeStats(
        total_documents=total,
        total_chunks=total_chunks,
        completed=completed,
        processing=processing,
        pending=pending,
        failed=failed
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get a specific document by ID."""
    result = client_db.table("knowledge_documents").select("*").eq(
        "id", str(document_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return result.data


@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    tenant: TenantContext,
    client_db: ClientSupabase,
    file: UploadFile = File(...),
    title: str = Form(...),
    agent_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None)
):
    """
    Upload a document for RAG processing.
    
    Supports: PDF, TXT, DOCX, MD
    The document will be processed in the background.
    """
    # Validate file type
    allowed_types = {
        "application/pdf": "pdf",
        "text/plain": "txt",
        "text/markdown": "md",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
    }
    
    content_type = file.content_type or ""
    file_type = allowed_types.get(content_type)
    
    if not file_type:
        # Try to infer from filename
        filename = file.filename or ""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext in ["pdf", "txt", "md", "docx"]:
            file_type = ext
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {content_type}. Allowed: PDF, TXT, DOCX, MD"
            )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Upload to storage
    tenant_id = tenant["tenant_id"]
    storage_path = f"knowledge/{tenant_id}/{document_id}/{file.filename}"
    
    # For now, just store metadata (storage upload would be done here)
    document_id = None
    
    # Create document record
    doc_data = {
        "title": title,
        "file_type": file_type,
        "file_size": file_size,
        "embedding_status": "pending",
        "chunk_count": 0,
    }
    
    if agent_id:
        doc_data["agent_id"] = agent_id
    
    result = client_db.table("knowledge_documents").insert(doc_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create document"
        )
    
    document = result.data[0]
    document_id = document["id"]
    
    # Process in background
    background_tasks.add_task(
        process_document,
        client_db,
        document_id,
        file_content,
        file_type,
        tenant_id
    )
    
    logger.info("Document uploaded", document_id=document_id, file_type=file_type)
    return document


async def process_document(client_db, document_id: str, content: bytes, file_type: str, tenant_id: str):
    """Background task to process document for RAG."""
    try:
        # Update status to processing
        client_db.table("knowledge_documents").update({
            "embedding_status": "processing"
        }).eq("id", document_id).execute()
        
        # Get RAG service
        rag_service = get_rag_service()
        
        # Extract text based on file type
        if file_type == "pdf":
            text = await rag_service.extract_pdf_text(content)
        elif file_type == "txt" or file_type == "md":
            text = content.decode("utf-8")
        elif file_type == "docx":
            text = await rag_service.extract_docx_text(content)
        else:
            text = content.decode("utf-8", errors="ignore")
        
        # Chunk and embed
        chunks = rag_service.chunk_text(text)
        
        # Store chunks with embeddings
        for i, chunk in enumerate(chunks):
            embedding = await rag_service.get_embedding(chunk)
            
            client_db.table("knowledge_chunks").insert({
                "knowledge_document_id": document_id,
                "content": chunk,
                "chunk_index": i,
                "embedding": embedding,
            }).execute()
        
        # Update document status
        client_db.table("knowledge_documents").update({
            "embedding_status": "completed",
            "chunk_count": len(chunks),
            "content": text[:5000]  # Store first 5000 chars as preview
        }).eq("id", document_id).execute()
        
        logger.info("Document processed", document_id=document_id, chunks=len(chunks))
        
    except Exception as e:
        logger.error("Document processing failed", document_id=document_id, error=str(e))
        client_db.table("knowledge_documents").update({
            "embedding_status": "failed"
        }).eq("id", document_id).execute()


@router.post("/instructions", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def add_instruction(
    instruction: InstructionCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    tenant: TenantContext,
    client_db: ClientSupabase
):
    """
    Add a manual instruction to the knowledge base.
    
    Instructions are text-based rules that guide the AI behavior.
    """
    doc_data = {
        "title": instruction.title,
        "content": instruction.instruction,
        "file_type": "instruction",
        "embedding_status": "pending",
        "chunk_count": 0,
    }
    
    if instruction.agent_id:
        doc_data["agent_id"] = str(instruction.agent_id)
    
    result = client_db.table("knowledge_documents").insert(doc_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create instruction"
        )
    
    document = result.data[0]
    
    # Process in background
    background_tasks.add_task(
        process_instruction,
        client_db,
        document["id"],
        instruction.instruction,
        tenant["tenant_id"]
    )
    
    return document


async def process_instruction(client_db, document_id: str, text: str, tenant_id: str):
    """Background task to process instruction."""
    try:
        client_db.table("knowledge_documents").update({
            "embedding_status": "processing"
        }).eq("id", document_id).execute()
        
        rag_service = get_rag_service()
        
        # Instructions are usually short, so we may not need to chunk
        chunks = rag_service.chunk_text(text) if len(text) > 500 else [text]
        
        for i, chunk in enumerate(chunks):
            embedding = await rag_service.get_embedding(chunk)
            
            client_db.table("knowledge_chunks").insert({
                "knowledge_document_id": document_id,
                "content": chunk,
                "chunk_index": i,
                "embedding": embedding,
            }).execute()
        
        client_db.table("knowledge_documents").update({
            "embedding_status": "completed",
            "chunk_count": len(chunks)
        }).eq("id", document_id).execute()
        
        logger.info("Instruction processed", document_id=document_id)
        
    except Exception as e:
        logger.error("Instruction processing failed", document_id=document_id, error=str(e))
        client_db.table("knowledge_documents").update({
            "embedding_status": "failed"
        }).eq("id", document_id).execute()


@router.post("/faqs", status_code=status.HTTP_201_CREATED)
async def add_faqs(
    faqs: FAQBulkCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    tenant: TenantContext,
    client_db: ClientSupabase
):
    """
    Add multiple FAQs to the knowledge base.
    
    FAQs are question-answer pairs that help the AI respond to common queries.
    """
    created_docs = []
    
    for faq in faqs.faqs:
        # Format FAQ as Q&A
        content = f"Pergunta: {faq.question}\nResposta: {faq.answer}"
        
        doc_data = {
            "title": f"FAQ: {faq.question[:50]}...",
            "content": content,
            "file_type": "faq",
            "embedding_status": "pending",
            "chunk_count": 0,
        }
        
        if faqs.agent_id:
            doc_data["agent_id"] = str(faqs.agent_id)
        
        result = client_db.table("knowledge_documents").insert(doc_data).execute()
        
        if result.data:
            doc = result.data[0]
            created_docs.append(doc)
            
            # Process in background
            background_tasks.add_task(
                process_instruction,
                client_db,
                doc["id"],
                content,
                tenant["tenant_id"]
            )
    
    logger.info("FAQs added", count=len(created_docs))
    return {"message": f"Created {len(created_docs)} FAQs", "documents": created_docs}


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(
    request: SearchRequest,
    current_user: CurrentUser,
    tenant: TenantContext,
    client_db: ClientSupabase
):
    """
    Search the knowledge base using semantic similarity.
    
    Returns the most relevant chunks based on the query.
    """
    import time
    
    rag_service = get_rag_service()
    
    # Get query embedding
    start_embed = time.time()
    query_embedding = await rag_service.get_embedding(request.query)
    embed_time = int((time.time() - start_embed) * 1000)
    
    # Search using vector similarity
    start_search = time.time()
    
    # Build the RPC call for vector search
    # This assumes a function `match_knowledge_chunks` exists in the client DB
    try:
        search_params = {
            "query_embedding": query_embedding,
            "match_threshold": request.threshold,
            "match_count": request.top_k
        }
        
        if request.agent_id:
            search_params["p_agent_id"] = str(request.agent_id)
        
        result = client_db.rpc("match_knowledge_chunks", search_params).execute()
        
        search_time = int((time.time() - start_search) * 1000)
        
        # Format results
        results = []
        for item in result.data or []:
            results.append(SearchResult(
                content=item["content"],
                score=item["similarity"],
                source_title=item.get("title", "Unknown"),
                source_type=item.get("file_type", "document"),
                chunk_index=item.get("chunk_index", 0)
            ))
        
        return SearchResponse(
            results=results,
            query_embedding_time_ms=embed_time,
            search_time_ms=search_time
        )
        
    except Exception as e:
        logger.error("Knowledge search failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Delete a knowledge document and its chunks."""
    # Delete chunks first (cascade should handle this, but let's be explicit)
    client_db.table("knowledge_chunks").delete().eq(
        "knowledge_document_id", str(document_id)
    ).execute()
    
    # Delete document
    result = client_db.table("knowledge_documents").delete().eq(
        "id", str(document_id)
    ).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    logger.info("Document deleted", document_id=str(document_id))


@router.post("/{document_id}/reprocess", status_code=status.HTTP_202_ACCEPTED)
async def reprocess_document(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    tenant: TenantContext,
    client_db: ClientSupabase
):
    """
    Reprocess a failed document.
    
    Clears existing chunks and reprocesses the document.
    """
    # Get document
    result = client_db.table("knowledge_documents").select("*").eq(
        "id", str(document_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    doc = result.data
    
    # Clear existing chunks
    client_db.table("knowledge_chunks").delete().eq(
        "knowledge_document_id", str(document_id)
    ).execute()
    
    # Reset status
    client_db.table("knowledge_documents").update({
        "embedding_status": "pending",
        "chunk_count": 0
    }).eq("id", str(document_id)).execute()
    
    # Reprocess based on content type
    if doc.get("content"):
        background_tasks.add_task(
            process_instruction,
            client_db,
            str(document_id),
            doc["content"],
            tenant["tenant_id"]
        )
    
    return {"message": "Document queued for reprocessing"}
