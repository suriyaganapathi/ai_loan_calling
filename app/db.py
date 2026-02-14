"""
Database Connection Setup
==========================
Motor async MongoDB client initialization
"""

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize async MongoDB client
client = AsyncIOMotorClient(settings.MONGO_URI)
db = client[settings.MONGO_DB_NAME]


def get_db():
    """Return database instance"""
    return db


async def test_connection():
    """Test database connection on startup"""
    try:
        await client.admin.command('ping')
        logger.info("✅ Successfully connected to MongoDB")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        return False
