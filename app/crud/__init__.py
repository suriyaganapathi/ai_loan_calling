"""
CRUD Instances Export
=====================
Import database and create CRUD instances for each collection
"""

from app.db import db
from app.crud.users import UsersCRUD
from app.crud.borrowers import BorrowersCRUD
from app.crud.call_sessions import CallSessionsCRUD

# Create CRUD instances
users_crud = UsersCRUD(db)
borrowers_crud = BorrowersCRUD(db)
call_sessions_crud = CallSessionsCRUD(db)

__all__ = [
    "users_crud",
    "borrowers_crud",
    "call_sessions_crud"
]
