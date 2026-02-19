import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import get_supabase
from middleware.auth import get_current_user, get_optional_user
from models.schemas import (
    DocumentInput,
    DocumentSearchRequest,
    DocumentSearchResponse,
    DocumentsProcessRequest,
    DocumentsProcessResponse,
    ChunkResult,
    EntityInfo,
)
from services.anonymization.engine import anonymize
from services.rag.chunker import chunk_text, count_tokens
from services.rag.embedder import embed_texts
from services.rag.retriever import store_chunks, search_chunks

router = APIRouter()


@router.post("/documents/process", response_model=DocumentsProcessResponse)
async def process_documents(
    request: DocumentsProcessRequest,
    user: Optional[dict] = Depends(get_optional_user),
):
    """Anonymize, chunk, embed, and store documents in pgvector.

    If no ``session_id`` is provided a new session is created (requires auth).
    """
    db = get_supabase()
    session_id = request.session_id

    # If no session_id, create a new session (requires auth)
    if not session_id:
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required to create a new session",
            )

        session_row = (
            db.table("sessions")
            .insert({
                "user_id": user["user_id"],
                "name": "Untitled Session",
                "mapping_encrypted": "",
            })
            .execute()
        )

        if not session_row.data:
            raise HTTPException(
                status_code=500, detail="Failed to create session"
            )
        session_id = session_row.data[0]["id"]

    total_chunks = 0
    all_entities: dict[str, int] = {}

    for doc in request.documents:
        # 1. Anonymize the document text
        anon_result = anonymize(doc.text)
        anonymized_text = anon_result["anonymized_text"]

        # Accumulate entity counts
        for entity in anon_result["entities_found"]:
            entity_type = entity["type"]
            all_entities[entity_type] = (
                all_entities.get(entity_type, 0) + entity["count"]
            )

        # 2. Chunk the anonymized text
        chunks = chunk_text(anonymized_text)
        if not chunks:
            continue

        # 3. Compute token counts for each chunk
        token_counts = [count_tokens(chunk) for chunk in chunks]

        # 4. Embed all chunks
        embeddings = await embed_texts(chunks)

        # 5. Store in pgvector
        await store_chunks(
            session_id=session_id,
            document_name=doc.filename,
            chunks=chunks,
            embeddings=embeddings,
            token_counts=token_counts,
        )

        total_chunks += len(chunks)

    entities_found = [
        EntityInfo(type=entity_type, count=count)
        for entity_type, count in all_entities.items()
    ]

    return DocumentsProcessResponse(
        session_id=session_id,
        documents_processed=len(request.documents),
        total_chunks=total_chunks,
        entities_found=entities_found,
    )


@router.post("/documents/search", response_model=DocumentSearchResponse)
async def search_documents(request: DocumentSearchRequest):
    """Embed query and perform pgvector similarity search over document chunks."""
    # 1. Embed the query
    query_embeddings = await embed_texts([request.query])
    if not query_embeddings:
        raise HTTPException(status_code=500, detail="Failed to embed query")

    # 2. Search pgvector for similar chunks
    results = await search_chunks(
        session_id=request.session_id,
        query_embedding=query_embeddings[0],
        top_k=request.top_k,
    )

    # 3. Return results
    chunks = [
        ChunkResult(
            anonymized_text=row["anonymized_text"],
            document_name=row["document_name"],
            chunk_index=row["chunk_index"],
            similarity_score=row["similarity_score"],
        )
        for row in results
    ]

    return DocumentSearchResponse(chunks=chunks)
