from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import project modules
import config
from routers import router

app = FastAPI(
    title="NikoClip API",
    version="1.0.0",
    description="API for NikoClip",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# --- CORS SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://niko-clip.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DIRECTORY SETUP ---
config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# --- ROUTER SETUP ---
app.include_router(router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
