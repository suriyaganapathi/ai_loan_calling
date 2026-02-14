"""
Users CRUD Operations
======================
All database operations for the users collection
"""

from datetime import datetime
from bson import ObjectId
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class UsersCRUD:
    """CRUD operations for users collection"""
    
    def __init__(self, database):
        self.collection = database["users"]
    
    async def create(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user"""
        try:
            user_data["created_at"] = datetime.utcnow()
            user_data["updated_at"] = datetime.utcnow()
            result = await self.collection.insert_one(user_data)
            user_data["_id"] = str(result.inserted_id)
            logger.info(f"✅ User created: {user_data.get('username')}")
            return user_data
        except Exception as e:
            logger.error(f"❌ Failed to create user: {e}")
            raise
    
    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username"""
        try:
            user = await self.collection.find_one({"username": username})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"❌ Failed to get user by username: {e}")
            return None
    
    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ObjectId"""
        try:
            obj_id = ObjectId(user_id)
            user = await self.collection.find_one({"_id": obj_id})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"❌ Failed to get user by ID: {e}")
            return None
    
    async def update_tokens(
        self, 
        username: str, 
        refresh_token: Optional[str] = None,
        refresh_expires: Optional[datetime] = None,
        access_token: Optional[str] = None,
        access_expires: Optional[datetime] = None
    ) -> bool:
        """Update user JWT tokens"""
        try:
            update_data = {"updated_at": datetime.utcnow()}
            if refresh_token is not None:
                update_data["refresh_token"] = refresh_token
            if refresh_expires:
                update_data["refresh_token_expires_at"] = refresh_expires
            if access_token:
                update_data["access_token"] = access_token
            if access_expires:
                update_data["last_access_token_expires_at"] = access_expires
            
            result = await self.collection.update_one(
                {"username": username},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to update tokens: {e}")
            return False
    
    async def revoke_token(self, username: str) -> bool:
        """Revoke refresh token (logout)"""
        try:
            result = await self.collection.update_one(
                {"username": username},
                {"$set": {"refresh_token": None, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to revoke token: {e}")
            return False
    
    async def delete(self, user_id: str) -> bool:
        """Delete user by ID"""
        try:
            obj_id = ObjectId(user_id)
            result = await self.collection.delete_one({"_id": obj_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to delete user: {e}")
            return False
