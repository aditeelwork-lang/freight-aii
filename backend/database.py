
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load .env from the same folder as this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "freight_ai")

if not MONGO_URI:
    raise ValueError("MONGO_URI is missing from backend/.env")

client = AsyncIOMotorClient(
    MONGO_URI,
    serverSelectionTimeoutMS=8000
)

db = client[DATABASE_NAME]
