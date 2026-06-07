#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ◈ RAGMIND — Local RAG Stack"
echo "  Llama 3.1 + BGE + Qdrant + LangChain + FastAPI + React"
echo -e "${NC}"

# ─── Check prerequisites ───────────────────────────────────────────────────────
check_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo -e "${RED}✗ '$1' not found. Please install it first.${NC}"
    exit 1
  }
}

check_cmd docker
check_cmd python3
check_cmd node
check_cmd npm

# ─── Qdrant via Docker ────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Starting Qdrant...${NC}"
if [ "$(docker ps -q -f name=ragmind-qdrant)" ]; then
  echo "  Qdrant already running."
else
  docker run -d \
    --name ragmind-qdrant \
    -p 6333:6333 \
    -p 6334:6334 \
    -v "$(pwd)/qdrant_storage:/qdrant/storage" \
    qdrant/qdrant 2>/dev/null || docker start ragmind-qdrant
  echo -e "  ${GREEN}✓ Qdrant started on :6333${NC}"
fi

# ─── Ollama + pull model ──────────────────────────────────────────────────────
echo -e "${YELLOW}→ Checking Ollama...${NC}"
if command -v ollama >/dev/null 2>&1; then
  ollama serve &>/dev/null &
  sleep 2
  echo -e "  ${GREEN}✓ Ollama running${NC}"
  echo -e "  ${YELLOW}→ Pulling llama3.1 model (first run may take a while)...${NC}"
  ollama pull llama3.1
else
  echo -e "  ${RED}✗ Ollama not found. Install from https://ollama.ai then run: ollama pull llama3.1${NC}"
fi

# ─── Backend ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Setting up backend...${NC}"
cd backend

if [ ! -d ".venv" ]; then
  echo "  Creating Python venv..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

cp -n .env.example .env 2>/dev/null || true

echo -e "  ${GREEN}✓ Backend ready${NC}"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# ─── Frontend ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Setting up frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages..."
  npm install --silent
fi

echo -e "  ${GREEN}✓ Frontend ready${NC}"
npm start &
FRONTEND_PID=$!
cd ..

# ─── Wait ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════"
echo "  ✓ RAGMIND is running!"
echo ""
echo "  Frontend  → http://localhost:3000"
echo "  Backend   → http://localhost:8000"
echo "  API Docs  → http://localhost:8000/docs"
echo "  Qdrant    → http://localhost:6333/dashboard"
echo -e "═══════════════════════════════════════${NC}"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker stop ragmind-qdrant 2>/dev/null; echo 'Stopped.'" INT TERM
wait
