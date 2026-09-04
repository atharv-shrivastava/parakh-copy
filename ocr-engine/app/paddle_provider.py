import io
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR

class PaddleProvider:
    def __init__(self):
        self.ocr = PaddleOCR(lang="en")

    def extract(self, image_bytes: bytes):
        image = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
        result = self.ocr.predict(image)
        detections = []
        for page in result or []:
            data = getattr(page, "json", None)
            payload = data() if callable(data) else data
            if isinstance(payload, dict):
                payload = payload.get("res", payload)
            texts = payload.get("rec_texts", []) if isinstance(payload, dict) else []
            scores = payload.get("rec_scores", []) if isinstance(payload, dict) else []
            boxes = payload.get("rec_polys", []) if isinstance(payload, dict) else []
            for i, text in enumerate(texts):
                box = boxes[i] if i < len(boxes) else None
                score = scores[i] if i < len(scores) else None
                detections.append({"text": str(text), "confidence": float(score) if score is not None else None, "boundingBox": box})
        return {"provider": "paddleocr", "detections": detections}
