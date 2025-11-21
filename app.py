from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from config import config
from database import db
from embeddings import embedding_service
from models import HealthResponse
from routes import router
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup: Validate config and initialize connections
    config.validate()
    db.connect()
    embedding_service.initialize()
    yield
    # Shutdown: Close connections
    db.close()

app = FastAPI(
    title="AI Memory API",
    description="API for generating embeddings and storing them in Neo4j",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"], 
)

@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    try:
        db.driver.verify_connectivity()
        return HealthResponse(status="healthy", neo4j="connected", gemini="configured")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# Include routes
app.include_router(router)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
