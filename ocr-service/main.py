import io
import os
import asyncio
import hashlib
import time
from typing import Any

# PaddleX can enable oneDNN by default on CPU. On some Windows/PaddlePaddle 3.x
# combinations this triggers the PIR/oneDNN runtime conversion error during OCR.
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from paddleocr import PaddleOCR

app = FastAPI(title="PARAKH PaddleOCR Service")

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
# Upright package photos are the normal case. Orientation classification is opt-in
# because it adds CPU latency to every scan.
_use_textline_orientation = os.getenv("PADDLEOCR_TEXTLINE_ORIENTATION", "false").lower() == "true"
_max_ocr_side = max(800, int(os.getenv("PADDLEOCR_MAX_SIDE", "1400")))
_cache_ttl = max(5, int(os.getenv("PADDLEOCR_CACHE_TTL_SECONDS", "30")))
_cache_limit = max(1, int(os.getenv("PADDLEOCR_CACHE_ITEMS", "8")))

ocr = PaddleOCR(
    lang=_lang,
    use_doc_orientation_classify=_use_doc_orientation,
    use_doc_unwarping=_use_doc_unwarping,
    use_textline_orientation=_use_textline_orientation,
    enable_mkldnn=False,
)

_result_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight: dict[str, asyncio.Task] = {}


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


def _cache_key(items: list[tuple[bytes, str]]) -> str:
    digest = hashlib.sha256()
    for content, media_type in items:
        digest.update(media_type.encode("utf-8"))
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def _get_cached(key: str):
    cached = _result_cache.get(key)
    if not cached:
        return None
    created_at, result = cached
    if time.monotonic() - created_at > _cache_ttl:
        _result_cache.pop(key, None)
        return None
    return result


def _store_cached(key: str, result: dict[str, Any]):
    _result_cache[key] = (time.monotonic(), result)
    while len(_result_cache) > _cache_limit:
        oldest_key = min(_result_cache, key=lambda cache_key: _result_cache[cache_key][0])
        _result_cache.pop(oldest_key, None)


def _prepare_image(content: bytes):
    pil_image = Image.open(io.BytesIO(content)).convert("RGB")
    original_width, original_height = pil_image.size
    scale = min(1.0, _max_ocr_side / max(original_width, original_height))
    if scale < 1.0:
        width = max(1, round(original_width * scale))
        height = max(1, round(original_height * scale))
        pil_image = pil_image.resize((width, height), Image.Resampling.LANCZOS)
    return pil_image


async def _analyze_contents(items: list[tuple[bytes, str]]):
    all_entries = []
    raw_text_parts = []

    for image_index, (content, _media_type) in enumerate(items[:6]):
        try:
            pil_image = _prepare_image(content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image {image_index + 1}: {exc}") from exc

        width, height = pil_image.size
        image_array = np.asarray(pil_image)
        result = ocr.predict(image_array)

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


@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-paddleocr"}


@app.post("/api/ocr/analyze")
async def analyze(images: list[UploadFile] = File(...)):
    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required.")

    items = []
    for upload in images[:6]:
        content = await upload.read()
        items.append((content, upload.content_type or "image/jpeg"))

    key = _cache_key(items)
    cached = _get_cached(key)
    if cached is not None:
        return cached

    task = _inflight.get(key)
    if task is None:
        task = asyncio.create_task(_analyze_contents(items))
        _inflight[key] = task

    try:
        result = await task
    finally:
        if _inflight.get(key) is task:
            _inflight.pop(key, None)

    _store_cached(key, result)
    return result
