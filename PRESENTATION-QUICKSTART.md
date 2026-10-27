# Freight-AI presentation build

This package includes a connected shipment dashboard, shipment register, a demo freight quote estimator, rule-based operational insights, and an explicit OpenAPI Bearer scheme for Swagger.

## Keep your secrets safe
- The real `backend/.env` is intentionally not included. Keep your existing local file and never share it.
- Set a strong random `SECRET_KEY` in `backend/.env` and keep `MONGO_URI` there.
- The `.env.example` file is a template only; it does not contain working credentials.

## Start the app (Windows PowerShell)
Open two terminals in VS Code.

Terminal 1:
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```
If dependencies are missing, activate your environment and install `requirements.txt` first:
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Terminal 2 (project root):
```powershell
npm install
npm run dev
```
Open the URL Vite prints (normally http://localhost:5173). Backend health: http://127.0.0.1:8000/api/health. Swagger: http://127.0.0.1:8000/docs.

## Demo flow
1. Register or sign in.
2. Open Shipments and create a load.
3. Update its status and show it on Overview.
4. Open Marketplace for the clearly labeled indicative rate estimate.
5. Open AI Forecast for rule-based insights from saved records.

## Notes
- Overview charts and KPIs are driven by the authenticated shipment API.
- The marketplace estimate is a simple demo formula, not a live market quote.
- AI Forecast currently uses transparent status-based rules, not a trained ML model or delivery-time predictor.
- Shipment management and dashboard require a working API/database and a valid login token.
- After replacing backend files, restart Uvicorn and hard-refresh Swagger (Ctrl+Shift+R). Log in again, click Authorize, and confirm generated curl includes `Authorization: Bearer ...`.
- If a route returns 401, do not paste your token into chat. Check that the generated request includes the Authorization header and that the same `SECRET_KEY` is used by the running backend.
