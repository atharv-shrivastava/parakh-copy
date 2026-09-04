import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from gliner2 import GLiNER2
except ImportError as exc:
    raise RuntimeError('gliner2 is not installed. Run: pip install "gliner2[local]"') from exc

app = FastAPI(title="PARAKH Local Semantic Mapper")
MODEL_NAME = os.getenv("GLINER_MODEL", "fastino/gliner2-base-v1")
USE_CUDA = os.getenv("GLINER_DEVICE", "auto").lower() == "cuda"
BATCH_SIZE = max(1, int(os.getenv("GLINER_BATCH_SIZE", "8")))

LABELS = {
    "PRODUCT_NAME": "actual product name, product title, model name, or named food/product sold in the package",
    "BRAND": "consumer brand name printed on the package, distinct from the manufacturer company when possible",
    "MRP": "maximum retail price, MRP, retail price, or explicit package selling price",
    "NET_QUANTITY": "net quantity, net weight, net volume, pack quantity, or amount such as 200 g, 500 ml, 1 kg",
    "MANUFACTURER": "manufacturer or manufactured by company/person responsible for manufacturing",
    "PACKER": "packer or packed by company/person responsible for packing",
    "MARKETER": "marketer or marketed by company/person responsible for marketing",
    "IMPORTER": "importer or imported by company/person responsible for importing",
    "ADDRESS": "postal or business address associated with a manufacturer, packer, marketer, or importer",
    "BATCH_NUMBER": "batch number, lot number, batch code, lot code, or production identifier",
    "DATE_OF_MANUFACTURE": "date of manufacture, manufactured on, MFD, MFG, or manufacturing date",
    "DATE_OF_PACKING": "date of packing, packed on, PKD, or packing date",
    "BEST_BEFORE": "best before date, best before duration, use within, or shelf life declaration",
    "EXPIRY_DATE": "expiry date, expires on, use by date, or expiration date",
    "CONSUMER_CARE": "consumer care, customer care, helpline, phone, email, or consumer contact details",
    "COUNTRY_OF_ORIGIN": "country of origin or made in/product of country declaration",
    "FSSAI_LICENSE": "FSSAI license or food safety license number",
    "BARCODE": "barcode number, EAN, UPC, GTIN, or retail barcode identifier",
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


def clean_entity(value: Any) -> tuple[str, float, int | None, int | None]:
    if isinstance(value, dict):
        return str(value.get("text") or "").strip(), float(value.get("confidence", 0.0) or 0.0), value.get("start"), value.get("end")
    return str(value or "").strip(), 0.0, None, None


def best_prediction(result: dict[str, Any]):
    entities = result.get("entities", {}) if isinstance(result, dict) else {}
    best = None
    for label, values in entities.items():
        if not isinstance(values, list):
            values = [values]
        for entity in values:
            text, score, start, end = clean_entity(entity)
            if not text:
                continue
            candidate = {"type": label, "text": text, "confidence": max(0.0, min(1.0, score)), "start": start, "end": end}
            if best is None or candidate["confidence"] > best["confidence"]:
                best = candidate
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
        texts = [candidate.text for candidate in request.candidates]
        results = extractor.batch_extract_entities(
            texts,
            LABELS,
            include_confidence=True,
            include_spans=True,
            batch_size=BATCH_SIZE,
        )
        mappings = []
        for candidate, result in zip(request.candidates, results):
            prediction = best_prediction(result)
            if not prediction:
                continue
            confidence = prediction["confidence"]
            mappings.append({
                "id": candidate.id,
                "imageIndex": candidate.imageIndex,
                "type": prediction["type"],
                "text": candidate.text,
                "value": prediction["text"],
                "confidence": "HIGH" if confidence >= 0.82 else "MEDIUM" if confidence >= 0.62 else "LOW",
                "confidenceValue": confidence,
                "boundingBox": candidate.boundingBox,
                "source": "GLINER2",
            })
        return {"mappings": mappings, "provider": "gliner2-local", "model": MODEL_NAME}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Local GLiNER2 unavailable: {exc}") from exc
