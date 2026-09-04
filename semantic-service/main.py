import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from gliner2 import GLiNER2
except ImportError as exc:  # pragma: no cover
    raise RuntimeError(
        "gliner2 is not installed. Run: pip install \"gliner2[local]\""
    ) from exc

app = FastAPI(title="PARAKH Local Semantic Mapper")

MODEL_NAME = os.getenv("GLINER_MODEL", "fastino/gliner2-base-v1")
USE_CUDA = os.getenv("GLINER_DEVICE", "auto").lower() == "cuda"

LABELS = {
    "PRODUCT_NAME": "the actual product name, product title, model name, or named food/product sold in the package",
    "BRAND": "the consumer brand name printed on the package, not the manufacturer company unless it is clearly the brand",
    "MRP": "maximum retail price, MRP, retail price, or a price amount that is explicitly the package selling price",
    "NET_QUANTITY": "net quantity, net weight, net volume, pack quantity, or amount such as 200 g, 500 ml, 1 kg",
    "MANUFACTURER": "manufacturer or manufactured by company/person responsible for manufacturing the packaged product",
    "PACKER": "packer or packed by company/person responsible for packing the product",
    "MARKETER": "marketer or marketed by company/person responsible for marketing the product",
    "IMPORTER": "importer or imported by company/person responsible for importing the product",
    "ADDRESS": "postal or business address associated with manufacturer, packer, marketer, or importer",
    "BATCH_NUMBER": "batch number, lot number, batch code, lot code, or similar production identifier",
    "DATE_OF_MANUFACTURE": "date of manufacture, manufactured on, MFD, MFG, or manufacturing date",
    "DATE_OF_PACKING": "date of packing, packed on, PKD, or packing date",
    "BEST_BEFORE": "best before date, best before duration, use within, or shelf life declaration",
    "EXPIRY_DATE": "expiry date, expires on, use by date, or expiration date",
    "CONSUMER_CARE": "consumer care, customer care, helpline, phone, email, or contact details provided for consumer support",
    "COUNTRY_OF_ORIGIN": "country of origin or made in/product of country declaration",
    "FSSAI_LICENSE": "FSSAI license or food safety license number",
    "BARCODE": "barcode number, EAN, UPC, GTIN, or other retail barcode identifier",
}

class Candidate(BaseModel):
    id: str
    imageIndex: int = 0
    text: str
    confidence: float = 0.0
    boundingBox: dict[str, float] | None = None

class MapRequest(BaseModel):
    candidates: list[Candidate] = Field(default_factory=list)

model = None


def get_model():
    global model
    if model is None:
        kwargs: dict[str, Any] = {}
        if USE_CUDA:
            kwargs["map_location"] = "cuda"
        model = GLiNER2.from_pretrained(MODEL_NAME, **kwargs)
    return model


def clean_entity(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("text") or "").strip()
    return str(value or "").strip()


def best_match(line: str, entity_text: str) -> float:
    a = " ".join(line.lower().split())
    b = " ".join(entity_text.lower().split())
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if b in a or a in b:
        return min(len(b), len(a)) / max(len(b), len(a))
    return 0.0


def predict_line(extractor, candidate: Candidate):
    result = extractor.extract_entities(
        candidate.text,
        LABELS,
        include_confidence=True,
        include_spans=True,
    )
    entities = result.get("entities", {}) if isinstance(result, dict) else {}
    best = None
    for label, values in entities.items():
        if not isinstance(values, list):
            values = [values]
        for entity in values:
            text = clean_entity(entity)
            if not text:
                continue
            match = best_match(candidate.text, text)
            if match <= 0:
                continue
            if isinstance(entity, dict):
                score = float(entity.get("confidence", 0.0) or 0.0)
                start = entity.get("start")
                end = entity.get("end")
            else:
                score = 0.0
                start = None
                end = None
            combined = score * 0.8 + match * 0.2
            if best is None or combined > best["combined"]:
                best = {
                    "type": label,
                    "text": text,
                    "confidence": max(0.0, min(1.0, score)),
                    "start": start,
                    "end": end,
                    "combined": combined,
                }
    return best


@app.get("/health")
def health():
    return {"status": "ok", "service": "parakh-gliner2", "model": MODEL_NAME}


@app.post("/map")
def map_candidates(request: MapRequest):
    if not request.candidates:
        return {"mappings": [], "provider": "gliner2-local", "model": MODEL_NAME}

    try:
        extractor = get_model()
        mappings = []
        for candidate in request.candidates:
            try:
                prediction = predict_line(extractor, candidate)
            except Exception:
                prediction = None
            if not prediction:
                continue
            confidence = prediction["confidence"]
            confidence_label = "HIGH" if confidence >= 0.82 else "MEDIUM" if confidence >= 0.62 else "LOW"
            mappings.append({
                "id": candidate.id,
                "imageIndex": candidate.imageIndex,
                "type": prediction["type"],
                "text": candidate.text,
                "value": prediction["text"],
                "confidence": confidence_label,
                "confidenceValue": confidence,
                "boundingBox": candidate.boundingBox,
                "source": "GLINER2",
            })
        return {"mappings": mappings, "provider": "gliner2-local", "model": MODEL_NAME}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Local semantic mapper unavailable: {exc}") from exc
