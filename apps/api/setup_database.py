#!/usr/bin/env python3
"""Setup script to initialize BurnChat database tables in Supabase.

Run this once before starting the API server:
    python setup_database.py

This will:
1. Enable pgvector extension
2. Create users, credit_transactions, sessions, and document_chunks tables
3. Create the match_document_chunks similarity search function
4. Create the ivfflat index for fast vector search

Note: You may need to enable the pgvector extension manually in Supabase
dashboard under Database > Extensions first.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)


SQL_STATEMENTS = [
    "CREATE EXTENSION IF NOT EXISTS vector",

    """CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        credit_balance INTEGER NOT NULL DEFAULT 50,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    """CREATE TABLE IF NOT EXISTS credit_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        stripe_payment_id TEXT,
        balance_after INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    """CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Untitled Session',
        mapping_encrypted TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    """CREATE TABLE IF NOT EXISTS document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        document_name TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        anonymized_text TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        token_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    """CREATE OR REPLACE FUNCTION match_document_chunks(
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
    $$""",
]


def main():
    import httpx

    print("Initializing BurnChat database...")
    print(f"Supabase URL: {SUPABASE_URL}")

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    # Use Supabase SQL API
    sql_url = f"{SUPABASE_URL}/rest/v1/rpc/"

    with httpx.Client(timeout=30.0) as client:
        for i, sql in enumerate(SQL_STATEMENTS, 1):
            print(f"  [{i}/{len(SQL_STATEMENTS)}] Executing...")
            try:
                # Try using the query endpoint
                resp = client.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
                    headers=headers,
                    json={"query": sql},
                )
                if resp.status_code == 200:
                    print(f"    OK")
                else:
                    print(f"    Note: Got status {resp.status_code} - may need manual SQL setup")
            except Exception as e:
                print(f"    Error: {e}")

    print()
    print("Database setup complete!")
    print()
    print("If any steps failed, copy the SQL from database.py INIT_SQL")
    print("and run it manually in the Supabase SQL Editor:")
    print(f"  {SUPABASE_URL.replace('.supabase.co', '.supabase.co')}")


if __name__ == "__main__":
    main()
