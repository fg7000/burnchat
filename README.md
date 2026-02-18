# BurnChat - The VPN for AI

A privacy proxy for AI. Upload sensitive documents, automatically strip all PII using Microsoft Presidio, chat with any LLM via OpenRouter. When you leave, everything burns.

## Architecture

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python) with Presidio, spaCy, and Faker
- **Database**: Supabase (PostgreSQL + pgvector)
- **LLM Gateway**: OpenRouter (multi-model)
- **Payments**: Stripe (credit packages)
- **Auth**: Google OAuth

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase project (with pgvector extension enabled)

### Backend Setup

```bash
cd apps/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_lg

# Set up database tables
python setup_database.py

# Start the API server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install

# Start the dev server
npm run dev
```

### Docker (Alternative)

```bash
docker-compose up
```

## Environment Variables

### Backend (`apps/api/.env`)

```bash
OPENROUTER_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
```

### Frontend (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
```

## Deployment

- **Frontend**: Deploy to Vercel (auto-detects Next.js)
- **Backend**: Deploy to Railway using the Dockerfile in `apps/api/`
- **DNS**: `burnchat.ai` -> Vercel, `api.burnchat.ai` -> Railway

## Credit System

- 1 credit = $0.01
- 50 free credits for new users
- OpenRouter pricing with 50% margin
- Packages: $5/500, $20/2,200, $50/6,000, $100/13,000

## Privacy

- Documents processed in memory only, never stored
- Only anonymized text sent to LLMs
- Mapping stored in browser memory only (dies on tab close)
- Multi-doc sessions: encrypted mapping, anonymized chunks only in DB
