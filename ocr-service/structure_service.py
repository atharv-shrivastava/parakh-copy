import io
import os
from typing import Any

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

try:
    from paddleocr import PPStructureV3
except ImportError as exc:
    raise RuntimeError('PP-StructureV3 dependencies are missing. Run: pip install "paddleocr[doc-parser]"') from exc

app = FastAPI(title="PARAKH PP-StructureV3 Service")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

pipeline = None

def get_pipeline():
    global pipeline
    if pipeline is None:
        pipeline = PPStructureV3(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device=os.getenv("PADDLE_STRUCTURE_DEVICE", "cpu"),
        )
    return pipeline

def jsonable(value: Any):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if hasattr(value, "tolist"):
        return jsonable(value.tolist())
    if hasattr(value, "to_dict"):
        return jsonable(value.to_dict())
    return str(value)

@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-pp-structurev3"}

@app.post("/api/structure/analyze")
async def analyze(image: UploadFile = File(...)):
    content = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(content)).convert("RGB")
        result = next(get_pipeline().predict(pil_image))
        return {"provider": "pp-structurev3", "model": "PP-StructureV3", "result": jsonable(getattr(result, "json", result))}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PP-StructureV3 failed: {exc}") from exc
