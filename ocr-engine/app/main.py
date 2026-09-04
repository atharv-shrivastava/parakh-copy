from fastapi import FastAPI, File, UploadFile, HTTPException
from .paddle_provider import PaddleProvider

app = FastAPI(title="Parakh OCR Engine", version="1.0.0")
provider = PaddleProvider()

@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-ocr-engine", "provider": "paddleocr"}

@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image uploads are supported")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    try:
        return provider.extract(data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OCR provider failed: {exc}") from exc
