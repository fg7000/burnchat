from pydantic import BaseModel, Field
from typing import Optional


class AnonymizeRequest(BaseModel):
    text: str


class EntityInfo(BaseModel):
    type: str
    count: int


class MappingEntry(BaseModel):
    original: str
    replacement: str
    entity_type: str


class AnonymizeResponse(BaseModel):
    anonymized_text: str
    mapping: list[MappingEntry]
    entities_found: list[EntityInfo]


class IngestURLRequest(BaseModel):
    url: str


class IngestURLResponse(BaseModel):
    text: str
    source_type: str
    title: str


class GDriveFolderRequest(BaseModel):
    folder_url: str


class GDriveFileResult(BaseModel):
    filename: str
    text: str
    size_bytes: int = 0


class GDriveFolderResponse(BaseModel):
    files: list[GDriveFileResult]
    total_files: int


class DocumentInput(BaseModel):
    filename: str
    text: str


class DocumentsProcessRequest(BaseModel):
    documents: list[DocumentInput]
    session_id: Optional[str] = None


class DocumentsProcessResponse(BaseModel):
    session_id: str
    documents_processed: int
    total_chunks: int
    entities_found: list[EntityInfo]


class DocumentSearchRequest(BaseModel):
    session_id: str
    query: str
    top_k: int = 10


class ChunkResult(BaseModel):
    anonymized_text: str
    document_name: str
    chunk_index: int
    similarity_score: float


class DocumentSearchResponse(BaseModel):
    chunks: list[ChunkResult]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: list[ChatMessage]
    session_id: Optional[str] = None
    anonymized_document: Optional[str] = None
    session_token: Optional[str] = None


class RecommendModelRequest(BaseModel):
    token_count: int
    entity_count: int = 0
    query: str = ""


class ModelInfo(BaseModel):
    id: str
    name: str
    context_length: int
    prompt_price_per_million: float
    completion_price_per_million: float
    our_prompt_price: float
    our_completion_price: float


class RecommendModelResponse(BaseModel):
    model: str
    reason: str
    estimated_credits: int
    alternatives: list[dict] = []
    strategy: Optional[str] = None


class SessionCreateRequest(BaseModel):
    name: Optional[str] = "Untitled Session"
    mapping_encrypted: str


class SessionSaveMappingRequest(BaseModel):
    session_id: str
    mapping_encrypted: str


class SessionInfo(BaseModel):
    id: str
    name: str
    document_count: int = 0
    created_at: str
    updated_at: str


class SessionDetail(BaseModel):
    id: str
    name: str
    documents: list[dict] = []
    mapping_encrypted: str
    created_at: str


class CreditPurchaseRequest(BaseModel):
    package_id: str


class CreditDeductRequest(BaseModel):
    amount: int
    description: str


class UserInfo(BaseModel):
    user_id: str
    email: str
    credit_balance: int
