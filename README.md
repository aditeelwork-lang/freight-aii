# Freight-AI — Progress Build

This build establishes the project foundation and implements the first connected module: shipment management.

## Included
- React/Vite application shell and sign-in/registration UI
- FastAPI authentication endpoints with JWT verification for protected APIs
- MongoDB persistence for user and shipment records
- Shipment create/list/search/filter/status-update/delete APIs
- Responsive shipment register UI
- Environment-based API URL, CORS settings, and database configuration
- `.env.example` for backend configuration

## Requirements
- Node.js 20.19+ or 22.12+ (recommended for modern Vite)
- Python 3.10+
- MongoDB running locally or a MongoDB connection URI

## Run backend
From `backend/`:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Copy .env.example to .env and set SECRET_KEY
uvicorn main:app --reload
```

API health: `http://localhost:8000/api/health`
API docs: `http://localhost:8000/docs`

## Run frontend
From the project root:

```bash
npm install
npm run dev
```

The frontend defaults to `http://localhost:8000/api`. To override, set `VITE_API_BASE_URL` in a root `.env` file, e.g. `VITE_API_BASE_URL=http://localhost:8000/api`.

## Shipment API
All shipment endpoints require `Authorization: Bearer <token>`:
- `GET /api/shipments?search=&status=` — list/search/filter current user's shipments
- `POST /api/shipments` — create shipment
- `GET /api/shipments/{id}` — get one shipment
- `PUT /api/shipments/{id}` — update shipment fields
- `PATCH /api/shipments/{id}/status` — update status
- `DELETE /api/shipments/{id}` — delete shipment

Shipment status values: `Draft`, `Booked`, `In Transit`, `Delayed`, `Delivered`, `Cancelled`.

## Important notes
- Set a unique strong `SECRET_KEY` in `.env`; the fallback is for local development only.
- Do not expose this demo to the public internet without additional security review, rate limiting, password-reset flows, logging, and deployment hardening.
- Forecasting and marketplace screens are placeholders in this progress build; they are not yet implemented.
