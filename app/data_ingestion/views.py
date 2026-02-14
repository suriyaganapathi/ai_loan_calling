from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Body
import pandas as pd
import io
import time
from typing import Optional, List, Dict
from .utils import Config, logger, validate_file_size, normalize_column_names, optimize_dataframe, sanitize_for_json
from .service import categorize_customer, categorize_by_due_date, calculate_kpis
from app.crud import borrowers_crud
from app.auth.utils import get_current_user

router = APIRouter()

@router.get("/")
def read_root():
    """Health check endpoint with system status."""
    return {
        "status": "running",
        "message": "Data Ingestion & CRUD API - MongoDB Integrated",
        "version": "4.0",
        "endpoints": {
            "upload": "POST /data (multipart/form-data)",
            "list": "GET /borrowers",
            "get": "GET /borrowers/{id}",
            "update": "PUT /borrowers/{id}",
            "delete": "DELETE /borrowers/{id}"
        }
    }

# ==========================================
# DATA INGESTION (BULK UPLOAD)
# ==========================================

@router.post("/data")
async def unified_data_endpoint(
    file: UploadFile = File(None),
    time_period: Optional[str] = None,
    include_details: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    **UPLOAD & ANALYSIS** - Process dataset and save to MongoDB borrowers collection.
    """
    start_time = time.time()
    
    if file:
        logger.info(f"Processing dataset upload: {file.filename}")
        
        # Validate file type
        if not any(file.filename.endswith(ext) for ext in Config.ALLOWED_EXTENSIONS):
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        try:
            contents = await file.read()
            if file.filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(contents))
            else:
                df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')
            
            # Normalize and Optimize
            df = normalize_column_names(df)
            df = optimize_dataframe(df)
            
            # Apply standard categorizations
            df['Payment_Category'] = df.apply(categorize_customer, axis=1)
            df['Due_Date_Category'] = df.apply(categorize_by_due_date, axis=1)
            
            # --- FIX: Handle NaT (Not a Time) and NaN (Not a Number) for MongoDB ---
            df = df.replace({pd.NA: None, pd.NaT: None})
            df = df.where(pd.notnull(df), None)
            
            # Convert to records for MongoDB
            records = df.to_dict('records')
            
            # --- FIX: Sanitize keys (remove dots) for MongoDB ---
            sanitized_records = []
            for record in records:
                sanitized_record = {str(k).replace(".", "_"): v for k, v in record.items()}
                sanitized_records.append(sanitized_record)
            
            # Persist in MongoDB with user relationship
            await borrowers_crud.bulk_upsert(
                sanitized_records,
                user_id=current_user["_id"],
                username=current_user["username"]
            )
            
            logger.info(f"Successfully ingested {len(records)} borrowers into MongoDB")
            
        except Exception as e:
            logger.error(f"Ingestion error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=str(e))
    
    # Return full KPI structure based on existing DB data (filtered by user)
    borrowers = await borrowers_crud.get_by_user(current_user["_id"], limit=1000)
    
    # Calculate KPIs from MongoDB data
    dashboard_data = calculate_kpis(borrowers)
    
    # Add metadata
    dashboard_data["status"] = "success"
    dashboard_data["uploaded"] = file is not None
    dashboard_data["processing_time"] = round(time.time() - start_time, 2)
    
    # --- FINAL FIX: Sanitize entire structure for JSON (handles NaN, Timestamps) ---
    return sanitize_for_json(dashboard_data)

# ==========================================
# BORROWERS CRUD OPERATIONS
# ==========================================

@router.get("/borrowers", response_model=List[Dict])
async def list_borrowers(
    limit: int = 100, 
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List borrowers with optional filtering"""
    # Fetch from Mongo
    borrowers = await borrowers_crud.get_all(limit=limit)
    # _id already converted to string in CRUD
    return borrowers

@router.get("/borrowers/{borrower_no}")
async def get_borrower(borrower_no: str, current_user: dict = Depends(get_current_user)):
    """Get details of a specific borrower by their NO identifier"""
    borrower = await borrowers_crud.get_by_id(borrower_no)
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    # _id already converted to string in CRUD
    return borrower

@router.put("/borrowers/{borrower_no}")
async def update_borrower(
    borrower_no: str, 
    update_data: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update borrower information (handles string or int NO)"""
    success = await borrowers_crud.update(borrower_no, update_data)
    
    if not success:
        raise HTTPException(status_code=404, detail="Borrower not found")
        
    return {"status": "success", "message": "Borrower updated"}

@router.delete("/borrowers/{borrower_no}")
async def delete_borrower(borrower_no: str, current_user: dict = Depends(get_current_user)):
    """Delete a borrower record (handles string or int NO)"""
    success = await borrowers_crud.delete(borrower_no)
    
    if not success:
        raise HTTPException(status_code=404, detail="Borrower not found")
        
    return {"status": "success", "message": "Borrower deleted"}
