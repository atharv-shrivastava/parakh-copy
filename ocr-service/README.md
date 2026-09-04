# PARAKH PaddleOCR service

Small local OCR service for package-image text detection and bounding-box extraction.

## Start

```powershell
cd ocr-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080
```

Health check: `http://localhost:8080/health`

The service returns OCR text, confidence, image index and normalized bounding boxes. Confidence does not filter evidence; low-confidence detections remain reviewable.

## Language

Set `PADDLEOCR_LANG` before starting the service. The default is `en`. Use a PaddleOCR-supported language code when additional scripts are required.
