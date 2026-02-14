"""
Borrowers CRUD Operations
==========================
All database operations for the borrowers collection
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class BorrowersCRUD:
    """CRUD operations for borrowers collection"""
    
    def __init__(self, database):
        self.collection = database["borrowers"]
    
    async def create(self, borrower_data: Dict[str, Any], user_id: str = None, username: str = None) -> Dict[str, Any]:
        """Create a single borrower"""
        try:
            # Add user relationship if provided
            if user_id:
                borrower_data["user_id"] = user_id
            if username:
                borrower_data["username"] = username
            
            borrower_data["created_at"] = datetime.utcnow()
            borrower_data["updated_at"] = datetime.utcnow()
            result = await self.collection.insert_one(borrower_data)
            borrower_data["_id"] = str(result.inserted_id)
            logger.info(f"✅ Borrower created: {borrower_data.get('NO')} (user: {username})")
            return borrower_data
        except Exception as e:
            logger.error(f"❌ Failed to create borrower: {e}")
            raise
    
    async def bulk_upsert(self, borrowers_list: List[Dict[str, Any]], user_id: str = None, username: str = None) -> Dict[str, int]:
        """Bulk insert/update borrowers from dataset"""
        try:
            from pymongo import UpdateOne
            operations = []
            
            for borrower in borrowers_list:
                borrower_id = borrower.get('NO')
                if borrower_id:
                    # Add user relationship
                    if user_id:
                        borrower["user_id"] = user_id
                    if username:
                        borrower["username"] = username
                    
                    borrower["updated_at"] = datetime.utcnow()
                    if "created_at" not in borrower:
                        borrower["created_at"] = datetime.utcnow()
                    
                    operations.append(
                        UpdateOne(
                            {"NO": borrower_id},
                            {"$set": borrower},
                            upsert=True
                        )
                    )
            
            if operations:
                result = await self.collection.bulk_write(operations)
                logger.info(f"✅ Borrowers upserted: {result.upserted_count} new, {result.modified_count} updated (user: {username})")
                return {
                    "upserted": result.upserted_count,
                    "modified": result.modified_count,
                    "total": len(operations)
                }
            return {"upserted": 0, "modified": 0, "total": 0}
        except Exception as e:
            logger.error(f"❌ Failed to bulk upsert borrowers: {e}")
            raise
    
    async def get_by_id(self, borrower_id: Any) -> Optional[Dict[str, Any]]:
        """Get borrower by NO field (handles string or int)"""
        try:
            # Try to match as both string and integer
            query_ids = [str(borrower_id)]
            try:
                query_ids.append(int(borrower_id))
            except:
                pass
            
            borrower = await self.collection.find_one({"NO": {"$in": query_ids}})
            if borrower:
                borrower["_id"] = str(borrower["_id"])
                if "user_id" in borrower:
                    borrower["user_id"] = str(borrower["user_id"])
            return borrower
        except Exception as e:
            logger.error(f"❌ Failed to get borrower by ID: {e}")
            return None
    
    async def get_all(self, query: Optional[Dict[str, Any]] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch borrowers with optional filtering"""
        try:
            cursor = self.collection.find(query or {}).limit(limit)
            borrowers = await cursor.to_list(length=limit)
            for borrower in borrowers:
                borrower["_id"] = str(borrower["_id"])
                if "user_id" in borrower:
                    borrower["user_id"] = str(borrower["user_id"])
            return borrowers
        except Exception as e:
            logger.error(f"❌ Failed to get all borrowers: {e}")
            return []
    
    async def get_by_user(self, user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all borrowers for a specific user"""
        try:
            return await self.get_all(query={"user_id": user_id}, limit=limit)
        except Exception as e:
            logger.error(f"❌ Failed to get borrowers by user: {e}")
            return []
    
    async def update(self, borrower_id: Any, update_data: Dict[str, Any]) -> bool:
        """Update borrower by NO field"""
        try:
            query_ids = [str(borrower_id)]
            try:
                query_ids.append(int(borrower_id))
            except:
                pass
            
            update_data["updated_at"] = datetime.utcnow()
            result = await self.collection.update_one(
                {"NO": {"$in": query_ids}},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to update borrower: {e}")
            return False
    
    async def delete(self, borrower_id: Any) -> bool:
        """Delete borrower by NO field"""
        try:
            query_ids = [str(borrower_id)]
            try:
                query_ids.append(int(borrower_id))
            except:
                pass
            
            result = await self.collection.delete_one({"NO": {"$in": query_ids}})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to delete borrower: {e}")
            return False
