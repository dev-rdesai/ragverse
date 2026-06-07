import asyncio
from typing import AsyncGenerator, Any
import io

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_ollama import ChatOllama
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import HumanMessage
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from config import settings


RAG_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""You are a helpful assistant that answers questions based on the provided context.

Context:
{context}

Question: {question}

Instructions:
- Answer based ONLY on the information in the context above.
- If the context doesn't contain enough information, say so clearly.
- Be concise and accurate.
- Cite relevant details from the context.

Answer:"""
)


class StreamingCallbackHandler(BaseCallbackHandler):
    """Callback to collect streamed tokens into an async queue."""

    def __init__(self, queue: asyncio.Queue):
        self.queue = queue

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        asyncio.get_event_loop().call_soon_threadsafe(self.queue.put_nowait, token)

    def on_llm_end(self, *args, **kwargs) -> None:
        asyncio.get_event_loop().call_soon_threadsafe(self.queue.put_nowait, None)

    def on_llm_error(self, error: Exception, **kwargs: Any) -> None:
        asyncio.get_event_loop().call_soon_threadsafe(self.queue.put_nowait, f"[ERROR] {error}")


class RAGPipeline:
    def __init__(self):
        self._embeddings = None
        self._qdrant_client = None
        self._vector_store = None
        self._llm = None
        self._text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def _get_embeddings(self):
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings(
                model_name=settings.embedding_model,
                model_kwargs={"device": settings.embedding_device},
                encode_kwargs={"normalize_embeddings": True},
            )
        return self._embeddings

    def _get_qdrant_client(self):
        if self._qdrant_client is None:
            self._qdrant_client = QdrantClient(
                host=settings.qdrant_host,
                port=settings.qdrant_port,
            )
        return self._qdrant_client

    def _get_vector_store(self):
        if self._vector_store is None:
            client = self._get_qdrant_client()
            # langchain-qdrant requires the collection to already exist
            existing = [c.name for c in client.get_collections().collections]
            if settings.qdrant_collection not in existing:
                client.create_collection(
                    collection_name=settings.qdrant_collection,
                    vectors_config=VectorParams(
                        size=settings.vector_size,
                        distance=Distance.COSINE,
                    ),
                )
            self._vector_store = QdrantVectorStore(
                client=client,
                collection_name=settings.qdrant_collection,
                embedding=self._get_embeddings(),
            )
        return self._vector_store

    def _get_llm(self, streaming=False, callbacks=None):
        return ChatOllama(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            temperature=0.1,
            callbacks=callbacks or [],
        )

    async def ingest_document(self, content: bytes, filename: str, content_type: str) -> dict:
        """Parse, chunk, embed, and store a document."""
        loop = asyncio.get_event_loop()

        # Decode content
        if content_type == "application/pdf":
            text = await loop.run_in_executor(None, self._extract_pdf_text, content)
        else:
            text = content.decode("utf-8", errors="replace")

        # Split into chunks
        chunks = self._text_splitter.create_documents(
            texts=[text],
            metadatas=[{"source": filename, "content_type": content_type}],
        )

        if not chunks:
            return {"status": "error", "message": "No text could be extracted"}

        # Embed and store
        await loop.run_in_executor(
            None,
            self._get_vector_store().add_documents,
            chunks,
        )

        return {
            "status": "success",
            "filename": filename,
            "chunks_stored": len(chunks),
            "total_characters": len(text),
        }

    def _extract_pdf_text(self, content: bytes) -> str:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            return content.decode("utf-8", errors="replace")

    async def query(self, question: str, top_k: int = 4) -> dict:
        """Retrieve relevant docs and generate an answer."""
        loop = asyncio.get_event_loop()

        retriever = self._get_vector_store().as_retriever(
            search_type="similarity",
            search_kwargs={"k": top_k},
        )

        chain = RetrievalQA.from_chain_type(
            llm=self._get_llm(),
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True,
            chain_type_kwargs={"prompt": RAG_PROMPT},
        )

        result = await loop.run_in_executor(None, chain.invoke, {"query": question})

        sources = []
        for doc in result.get("source_documents", []):
            sources.append({
                "content": doc.page_content[:300] + ("..." if len(doc.page_content) > 300 else ""),
                "source": doc.metadata.get("source", "unknown"),
                "metadata": doc.metadata,
            })

        return {
            "answer": result["result"],
            "sources": sources,
        }

    async def query_stream(self, question: str, top_k: int = 4) -> AsyncGenerator[str, None]:
        """Stream the answer token by token using ChatOllama's native async stream."""
        retriever = self._get_vector_store().as_retriever(
            search_type="similarity",
            search_kwargs={"k": top_k},
        )

        loop = asyncio.get_event_loop()
        docs = await loop.run_in_executor(
            None, retriever.invoke, question
        )

        context = "\n\n---\n\n".join(doc.page_content for doc in docs)
        prompt_text = RAG_PROMPT.format(context=context, question=question)

        llm = ChatOllama(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            temperature=0.1,
        )

        async for chunk in llm.astream([HumanMessage(content=prompt_text)]):
            if chunk.content:
                yield chunk.content

    async def get_collection_stats(self) -> dict:
        client = self._get_qdrant_client()
        info = client.get_collection(settings.qdrant_collection)
        return {
            "collection": settings.qdrant_collection,
            "vectors_count": info.vectors_count,
            "points_count": info.points_count,
            "status": str(info.status),
        }

    async def reset_collection(self) -> dict:
        client = self._get_qdrant_client()
        client.delete_collection(settings.qdrant_collection)
        self._vector_store = None
        self._get_vector_store()  # recreates it
        return {"status": "reset", "collection": settings.qdrant_collection}