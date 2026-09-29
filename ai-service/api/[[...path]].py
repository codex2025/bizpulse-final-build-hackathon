"""
Vercel Python entrypoint. Vercel's Python runtime serves an ASGI app found at
`api/*.py` directly, so this just re-exports the real FastAPI app defined in
app/main.py -- nothing about the application code differs between local runs
(`uvicorn app.main:app`) and this deployment.
"""
import os
import sys

# Make the ai-service root importable as `app.*` when Vercel runs this file
# directly (its working directory for the function is the project root, but
# being explicit here is cheap insurance against runtime path differences).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402
