# Signum — Signage Procurement Platform

Sign shops spend hours every week bouncing between a dozen different supplier websites, manually comparing prices on vinyl, aluminum, LEDs, and everything else they need to get a job done. Signum fixes that. It pulls product catalogs from multiple suppliers into one place, normalizes all the pricing into consistent units like $/ft² so you can actually compare apples to apples, and lets you search and filter everything from a single interface.

No longer under active development. 63 customer discovery interviews validated the problem sharply, but the economics of this particular market didn't justify continuing to build. The codebase is preserved here as a complete, working system.
---

## What's under the hood

The frontend is built with Next.js and TypeScript, styled with Tailwind CSS, and uses NextAuth with Google OAuth for login. The backend is a Python FastAPI app that talks to a PostgreSQL database. We use httpx and BeautifulSoup to scrape supplier catalogs — Blue Ridge and McLogan both run on Shopify so we hit their `/products.json` endpoints directly, while USCutter runs on BigCommerce so we scrape their search pages. Claude handles the AI-powered search and bill of materials parsing. Everything is deployed on Vercel (frontend) and Railway (backend + database).

---

## How the code is organized

```
Signum/
├── frontend/
│   ├── app/
│   │   ├── dashboard/         # landing page after login, shows your projects
│   │   ├── search/            # main product search with filters
│   │   ├── compare/           # side-by-side price comparison across suppliers
│   │   ├── projects/[id]/     # individual project page with BOM and sourcing
│   │   ├── inventory/         # history of everything you've purchased
│   │   └── settings/          # connect custom suppliers, trigger scrapes
│   ├── components/            # shared UI components
│   ├── lib/                   # API client, auth setup, shared utilities
│   └── types/                 # TypeScript type definitions
│
├── backend/
│   ├── app/
│   │   ├── api/v1/            # all the API routes
│   │   ├── core/              # database connection, config, auth dependencies
│   │   ├── models/            # SQLAlchemy database models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── scrapers/          # one file per supplier scraper
│   │   └── services/          # business logic (product upsert, scrape jobs, etc.)
│   └── alembic/               # database migration history
│
├── docker-compose.yml         # spins up a local PostgreSQL instance
└── .env.example               # template showing all required environment variables
```

---

## Running it locally

You'll need Node.js 18+, Python 3.11+, and either Docker or a local PostgreSQL instance. You'll also need a Google OAuth app (for login) and an Anthropic API key (for the AI features).

**1. Clone the repo**

```bash
git clone https://github.com/Kavinkuppal/Signum.git
cd Signum
```

**2. Start the database**

If you have Docker, this is the easiest option:

```bash
docker-compose up -d
```

Otherwise, create a PostgreSQL database called `signum` with username `signum` and password `signum`.

**3. Set up the backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a file called `.env` inside the `backend/` folder:

```env
DATABASE_URL=postgresql+asyncpg://signum:signum@localhost:5432/signum
SECRET_KEY=your-secret-key
CORS_ORIGINS=["http://localhost:3000"]
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Then start it:

```bash
uvicorn app.main:app --reload --port 8000
```

The database schema gets created automatically on first startup — no need to run migrations manually.

**4. Set up the frontend**

```bash
cd frontend
npm install
```

Create a file called `.env.local` inside the `frontend/` folder:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then start it:

```bash
npm run dev
```

Go to [http://localhost:3000](http://localhost:3000) and sign in with Google.

---

## Triggering a scrape

To pull fresh data from all three suppliers:

```bash
curl -X POST http://localhost:8000/api/v1/scrape/run/all
```

Or for a specific supplier:

```bash
curl -X POST http://localhost:8000/api/v1/scrape/run/uscutter
```

You can also do this from the Settings page in the UI.
