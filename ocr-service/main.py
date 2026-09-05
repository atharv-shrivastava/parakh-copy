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

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

try:
    from rapidocr import RapidOCR
except ImportError:
    RapidOCR = None

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
_use_textline_orientation = os.getenv("PADDLEOCR_TEXTLINE_ORIENTATION", "true").lower() == "true"
_max_ocr_side = max(800, int(os.getenv("PADDLEOCR_MAX_SIDE", "1200")))
_cache_ttl = max(5, int(os.getenv("PADDLEOCR_CACHE_TTL_SECONDS", "30")))
_cache_limit = max(1, int(os.getenv("PADDLEOCR_CACHE_ITEMS", "8")))

# PaddleOCR is the preferred engine. RapidOCR remains available only as an explicit fallback.
_engine_name = os.getenv("OCR_ENGINE", "paddleocr").lower()
_rapid_use_cls = os.getenv("RAPIDOCR_TEXT_ORIENTATION", "true").lower() == "true"
_skew_rescue_enabled = os.getenv("PADDLEOCR_SKEW_RESCUE", "true").lower() == "true"
_skew_min_degrees = max(1.5, float(os.getenv("PADDLEOCR_SKEW_MIN_DEGREES", "2.5")))
_skew_max_degrees = max(_skew_min_degrees, float(os.getenv("PADDLEOCR_SKEW_MAX_DEGREES", "18")))
_skew_min_line_length = max(20, int(os.getenv("PADDLEOCR_SKEW_MIN_LINE_LENGTH", "40")))
_paddle_ocr = None
_rapid_ocr = None

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


def _get_rapidocr():
    global _rapid_ocr
    if _rapid_ocr is None:
        if RapidOCR is None:
            raise RuntimeError("RapidOCR is not installed. Run: pip install rapidocr onnxruntime")
        _rapid_ocr = RapidOCR(params={
            "Global.use_cls": _rapid_use_cls,
            "Det.lang_type": "en",
            "Rec.lang_type": "en",
        })
    return _rapid_ocr


def _get_paddleocr():
    global _paddle_ocr
    if _paddle_ocr is None:
        _paddle_ocr = PaddleOCR(
            lang=_lang,
            use_doc_orientation_classify=_use_doc_orientation,
            use_doc_unwarping=_use_doc_unwarping,
            use_textline_orientation=_use_textline_orientation,
            enable_mkldnn=False,
        )
    return _paddle_ocr


def extract_rapid_result(result: Any, image_index: int, width: int, height: int):
    boxes = getattr(result, "boxes", None)
    texts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    if boxes is None or texts is None:
        return []

    entries = []
    for index, text in enumerate(texts):
        text_value = str(text or "").strip()
        if not text_value:
            continue
        score = to_float(scores[index], 0.0) if scores is not None and index < len(scores) else 0.0
        points = boxes[index].tolist() if index < len(boxes) and hasattr(boxes[index], "tolist") else boxes[index] if index < len(boxes) else None
        box = normalize_box(points, width, height)
        entries.append({
            "imageIndex": image_index + 1,
            "type": "OCR_TEXT",
            "text": text_value,
            "confidence": max(0.0, min(1.0, score)),
            "boundingBox": box,
            "source": "rapidocr",
        })
    return entries


def estimate_skew_degrees(image_array: np.ndarray) -> float:
    try:
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        height, width = gray.shape[:2]
        scale = min(1.0, 900.0 / max(height, width))
        if scale < 1.0:
            gray = cv2.resize(gray, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv2.INTER_AREA)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        edges = cv2.Canny(blurred, 60, 160, apertureSize=3)
        min_line = max(20, int(_skew_min_line_length * scale))
        lines = cv2.HoughLinesP(
            edges,
            1,
            np.pi / 180.0,
            threshold=max(20, int(min(gray.shape) * 0.04)),
            minLineLength=min_line,
            maxLineGap=max(8, int(min_line * 0.35)),
        )
        if lines is None:
            return 0.0

        weighted_angles = []
        for line in lines[:, 0]:
            x1, y1, x2, y2 = [int(value) for value in line]
            dx = x2 - x1
            dy = y2 - y1
            length = float((dx * dx + dy * dy) ** 0.5)
            if length < min_line:
                continue
            angle = float(np.degrees(np.arctan2(dy, dx)))
            while angle <= -90.0:
                angle += 180.0
            while angle > 90.0:
                angle -= 180.0
            if abs(angle) <= _skew_max_degrees:
                weighted_angles.append((angle, length))

        if len(weighted_angles) < 3:
            return 0.0

        weighted_angles.sort(key=lambda item: item[0])
        total_weight = sum(weight for _, weight in weighted_angles)
        midpoint = total_weight / 2.0
        running = 0.0
        for angle, weight in weighted_angles:
            running += weight
            if running >= midpoint:
                if abs(angle) < _skew_min_degrees:
                    return 0.0
                return angle
    except Exception:
        return 0.0
    return 0.0


def rotate_image(image: Image.Image, degrees: float) -> Image.Image:
    return image.rotate(degrees, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(255, 255, 255))


def dedupe_entries(primary: list[dict[str, Any]], rescue: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = list(primary)
    for candidate in rescue:
        normalized = " ".join(candidate.get("text", "").split()).casefold()
        duplicate_index = None
        for index, existing in enumerate(merged):
            existing_normalized = " ".join(existing.get("text", "").split()).casefold()
            if normalized and normalized == existing_normalized:
                duplicate_index = index
                break
        if duplicate_index is None:
            merged.append(candidate)
        elif float(candidate.get("confidence", 0)) > float(merged[duplicate_index].get("confidence", 0)):
            merged[duplicate_index] = candidate
    return merged


async def _run_rapid_with_skew_rescue(image_array: np.ndarray, image_index: int, width: int, height: int):
    engine = _get_rapidocr()
    base_result = await asyncio.to_thread(engine, image_array, use_cls=_rapid_use_cls)
    base_entries = extract_rapid_result(base_result, image_index, width, height)

    if not _skew_rescue_enabled:
        return base_entries

    skew = estimate_skew_degrees(image_array)
    if abs(skew) < _skew_min_degrees:
        return base_entries

    rescue_pil = rotate_image(Image.fromarray(image_array), -skew)
    rescue_array = np.asarray(rescue_pil)
    rescue_height, rescue_width = rescue_array.shape[:2]
    rescue_result = await asyncio.to_thread(engine, rescue_array, use_cls=_rapid_use_cls)
    rescue_entries = extract_rapid_result(rescue_result, image_index, rescue_width, rescue_height)
    return dedupe_entries(base_entries, rescue_entries)


async def _run_ocr_engine(image_array: np.ndarray, image_index: int, width: int, height: int):
    if _engine_name == "paddleocr":
        result = await asyncio.to_thread(_get_paddleocr().predict, image_array)
        entries = []
        for item in result:
            entries.extend(extract_result(item, image_index, width, height))
        return entries, "paddleocr"

    if _engine_name == "rapidocr":
        entries = await _run_rapid_with_skew_rescue(image_array, image_index, width, height)
        if entries:
            return entries, "rapidocr"
        result = await asyncio.to_thread(_get_paddleocr().predict, image_array)
        paddle_entries = []
        for item in result:
            paddle_entries.extend(extract_result(item, image_index, width, height))
        return paddle_entries, "paddleocr-fallback"

    raise RuntimeError(f"Unsupported OCR_ENGINE '{_engine_name}'. Use paddleocr or rapidocr.")


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
    pil_image = ImageOps.exif_transpose(Image.open(io.BytesIO(content)).convert("RGB"))
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
    engine_used = _engine_name

    for image_index, (content, _media_type) in enumerate(items[:6]):
        try:
            pil_image = _prepare_image(content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image {image_index + 1}: {exc}") from exc

        width, height = pil_image.size
        image_array = np.asarray(pil_image)
        entries, engine_used = await _run_ocr_engine(image_array, image_index, width, height)

        all_entries.extend(entries)
        raw_text_parts.append("\n".join(entry["text"] for entry in entries))

    return {
        "provider": engine_used,
        "model": "RapidOCR" if engine_used == "rapidocr" else "PaddleOCR",
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
