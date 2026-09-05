import io
import os
import asyncio
import hashlib
import time
from typing import Any

# Keep oneDNN disabled on this Windows/PaddlePaddle combination because it has
# previously triggered PIR/oneDNN conversion errors during inference.
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

app = FastAPI(title="PARAKH PaddleOCR Service")

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

_lang = os.getenv("PADDLEOCR_LANG", "en")
_max_ocr_side = max(768, int(os.getenv("PADDLEOCR_MAX_SIDE", "1024")))
_cache_ttl = max(5, int(os.getenv("PADDLEOCR_CACHE_TTL_SECONDS", "30")))
_cache_limit = max(1, int(os.getenv("PADDLEOCR_CACHE_ITEMS", "8")))
_cpu_threads = max(1, int(os.getenv("PADDLEOCR_CPU_THREADS", "10")))
_text_recognition_batch_size = max(1, min(int(os.getenv("PADDLEOCR_TEXT_RECOGNITION_BATCH_SIZE", "6")), 16))
_paddle_warmup = os.getenv("PADDLEOCR_WARMUP", "true").lower() == "true"

# PARAKH uses PaddleOCR as the primary and only normal hot-path OCR engine.
# RapidOCR code was removed from the hot path so a stale OCR_ENGINE setting
# cannot silently route scans through a different engine.
_engine_name = "paddleocr"
_paddle_ocr = None

_result_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight: dict[str, asyncio.Task] = {}


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def extract_result(result: Any, image_index: int):
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
            "source": "paddleocr",
        })
    return entries


def _get_paddleocr():
    global _paddle_ocr
    if _paddle_ocr is None:
        _paddle_ocr = PaddleOCR(
            lang=_lang,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
            device="cpu",
            cpu_threads=_cpu_threads,
            text_recognition_batch_size=_text_recognition_batch_size,
        )
    return _paddle_ocr


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


async def _analyze_contents(items: list[tuple[bytes, str]]):
    started_at = time.monotonic()

    prepared = []
    for image_index, (content, _media_type) in enumerate(items[:6]):
        try:
            pil_image = _prepare_image(content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image {image_index + 1}: {exc}") from exc
        width, height = pil_image.size
        prepared.append((np.asarray(pil_image), width, height))

    arrays = [item[0] for item in prepared]
    paddle = _get_paddleocr()

    # PaddleOCR supports list inputs. One pipeline invocation avoids repeatedly
    # paying per-image pipeline overhead and lets text recognition batch work.
    results = await asyncio.to_thread(lambda: list(paddle.predict(arrays)))

    all_entries = []
    raw_text_parts = []
    for image_index, (result, (_array, _width, _height)) in enumerate(zip(results, prepared)):
        entries = extract_result(result, image_index)
        all_entries.extend(entries)
        raw_text_parts.append("\n".join(entry["text"] for entry in entries))

    elapsed_ms = round((time.monotonic() - started_at) * 1000)
    return {
        "provider": "paddleocr",
        "model": "PaddleOCR",
        "timingMs": elapsed_ms,
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
    if not _paddle_warmup:
        return
    try:
        started_at = time.monotonic()
        paddle = _get_paddleocr()
        warm_image = np.full((256, 256, 3), 255, dtype=np.uint8)
        await asyncio.to_thread(lambda: list(paddle.predict([warm_image])))
        elapsed_ms = round((time.monotonic() - started_at) * 1000)
        print(f"[ocr:paddle] warmup complete in {elapsed_ms}ms threads={_cpu_threads} recBatch={_text_recognition_batch_size}")
    except Exception as exc:
        # Do not prevent the HTTP service from starting if warmup fails.
        print(f"[ocr:paddle] warmup skipped: {exc}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-paddleocr", "engine": "PaddleOCR"}


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
