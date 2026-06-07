from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import asyncio

from rag_pipeline import RAGPipeline
from config import settings

app = FastAPI(title="RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = RAGPipeline()


class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = 4


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


@app.get("/health")
async def health():
    return {"status": "ok", "message": "RAG API is running"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and ingest a document into Qdrant."""
    allowed_types = ["text/plain", "application/pdf", "text/markdown"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    content = await file.read()
    try:
        result = await rag.ingest_document(content, file.filename, file.content_type)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Query the RAG pipeline."""
    try:
        result = await rag.query(request.question, request.top_k)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    """Stream the RAG response token by token."""
    async def event_generator():
        try:
            async for token in rag.query_stream(request.question, request.top_k):
                yield f"data: {token}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/collections/stats")
async def collection_stats():
    """Get stats about the Qdrant collection."""
    try:
        return await rag.get_collection_stats()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/collections/reset")
async def reset_collection():
    """Delete and recreate the Qdrant collection."""
    try:
        return await rag.reset_collection()
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
