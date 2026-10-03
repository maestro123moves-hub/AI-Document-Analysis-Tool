from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="DocuMind AI",
    description="AI Document Processing and Analysis Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routers.auth import router as auth_router
from app.routers.documents import router as documents_router
from app.routers.processing import router as processing_router

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(processing_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
