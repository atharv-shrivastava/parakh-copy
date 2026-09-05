import io
import os
import asyncio
import hashlib
import time
from typing import Any

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from rapidocr import RapidOCR

app = FastAPI(title="PARAKH RapidOCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_lang_type = os.getenv("RAPIDOCR_LANG_TYPE", "en")
_max_ocr_side = max(768, int(os.getenv("RAPIDOCR_MAX_SIDE", "1024")))
_cache_ttl = max(5, int(os.getenv("RAPIDOCR_CACHE_TTL_SECONDS", "30")))
_cache_limit = max(1, int(os.getenv("RAPIDOCR_CACHE_ITEMS", "8")))
_use_cls = os.getenv("RAPIDOCR_USE_CLS", "false").lower() == "true"
_text_score = max(0.0, min(1.0, float(os.getenv("RAPIDOCR_TEXT_SCORE", "0.5"))))

# RapidOCR is the primary and only normal hot-path OCR engine.
# ONNX Runtime CPU is RapidOCR's default inference engine when no alternative
# engine is explicitly selected.
_engine_name = "rapidocr"
_rapid_ocr = None

_result_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight: dict[str, asyncio.Task] = {}


def _get_rapidocr():
    global _rapid_ocr
    if _rapid_ocr is None:
        _rapid_ocr = RapidOCR(
            params={
                "Global.use_cls": _use_cls,
                "Global.text_score": _text_score,
                "Rec.lang_type": _lang_type,
            }
        )
    return _rapid_ocr


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _prepare_image(content: bytes):
    pil_image = ImageOps.exif_transpose(Image.open(io.BytesIO(content)).convert("RGB"))
    original_width, original_height = pil_image.size
    scale = min(1.0, _max_ocr_side / max(original_width, original_height))
    if scale < 1.0:
        width = max(1, round(original_width * scale))
        height = max(1, round(original_height * scale))
        pil_image = pil_image.resize((width, height), Image.Resampling.LANCZOS)
    return pil_image


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


def extract_result(result: Any, image_index: int):
    if result is None:
        return []

    texts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    if texts is None or scores is None:
        return []

    entries = []
    for index, value in enumerate(texts):
        text_value = str(value or "").strip()
        if not text_value:
            continue
        confidence = max(0.0, min(1.0, to_float(scores[index], 0.0) if index < len(scores) else 0.0))
        entries.append({
            "imageIndex": image_index + 1,
            "type": "OCR_TEXT",
            "text": text_value,
            "confidence": confidence,
            "source": "rapidocr",
        })
    return entries


async def _analyze_contents(items: list[tuple[bytes, str]]):
    started_at = time.monotonic()

    prepared = []
    for image_index, (content, _media_type) in enumerate(items[:6]):
        try:
            pil_image = _prepare_image(content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image {image_index + 1}: {exc}") from exc
        prepared.append(np.asarray(pil_image))

    rapid = _get_rapidocr()
    all_entries = []
    raw_text_parts = []
    engine_ms = 0

    for image_index, array in enumerate(prepared):
        image_started = time.monotonic()
        result = await asyncio.to_thread(lambda arr=array: rapid(arr))
        engine_ms += round((time.monotonic() - image_started) * 1000)
        entries = extract_result(result, image_index)
        all_entries.extend(entries)
        raw_text_parts.append("\n".join(entry["text"] for entry in entries))

    elapsed_ms = round((time.monotonic() - started_at) * 1000)
    return {
        "provider": "rapidocr",
        "model": "RapidOCR",
        "timingMs": elapsed_ms,
        "engineTimingMs": engine_ms,
        "result": {
            "declarationEvidence": all_entries,
            "rawText": "\n\n".join(part for part in raw_text_parts if part).strip(),
            "warnings": [],
            "unreadableFields": [],
            "needsReview": any(entry["confidence"] < 0.6 for entry in all_entries),
        },
    }


@app.on_event("startup")
async def warmup():
    try:
        started_at = time.monotonic()
        rapid = _get_rapidocr()
        warm_image = np.full((256, 256, 3), 255, dtype=np.uint8)
        await asyncio.to_thread(lambda: rapid(warm_image))
        elapsed_ms = round((time.monotonic() - started_at) * 1000)
        print(f"[ocr:rapid] warmup complete in {elapsed_ms}ms useCls={_use_cls} textScore={_text_score}")
    except Exception as exc:
        print(f"[ocr:rapid] warmup skipped: {exc}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-rapidocr", "engine": "RapidOCR"}


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
        return {**cached, "cached": True}

    existing = _inflight.get(key)
    if existing is not None:
        result = await existing
        return {**result, "cached": True}

    task = asyncio.create_task(_analyze_contents(items))
    _inflight[key] = task
    try:
        result = await task
        _store_cached(key, result)
        return {**result, "cached": False}
    finally:
        _inflight.pop(key, None)
