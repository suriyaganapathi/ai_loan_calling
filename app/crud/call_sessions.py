"""
Call Sessions CRUD Operations
==============================
All database operations for the call_sessions collection
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class CallSessionsCRUD:
    """CRUD operations for call_sessions collection"""
    
    def __init__(self, database):
        self.collection = database["call_sessions"]
    
    async def create(self, session_data: Dict[str, Any]) -> str:
        """Insert a call session"""
        try:
            # Clean and format data
            data = session_data.copy()
            if "_id" in data:
                del data["_id"]
            
            # Format mappings if needed
            if "borrower_id" in data and "loan_no" not in data:
                data["loan_no"] = data.pop("borrower_id")
            
            # Parse datetime strings
            if "end_time" in data and isinstance(data["end_time"], str):
                try:
                    data["end_time"] = datetime.fromisoformat(data["end_time"])
                except:
                    pass
            
            if "start_time" in data and isinstance(data["start_time"], str):
                try:
                    data["start_time"] = datetime.fromisoformat(data["start_time"])
                except:
                    pass
            
            data["created_at"] = datetime.utcnow()
            data["status"] = data.get("status", "completed")
            
            result = await self.collection.insert_one(data)
            logger.info(f"✅ Call Session saved: {data.get('call_uuid')}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"❌ Failed to create call session: {e}")
            raise
    
    async def get_by_uuid(self, call_uuid: str) -> Optional[Dict[str, Any]]:
        """Get call session by UUID"""
        try:
            session = await self.collection.find_one({"call_uuid": call_uuid})
            if session:
                session["_id"] = str(session["_id"])
            return session
        except Exception as e:
            logger.error(f"❌ Failed to get call session by UUID: {e}")
            return None
    
    async def get_by_loan_no(self, loan_no: Any) -> List[Dict[str, Any]]:
        """Get all call sessions for a specific loan"""
        try:
            cursor = self.collection.find({"loan_no": loan_no}).sort("created_at", -1)
            sessions = await cursor.to_list(length=None)
            for session in sessions:
                session["_id"] = str(session["_id"])
            return sessions
        except Exception as e:
            logger.error(f"❌ Failed to get sessions by loan_no: {e}")
            return []
    
    async def get_all(self, query: Optional[Dict[str, Any]] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List sessions with optional filters"""
        try:
            cursor = self.collection.find(query or {}).limit(limit).sort("created_at", -1)
            sessions = await cursor.to_list(length=limit)
            for session in sessions:
                session["_id"] = str(session["_id"])
            return sessions
        except Exception as e:
            logger.error(f"❌ Failed to get all sessions: {e}")
            return []
    
    async def update(self, call_uuid: str, update_data: Dict[str, Any]) -> bool:
        """Update call session by UUID"""
        try:
            update_data["updated_at"] = datetime.utcnow()
            result = await self.collection.update_one(
                {"call_uuid": call_uuid},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to update call session: {e}")
            return False
    
    async def delete(self, call_uuid: str) -> bool:
        """Delete call session by UUID"""
        try:
            result = await self.collection.delete_one({"call_uuid": call_uuid})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"❌ Failed to delete call session: {e}")
            return False
