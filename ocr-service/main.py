import io
import os
from typing import Any

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from paddleocr import PaddleOCR

app = FastAPI(title="PARAKH PaddleOCR Service")

# Allow the PARAKH frontend to communicate with the local PaddleOCR service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_lang = os.getenv("PADDLEOCR_LANG", "en")
_use_doc_orientation = os.getenv("PADDLEOCR_DOC_ORIENTATION", "false").lower() == "true"
_use_doc_unwarping = os.getenv("PADDLEOCR_DOC_UNWARPING", "false").lower() == "true"
_use_textline_orientation = os.getenv("PADDLEOCR_TEXTLINE_ORIENTATION", "true").lower() == "true"

ocr = PaddleOCR(
    lang=_lang,
    use_doc_orientation_classify=_use_doc_orientation,
    use_doc_unwarping=_use_doc_unwarping,
    use_textline_orientation=_use_textline_orientation,
)


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_box(points: Any, width: int, height: int):
    if not points:
        return None
    try:
        xs = [to_float(point[0]) for point in points]
        ys = [to_float(point[1]) for point in points]
        if not xs or not ys:
            return None
        left = max(0.0, min(xs)) / max(1, width)
        top = max(0.0, min(ys)) / max(1, height)
        right = min(float(width), max(xs)) / max(1, width)
        bottom = min(float(height), max(ys)) / max(1, height)
        if right <= left or bottom <= top:
            return None
        return {"left": left, "top": top, "width": right - left, "height": bottom - top}
    except (TypeError, IndexError, ValueError):
        return None


def extract_result(result: Any, image_index: int, width: int, height: int):
    data = getattr(result, "json", None)
    if callable(data):
        data = data()
    if not isinstance(data, dict):
        data = result if isinstance(result, dict) else {}

    payload = data.get("res", data)
    if not isinstance(payload, dict):
        return []

    texts = payload.get("rec_texts") or payload.get("texts") or []
    scores = payload.get("rec_scores") or payload.get("scores") or []
    boxes = payload.get("rec_polys") or payload.get("dt_polys") or payload.get("polys") or []

    entries = []
    for index, text in enumerate(texts):
        text_value = str(text or "").strip()
        if not text_value:
            continue
        confidence = max(0.0, min(1.0, to_float(scores[index], 0.0) if index < len(scores) else 0.0))
        box = normalize_box(boxes[index], width, height) if index < len(boxes) else None
        entries.append({
            "imageIndex": image_index + 1,
            "type": "OCR_TEXT",
            "text": text_value,
            "confidence": confidence,
            "boundingBox": box,
            "source": "paddleocr",
        })
    return entries


@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-paddleocr"}


@app.post("/api/ocr/analyze")
async def analyze(images: list[UploadFile] = File(...)):
    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required.")

    all_entries = []
    raw_text_parts = []

    for image_index, upload in enumerate(images[:6]):
        content = await upload.read()
        try:
            pil_image = Image.open(io.BytesIO(content)).convert("RGB")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image {image_index + 1}: {exc}") from exc

        width, height = pil_image.size
        result = ocr.predict(pil_image)
        entries = []
        for item in result:
            entries.extend(extract_result(item, image_index, width, height))

        all_entries.extend(entries)
        raw_text_parts.append("\n".join(entry["text"] for entry in entries))

    return {
        "provider": "paddleocr",
        "model": "PaddleOCR",
        "result": {
            "declarationEvidence": all_entries,
            "rawText": "\n\n".join(part for part in raw_text_parts if part).strip(),
            "warnings": [],
            "unreadableFields": [],
            "needsReview": any(entry["confidence"] < 0.6 for entry in all_entries),
        },
    }
