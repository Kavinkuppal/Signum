# Signum — Signage Procurement Platform

Signum is a centralized procurement platform for small-to-medium signage shops. It aggregates product catalogs from multiple suppliers (Blue Ridge Sign Supply, McLogan, USCutter), normalizes pricing into comparable units ($/ft²), and lets users search, filter, and compare materials across all suppliers from one interface.

Built for Georgia Tech Capstone Design CREATE-X — Team 13, Spring 2026.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth.js with Google OAuth |
| Backend | Python FastAPI |
| Database | PostgreSQL (SQLAlchemy ORM, Alembic migrations) |
| Scraping | httpx + BeautifulSoup (Shopify JSON API + BigCommerce HTML) |
| AI | Anthropic Claude (natural language search + BOM parsing) |
| Hosting | Vercel (frontend), Railway (backend + database) |

---

## Project Structure

```
Signum/
├── frontend/                  # Next.js application
│   ├── app/                   # App Router pages
│   │   ├── dashboard/         # Project dashboard
│   │   ├── search/            # Product search & filters
│   │   ├── compare/           # Side-by-side price comparison
│   │   ├── projects/[id]/     # Project BOM & material sourcing
│   │   ├── inventory/         # Purchase history ledger
│   │   └── settings/          # Supplier connections
│   ├── components/            # Reusable UI components
│   ├── lib/                   # API client, auth config, utilities
│   └── types/                 # TypeScript type definitions
│
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── api/v1/            # REST endpoints
│   │   ├── core/              # Config, database, dependencies
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── scrapers/          # Supplier scrapers
│   │   └── services/          # Business logic
│   └── alembic/               # Database migrations
│
├── docker-compose.yml         # Local PostgreSQL setup
└── .env.example               # Environment variable template
```

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ (or Docker)
- Google OAuth credentials
- Anthropic API key (for AI search features)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Kavinkuppal/Signum.git
cd Signum
```

### 2. Start PostgreSQL

Using Docker:
```bash
docker-compose up -d
```

Or manually create a PostgreSQL database named `signum` with user `signum` and password `signum`.

### 3. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://signum:signum@localhost:5432/signum
SECRET_KEY=your-secret-key
CORS_ORIGINS=["http://localhost:3000"]
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

Database migrations run automatically on startup.

### 4. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Features

- **Product search** — full-text search across 20,000+ products with filters for supplier, category, price range, and stock status
- **Price comparison** — side-by-side normalized pricing ($/ft²) across suppliers for the same material
- **Project BOM** — describe a sign job in plain English; AI parses it into a material list and finds the best-priced options
- **AI search** — natural language queries mapped to material filters using Claude
- **Custom suppliers** — paste any supplier URL; Signum scrapes and adds their products to your account
- **Inventory ledger** — tracks purchased materials across projects

---

## Data Sources

| Supplier | Method |
|---|---|
| Blue Ridge Sign Supply | Shopify `/products.json` API |
| McLogan | Shopify `/products.json` API |
| USCutter | BigCommerce search endpoint (HTML) |

Scrapers live in `backend/app/scrapers/`. To trigger a manual re-scrape:
```bash
curl -X POST http://localhost:8000/api/v1/scrape/run/all
```

---

## Team

Rahil Bhamani, David Casanova, Uzu (Chris) Lee, Kavin Uppal, Allen You

Georgia Institute of Technology — Capstone Design CREATE-X, Spring 2026  
Instructor: Craig Forest | Mentor: Craig Tovey
