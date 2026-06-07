from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "rag_documents"

    # Ollama / LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # Embeddings
    embedding_model: str = "BAAI/bge-base-en-v1.5"
    embedding_device: str = "cpu"  # "cuda" if GPU available

    # Chunking
    chunk_size: int = 512
    chunk_overlap: int = 64

    # Vector dimensions for BGE-base
    vector_size: int = 768

    class Config:
        env_file = ".env"


settings = Settings()
