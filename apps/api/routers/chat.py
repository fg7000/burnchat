import json
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from middleware.auth import get_optional_user
from models.schemas import ChatRequest
from services.rag.embedder import embed_texts
from services.rag.retriever import search_chunks

router = APIRouter()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-4o-mini"

SYSTEM_PROMPT = (
    "You are a helpful AI assistant. Answer questions directly and thoroughly. "
    "Treat all names, locations, and details in the conversation as real. "
    "Never mention anonymization, pseudonymization, placeholders, or data masking."
)


async def _verify_session_token(session_token: str) -> dict:
    """Decode a session JWT and check the user has credits remaining."""
    import jwt
    from database import get_supabase

    secret = os.getenv("JWT_SECRET", "")
    try:
        payload = jwt.decode(session_token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token payload")

    db = get_supabase()
    response = (
        db.table("users")
        .select("credit_balance")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    balance = response.data["credit_balance"]
    if balance <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    return {"user_id": user_id, "credit_balance": balance}


async def _deduct_credits(user_id: str, prompt_tokens: int, completion_tokens: int, model: str = "openai/gpt-4o-mini") -> dict:
    """Calculate token usage cost using model pricing with 1.5x margin and deduct credits.

    Returns a dict with usage information.
    """
    from database import get_supabase
    from services.model_selection.cost_calculator import estimate_credits

    total_tokens = prompt_tokens + completion_tokens
    credits_used = estimate_credits(model, prompt_tokens, completion_tokens)

    db = get_supabase()

    # Get current balance
    response = (
        db.table("users")
        .select("credit_balance")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not response.data:
        return {"credits_used": credits_used, "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens, "total_tokens": total_tokens}

    new_balance = max(0, response.data["credit_balance"] - credits_used)

    # Update balance
    db.table("users").update({"credit_balance": new_balance}).eq("id", user_id).execute()

    # Record transaction
    db.table("credit_transactions").insert({
        "user_id": user_id,
        "type": "chat",
        "amount": -credits_used,
        "description": f"Chat completion: {total_tokens} tokens",
        "balance_after": new_balance,
    }).execute()

    return {
        "credits_used": credits_used,
        "credit_balance": new_balance,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }


@router.post("/chat")
async def chat(
    request: ChatRequest,
    user: Optional[dict] = Depends(get_optional_user),
):
    """SSE streaming chat proxy through OpenRouter.

    Supports optional RAG context injection when a session_id is provided
    and optional anonymized document injection.
    """
    authenticated_user: Optional[dict] = None

    # 1. If session_token provided, verify JWT and check credits
    if request.session_token:
        authenticated_user = await _verify_session_token(request.session_token)
    elif user:
        authenticated_user = user

    # 2. Default model
    model = request.model or DEFAULT_MODEL

    # 3. Build system message parts
    system_parts: list[str] = [SYSTEM_PROMPT]

    # 4. RAG context: embed last user message, search pgvector, inject
    if request.session_id:
        last_user_message = None
        for msg in reversed(request.messages):
            if msg.role == "user":
                last_user_message = msg.content
                break

        if last_user_message:
            query_embeddings = await embed_texts([last_user_message])
            if query_embeddings:
                chunks = await search_chunks(
                    session_id=request.session_id,
                    query_embedding=query_embeddings[0],
                    top_k=10,
                )
                if chunks:
                    chunk_texts = "\n\n".join(
                        chunk["anonymized_text"] for chunk in chunks
                    )
                    system_parts.append(
                        f"Here are the most relevant sections from the uploaded documents:\n\n{chunk_texts}"
                    )

    # 5. If anonymized_document provided, inject into system message
    if request.anonymized_document:
        system_parts.append(request.anonymized_document)

    # 6. Construct messages for OpenRouter
    system_message = "\n\n".join(system_parts)
    messages = [{"role": "system", "content": system_message}]
    messages.extend(
        {"role": msg.role, "content": msg.content} for msg in request.messages
    )

    # 7. Stream response from OpenRouter via SSE
    async def event_generator():
        prompt_tokens = 0
        completion_tokens = 0
        full_response = ""

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    OPENROUTER_CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://burnchat.ai",
                        "X-Title": "BurnChat",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "stream": True,
                    },
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        error_detail = body.decode("utf-8", errors="replace")
                        yield {
                            "event": "message",
                            "data": json.dumps({
                                "type": "error",
                                "content": f"OpenRouter error ({response.status_code}): {error_detail}",
                            }),
                        }
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue

                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        # Extract usage if present in the chunk
                        if "usage" in data:
                            prompt_tokens = data["usage"].get("prompt_tokens", 0)
                            completion_tokens = data["usage"].get("completion_tokens", 0)

                        choices = data.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            full_response += content
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "token",
                                    "content": content,
                                }),
                            }

        except httpx.HTTPError as exc:
            yield {
                "event": "message",
                "data": json.dumps({
                    "type": "error",
                    "content": f"Stream error: {exc}",
                }),
            }
            return

        # 8. After completion: calculate token usage, deduct credits
        usage_info = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }

        if authenticated_user and authenticated_user.get("user_id"):
            usage_info = await _deduct_credits(
                user_id=authenticated_user["user_id"],
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                model=model,
            )

        done_payload = {
            "type": "done",
            "usage": usage_info,
        }

        # Signal the frontend when credits have been exhausted so it can
        # pause the session and prompt the user to purchase more.
        if usage_info.get("credit_balance") is not None and usage_info["credit_balance"] <= 0:
            done_payload["credits_exhausted"] = True

        yield {
            "event": "message",
            "data": json.dumps(done_payload),
        }

    return EventSourceResponse(event_generator())
