from fastapi import APIRouter, Depends, HTTPException

from database import get_supabase
from middleware.auth import get_current_user
from models.schemas import (
    SessionCreateRequest,
    SessionDetail,
    SessionInfo,
    SessionSaveMappingRequest,
)

router = APIRouter()


@router.post("/sessions/create")
async def create_session(
    request: SessionCreateRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new session for the authenticated user."""
    db = get_supabase()

    response = (
        db.table("sessions")
        .insert({
            "user_id": user["user_id"],
            "name": request.name,
            "mapping_encrypted": request.mapping_encrypted,
        })
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    return {"session_id": response.data[0]["id"]}


@router.post("/sessions/save-mapping")
async def save_mapping(
    request: SessionSaveMappingRequest,
    user: dict = Depends(get_current_user),
):
    """Update the encrypted mapping for an existing session.

    The caller must own the session.
    """
    db = get_supabase()

    # Verify ownership
    session = (
        db.table("sessions")
        .select("id, user_id")
        .eq("id", request.session_id)
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.data["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to modify this session")

    # Update mapping and touch updated_at
    db.table("sessions").update({
        "mapping_encrypted": request.mapping_encrypted,
        "updated_at": "now()",
    }).eq("id", request.session_id).execute()

    return {"success": True}


@router.get("/sessions/list")
async def list_sessions(user: dict = Depends(get_current_user)):
    """List all sessions belonging to the authenticated user.

    Each session includes a ``document_count`` derived from the number
    of distinct documents in the ``document_chunks`` table.
    """
    db = get_supabase()

    # Fetch sessions for this user
    response = (
        db.table("sessions")
        .select("id, name, created_at, updated_at")
        .eq("user_id", user["user_id"])
        .order("created_at", desc=True)
        .execute()
    )

    sessions = response.data or []
    result: list[dict] = []

    for session in sessions:
        # Count distinct documents per session from document_chunks
        chunks_response = (
            db.table("document_chunks")
            .select("document_name")
            .eq("session_id", session["id"])
            .execute()
        )

        # Count unique document names
        unique_docs = set()
        if chunks_response.data:
            for row in chunks_response.data:
                unique_docs.add(row["document_name"])

        result.append(
            SessionInfo(
                id=session["id"],
                name=session["name"],
                document_count=len(unique_docs),
                created_at=session["created_at"],
                updated_at=session["updated_at"],
            ).model_dump()
        )

    return result


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Get detailed information about a specific session.

    Returns session metadata, grouped documents, and the encrypted mapping.
    The caller must own the session.
    """
    db = get_supabase()

    # Fetch session and verify ownership
    session = (
        db.table("sessions")
        .select("id, name, mapping_encrypted, created_at, user_id")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.data["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")

    # Fetch chunks grouped by document name
    chunks_response = (
        db.table("document_chunks")
        .select("document_name, chunk_index, anonymized_text")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )

    # Group chunks by document name
    documents_map: dict[str, list[dict]] = {}
    if chunks_response.data:
        for row in chunks_response.data:
            doc_name = row["document_name"]
            if doc_name not in documents_map:
                documents_map[doc_name] = []
            documents_map[doc_name].append({
                "chunk_index": row["chunk_index"],
                "anonymized_text": row["anonymized_text"],
            })

    documents = [
        {"document_name": name, "chunks": chunks}
        for name, chunks in documents_map.items()
    ]

    return SessionDetail(
        id=session.data["id"],
        name=session.data["name"],
        documents=documents,
        mapping_encrypted=session.data["mapping_encrypted"],
        created_at=session.data["created_at"],
    ).model_dump()


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a session and all associated document chunks.

    CASCADE on the foreign key handles chunk deletion automatically.
    The caller must own the session.
    """
    db = get_supabase()

    # Verify ownership
    session = (
        db.table("sessions")
        .select("id, user_id")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.data["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this session")

    # Delete session (CASCADE handles document_chunks)
    db.table("sessions").delete().eq("id", session_id).execute()

    return {"success": True}
