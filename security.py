from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from config import config

# This tells FastAPI to look for a header named "x-api-key"
api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)

async def validate_api_key(api_key_header: str = Security(api_key_header)):
    """
    Validate that the incoming request has the correct API Key.
    """
    if api_key_header == config.VITE_API_SECRET:
        return api_key_header
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API Key"
    )