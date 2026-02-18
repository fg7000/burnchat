from database import get_supabase


async def store_chunks(
    session_id: str,
    document_name: str,
    chunks: list[str],
    embeddings: list[list[float]],
    token_counts: list[int],
) -> None:
    """Store document chunks with their embeddings in the document_chunks table.

    Args:
        session_id: The session this document belongs to.
        document_name: The name of the source document.
        chunks: The anonymized text chunks.
        embeddings: The embedding vector for each chunk.
        token_counts: The token count for each chunk.
    """
    db = get_supabase()

    rows = [
        {
            "session_id": session_id,
            "document_name": document_name,
            "chunk_index": idx,
            "anonymized_text": chunk,
            "embedding": embedding,
            "token_count": token_count,
        }
        for idx, (chunk, embedding, token_count) in enumerate(
            zip(chunks, embeddings, token_counts)
        )
    ]

    db.table("document_chunks").insert(rows).execute()


async def search_chunks(
    session_id: str,
    query_embedding: list[float],
    top_k: int = 10,
) -> list[dict]:
    """Search for the most similar document chunks using cosine similarity.

    Calls the ``match_document_chunks`` Postgres function via Supabase RPC.
    The function is expected to accept the embedding vector, a session filter,
    and a match count, and return rows ordered by cosine similarity (descending).

    Args:
        session_id: Restrict results to chunks belonging to this session.
        query_embedding: The embedding vector of the query text.
        top_k: Maximum number of results to return.

    Returns:
        A list of dicts, each containing ``anonymized_text``,
        ``document_name``, ``chunk_index``, and ``similarity_score``.
    """
    db = get_supabase()

    result = db.rpc(
        "match_document_chunks",
        {
            "query_embedding": query_embedding,
            "filter_session_id": session_id,
            "match_count": top_k,
        },
    ).execute()

    return [
        {
            "anonymized_text": row["anonymized_text"],
            "document_name": row["document_name"],
            "chunk_index": row["chunk_index"],
            "similarity_score": row["similarity"],
        }
        for row in result.data
    ]
