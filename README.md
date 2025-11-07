# niko-clip

AI-powered smile highlight generator that turns raw footage into ready-to-share thumbnails and hero frames.

## Overview
- Extract the happiest frames from any video and generate download-ready assets for social media.
- Frontend powered by Next.js; backend built with FastAPI, Redis, and OpenVINO for real-time inference.
- Designed for content creators who need fast, on-brand thumbnails without manual frame-by-frame editing.

## Key Features
- Upload a video via `POST /tasks` and receive curated still-image candidates with AI smile scores.
- Track real-time progress and retrieve results through `GET /tasks/{task_id}`.
- Download Base64-encoded images instantly for YouTube thumbnails, Instagram Reels covers, or TikTok shorts.
- Show users clear status updates for processing, success, and error states.

## Repository Structure
```
backend/   FastAPI + OpenVINO inference API
frontend/  Next.js single-page experience for uploads and downloads
```

## Requirements
- Python 3.12+
- Node.js 18+ (LTS recommended)
- Redis 6+
- CPU compatible with OpenVINO 2024.6 (GPU / VPU optional)

## Setup

### 1. Shared Prerequisites
1. Clone this repository.
2. (Optional) Create `.env` inside `backend/`:
   - `UPLOADS_DIR` — temp directory for uploaded videos (default `/tmp/uploads`).
   - `REDIS_URL` — Redis connection string (default `redis://localhost:6379/0`).
   - `MAX_BASE64_IMAGE_SIZE_MB` — maximum payload size when encoding images.

### 2. Run with Docker Compose (Recommended)
```
cd backend
docker compose up --build
```

- `backend` service launches the FastAPI app, `redis` service runs Redis.
- Health check: `http://localhost:8000/health`
- Interactive docs: `http://localhost:8000/docs`
- Stop containers with `docker compose down`.

### 3. Local Development (Without Docker)
#### Backend
```
cd backend

# Install dependencies (example using uv)
uv sync

# Ensure Redis is running locally (brew services or docker compose for redis-only)

# Launch API
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- OpenVINO models are bundled under `backend/models/intel/`.
- Explore the OpenAPI schema at `http://localhost:8000/docs`.

#### Frontend
```
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

- Configure the API base URL with `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).
- Visit `http://localhost:3000` to use the app.

## Usage Flow
1. Select a video in the frontend and upload it.
2. The backend detects faces, evaluates smiles, and ranks the brightest moments with OpenVINO.
3. Results are stored in Redis with base64 image data, timestamps, and smile scores.
4. The client polls for status updates and exposes download buttons for each best-shot frame.

## Core API Endpoints
- `GET /health` — service heartbeat.
- `POST /tasks` — submit a new video processing task.
- `GET /tasks/{task_id}` — fetch task status and processed results.

## Developer Commands
- Backend tests: `uv run pytest`
- Frontend lint: `npm run lint`