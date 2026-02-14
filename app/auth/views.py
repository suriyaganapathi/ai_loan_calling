from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
from .utils import (
    create_access_token, 
    create_refresh_token, 
    verify_token, 
    get_current_user,
    hash_password,
    verify_password
)
from app.crud import users_crud

router = APIRouter()

# ==========================================
# MODELS
# ==========================================
class UserAuth(BaseModel):
    username: str
    password: str

class UserData(BaseModel):
    username: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserData

# ==========================================
# ENDPOINTS
# ==========================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(auth: UserAuth):
    """Register a new user account"""
    # Check if user already exists
    if await users_crud.get_by_username(auth.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Hash password and save
    user_data = {
        "username": auth.username,
        "password": hash_password(auth.password),
        "role": "admin", # Default role
        "refresh_token": None
    }
    await users_crud.create(user_data)
    
    return {"status": "success", "message": "User registered successfully"}

@router.post("/login", response_model=TokenResponse)
async def login(auth: UserAuth):
    """Login and receive access/refresh tokens"""
    user = await users_crud.get_by_username(auth.username)
    
    if not user or not verify_password(auth.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create tokens
    access_token_expires = timedelta(minutes=60)
    refresh_token_expires = timedelta(days=7)
    
    access_token = create_access_token(
        data={"sub": user["username"]}, 
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user["username"]})
    
    # Calculate timestamps for DB visibility
    refresh_expires_at = datetime.utcnow() + refresh_token_expires
    access_expires_at = datetime.utcnow() + access_token_expires
    
    # Store refresh token, access token AND expiration times in DB for visibility
    await users_crud.update_tokens(
        user["username"], 
        refresh_token, 
        refresh_expires=refresh_expires_at,
        access_token=access_token,
        access_expires=access_expires_at
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user.get("role", "admin")
        }
    }

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Get a new access token using a refresh token"""
    payload = verify_token(refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    username = payload.get("sub")
    user = await users_crud.get_by_username(username)
    
    if not user or user.get("refresh_token") != refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or revoked"
        )
    
    # Generate new access token
    access_token_expires = timedelta(minutes=60)
    new_access_token = create_access_token(
        data={"sub": username},
        expires_delta=access_token_expires
    )
    access_expires_at = datetime.utcnow() + access_token_expires
    
    # Update the access token string and expiration in DB for visibility
    await users_crud.update_tokens(
        username, 
        access_token=new_access_token, 
        access_expires=access_expires_at
    )
    
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout and revoke refresh token"""
    await users_crud.revoke_token(current_user["username"])
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/verify")
async def verify_token_endpoint(current_user: dict = Depends(get_current_user)):
    """Verify if the current access token is valid"""
    return {
        "status": "valid", 
        "user": current_user["username"],
        "role": current_user.get("role", "admin")
    }
