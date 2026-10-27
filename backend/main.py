import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Query, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from database import client, db
from models import UserRegister, UserLogin, ShipmentCreate, ShipmentUpdate

load_dotenv()

app = FastAPI(title="Freight-AI Backend", version="0.2.0")

# Explicitly declare the Bearer scheme so Swagger's Authorize button reliably
# attaches the token to every shipment operation, including nested routes.
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi
    schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["HTTPBearer"] = {
        "type": "http", "scheme": "bearer", "bearerFormat": "JWT"
    }
    for path, methods in schema.get("paths", {}).items():
        if path.startswith("/api/shipments"):
            for method, operation in methods.items():
                if method.lower() in {"get", "post", "put", "patch", "delete"}:
                    operation["security"] = [{"HTTPBearer": []}]
    app.openapi_schema = schema
    return app.openapi_schema

app.openapi = custom_openapi

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# The fallback is for local development only. Set a strong SECRET_KEY in .env.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))
bearer_scheme = HTTPBearer(auto_error=False)

VALID_ROLES = {"shipper", "carrier"}
VALID_STATUSES = {"Draft", "Booked", "In Transit", "Delayed", "Delivered", "Cancelled"}


def serialize_shipment(doc: dict) -> dict:
    """Return JSON-safe shipment data without mutating the MongoDB document."""
    result = dict(doc)
    result["id"] = str(result.pop("_id"))
    for field in ("createdAt", "updatedAt", "pickupDate", "deliveryDate"):
        value = result.get(field)
        if isinstance(value, (datetime,)):
            result[field] = value.isoformat()
        elif value is not None and field in ("pickupDate", "deliveryDate"):
            result[field] = str(value)
    return result


async def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise JWTError("Missing subject")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = await db.users.find_one({"email": email}, {"password": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found")
    return user


@app.get("/")
async def root():
    return {"message": "Freight-AI FastAPI Backend is running", "version": app.version}


@app.get("/api/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister):
    email = user.email.lower().strip()
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if user.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail="Role must be shipper, carrier, or admin")
    user_doc = user.model_dump() if hasattr(user, "model_dump") else user.dict()
    user_doc["email"] = email
    user_doc["password"] = pwd_context.hash(user.password)
    user_doc["createdAt"] = datetime.now(timezone.utc)
    result = await db.users.insert_one(user_doc)
    return {"message": "User registered successfully", "userId": str(result.inserted_id)}


@app.post("/api/auth/login")
async def login(user: UserLogin):
    email = user.email.lower().strip()
    db_user = await db.users.find_one({"email": email})
    if not db_user or not pwd_context.verify(user.password, db_user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    token = jwt.encode({
        "sub": db_user["email"],
        "companyName": db_user.get("companyName", ""),
        "role": db_user.get("role", "shipper"),
        "exp": expire,
    }, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "token": token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "name": db_user["name"],
            "email": db_user["email"],
            "companyName": db_user["companyName"],
            "role": db_user.get("role", "shipper"),
        },
    }


@app.get("/api/shipments")
async def list_shipments(
    search: Optional[str] = Query(default=None, max_length=100),
    shipment_status: Optional[str] = Query(default=None, alias="status"),
    user: dict = Depends(current_user),
):
    query = {"ownerEmail": user["email"]}
    if shipment_status:
        if shipment_status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid shipment status")
        query["status"] = shipment_status
    if search and search.strip():
        escaped = search.strip()
        query["$or"] = [
            {"reference": {"$regex": escaped, "$options": "i"}},
            {"origin": {"$regex": escaped, "$options": "i"}},
            {"destination": {"$regex": escaped, "$options": "i"}},
            {"cargo": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.shipments.find(query).sort("createdAt", -1).limit(500)
    return [serialize_shipment(doc) async for doc in cursor]


@app.post("/api/shipments", status_code=status.HTTP_201_CREATED)
async def create_shipment(payload: ShipmentCreate, user: dict = Depends(current_user)):
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    now = datetime.now(timezone.utc)
    data["ownerEmail"] = user["email"]
    data["status"] = "Draft"
    data["createdAt"] = now
    data["updatedAt"] = now
    # A readable reference is convenient in the demo; uniqueness is scoped by owner.
    data["reference"] = data.get("reference") or f"FA-{now.strftime('%y%m%d%H%M%S%f')}"
    existing = await db.shipments.find_one({"ownerEmail": user["email"], "reference": data["reference"]})
    if existing:
        raise HTTPException(status_code=409, detail="A shipment with this reference already exists")

    for key in ("pickupDate", "deliveryDate"):
        value = data.get(key)
        if isinstance(value, (date, datetime)):
            data[key] = value.isoformat()

    result = await db.shipments.insert_one(data)
    created = await db.shipments.find_one({"_id": result.inserted_id})
    if created is None:
        raise HTTPException(status_code=500, detail="Shipment was inserted but could not be retrieved")
    return serialize_shipment(created)


@app.get("/api/shipments/{shipment_id}")
async def get_shipment(shipment_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(shipment_id):
        raise HTTPException(status_code=404, detail="Shipment not found")
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id), "ownerEmail": user["email"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return serialize_shipment(doc)


@app.put("/api/shipments/{shipment_id}")
async def update_shipment(shipment_id: str, payload: ShipmentUpdate, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(shipment_id):
        raise HTTPException(status_code=404, detail="Shipment not found")
    changes = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")
    if "status" in changes and changes["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid shipment status")
    changes["updatedAt"] = datetime.now(timezone.utc)
    result = await db.shipments.update_one(
        {"_id": ObjectId(shipment_id), "ownerEmail": user["email"]},
        {"$set": changes},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id), "ownerEmail": user["email"]})
    return serialize_shipment(doc)


@app.patch("/api/shipments/{shipment_id}/status")
async def update_shipment_status(shipment_id: str, payload: dict, user: dict = Depends(current_user)):
    new_status = payload.get("status")
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
    if not ObjectId.is_valid(shipment_id):
        raise HTTPException(status_code=404, detail="Shipment not found")
    result = await db.shipments.update_one(
        {"_id": ObjectId(shipment_id), "ownerEmail": user["email"]},
        {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id), "ownerEmail": user["email"]})
    return serialize_shipment(doc)


@app.delete("/api/shipments/{shipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shipment(shipment_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(shipment_id):
        raise HTTPException(status_code=404, detail="Shipment not found")
    result = await db.shipments.delete_one({"_id": ObjectId(shipment_id), "ownerEmail": user["email"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return None


@app.on_event("shutdown")
async def close_database():
    client.close()
