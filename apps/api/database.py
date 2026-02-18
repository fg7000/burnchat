import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


# SQL for all tables and functions
INIT_SQL = """
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    credit_balance INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    stripe_payment_id TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled Session',
    mapping_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    anonymized_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    token_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search function for RAG retrieval
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1536),
    filter_session_id UUID,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    document_name TEXT,
    chunk_index INT,
    anonymized_text TEXT,
    token_count INT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.session_id,
        dc.document_name,
        dc.chunk_index,
        dc.anonymized_text,
        dc.token_count,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE dc.session_id = filter_session_id
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
"""


async def init_database():
    """Create tables and functions if they don't exist.

    Uses Supabase's REST API to execute SQL via RPC. If the exec_sql
    function isn't available (common), we silently skip — tables should
    be created by running setup_database.py or via the Supabase SQL editor.
    """
    import httpx

    # Try using the Supabase REST API to run raw SQL
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    # Use the Supabase SQL endpoint (available with service key)
    sql_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try each statement individually for better error handling
            for statement in INIT_SQL.split(";"):
                statement = statement.strip()
                if not statement or statement.startswith("--"):
                    continue
                try:
                    await client.post(
                        sql_url,
                        headers=headers,
                        json={"query": statement + ";"},
                    )
                except Exception:
                    pass
    except Exception:
        # Database setup may need to be run manually via setup_database.py
        print("Note: Could not auto-initialize database tables.")
        print("Run 'python setup_database.py' to create tables, or use the Supabase SQL editor.")
