import os
import uvicorn
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMSMiddleware
from pydantic import BaseModel
from typing import Optional
from predict import analyze, load_classifier, load_clip

app = FastAPI(title="VeriLens ML Service", description="Multimodal Misinformation Verification with CLIP")

app.add_middleware(
    CORSMSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    image_url: str
    claim: str
    language: Optional[str] = "auto"
    type: Optional[str] = "image-text"

@app.on_event("startup")
def startup():
    # Warm up models on startup
    load_classifier()
    load_clip()

@app.get("/health")
def health():
    return {"status": "ok", "service": "verilens-ml"}

@app.post("/analyze")
def analyze_endpoint(payload: AnalyzeRequest, x_api_key: Optional[str] = Header(None)):
    expected_key = os.getenv("ML_API_KEY")
    if expected_key and x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        result = analyze(
            image_url=payload.image_url,
            claim=payload.claim,
            language=payload.language or "auto",
            input_type=payload.type or "image-text"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
