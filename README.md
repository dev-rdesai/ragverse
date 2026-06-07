# ◈ RAGMIND — Local RAG Stack

A fully local Retrieval-Augmented Generation (RAG) application. No cloud APIs, no data leaving your machine.

```
React UI  →  FastAPI  →  LangChain  →  Qdrant  →  BGE Embeddings  →  Llama 3.1 (Ollama)
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Docker | any | [docker.com](https://docker.com) |
| Ollama | latest | [ollama.ai](https://ollama.ai) |

---

## Quick Start (recommended)

```bash
# 1. Clone / unzip this project, then:
chmod +x start.sh
./start.sh
```

This script will:
1. Start **Qdrant** in Docker
2. Start **Ollama** and pull `llama3.1` (downloads ~4 GB on first run)
3. Create a Python venv and install backend deps
4. Install frontend npm packages
5. Launch everything

Open **http://localhost:3000** and you're ready.

---

## Manual Setup

### 1. Qdrant

```bash
docker run -d --name ragmind-qdrant \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### 2. Ollama

```bash
# Install Ollama from https://ollama.ai, then:
ollama pull llama3.1
ollama serve   # starts on :11434
```

### 3. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # edit if needed
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm start                       # opens http://localhost:3000
```

---

## Docker Compose (alternative)

```bash
# Ollama must be running on host first (not in compose)
ollama pull llama3.1 && ollama serve &

docker-compose up --build
```

---

## Usage

1. **Upload documents** — drag and drop `.txt`, `.pdf`, or `.md` files into the sidebar
2. **Ask questions** — type in the chat and press Enter
3. **See sources** — each answer shows which document chunks were used

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/upload` | Upload & ingest a document |
| POST | `/query` | Ask a question (full response) |
| POST | `/query/stream` | Ask a question (SSE streaming) |
| GET | `/collections/stats` | Qdrant collection info |
| DELETE | `/collections/reset` | Wipe the knowledge base |

Interactive docs at **http://localhost:8000/docs**

---

## Configuration

Edit `backend/.env`:

```env
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=rag_documents

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1        # or llama3.1:70b, mistral, etc.

EMBEDDING_MODEL=BAAI/bge-base-en-v1.5
EMBEDDING_DEVICE=cpu         # set "cuda" for GPU

CHUNK_SIZE=512
CHUNK_OVERLAP=64
```

### Swap the LLM

Change `OLLAMA_MODEL` to any model you've pulled:

```bash
ollama pull mistral
# then set OLLAMA_MODEL=mistral in .env
```

### Use a larger BGE model

```env
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
VECTOR_SIZE=1024
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│               React Frontend                 │
│  Dropzone upload │ Chat UI │ Source viewer   │
└───────────────────┬─────────────────────────┘
                    │ HTTP / SSE
┌───────────────────▼─────────────────────────┐
│              FastAPI Backend                 │
│  /upload  │  /query  │  /query/stream        │
└───────────────────┬─────────────────────────┘
                    │ LangChain orchestration
          ┌─────────┴──────────┐
          │                    │
┌─────────▼───────┐  ┌─────────▼──────────────┐
│  BGE Embeddings │  │   Llama 3.1 (Ollama)    │
│  (HuggingFace)  │  │   Generation + Stream   │
└─────────┬───────┘  └────────────────────────┘
          │ vectors
┌─────────▼───────────────────────────────────┐
│              Qdrant Vector DB                │
│  Cosine similarity │ Persistent storage      │
└─────────────────────────────────────────────┘
```

---

## Troubleshooting

**Backend won't start** — check Python 3.10+ is installed; activate the venv.

**Ollama connection refused** — ensure `ollama serve` is running and the model is pulled.

**Embeddings slow on first run** — BGE model downloads (~430 MB) on first use; subsequent starts are instant.

**Qdrant connection error** — confirm Docker is running: `docker ps | grep ragmind-qdrant`

**CUDA / GPU** — set `EMBEDDING_DEVICE=cuda` in `.env` and ensure PyTorch with CUDA is installed.
