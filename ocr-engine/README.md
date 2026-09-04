# Parakh OCR Engine

Standalone OCR service for package-label extraction.

PaddleOCR is the primary engine. The service exposes a provider-neutral HTTP contract so the backend can orchestrate OCR without importing OCR implementation code.

## Run

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8081
```

`GET /health` returns the service status. `POST /ocr` accepts multipart image data and returns normalized text detections with optional bounding boxes.

Gemini and Puter.js remain application-level fallback adapters and are not embedded into the PaddleOCR runtime.
