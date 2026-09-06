# PARAKH AI and OCR Modules

## 1. AI Philosophy

PARAKH uses AI where it adds value: semantic interpretation, structured field extraction, classification assistance, uncertainty handling, and package understanding.

Deterministic software is preferred for deterministic checks.

The system must never fabricate missing declarations.

## 2. Current Pipeline

```text
Package image(s)
      ↓
RapidOCR
      ↓
OCR evidence + confidence + geometry
      ↓
Local deterministic field reconciliation
      ↓
Gemini + Cloudflare semantic providers
      ↓
Semantic consensus
      ↓
Structured inspection fields
      ↓
Visual screening + compliance
```

## 3. OCR Layer

The current production path uses the configured RapidOCR service.

OCR evidence can include:

- Text
- Confidence
- Image index
- Bounding box
- Image dimensions

RapidOCR is responsible for detection/OCR evidence, not legal interpretation.

## 4. Deterministic Field Reconciliation

The local reconciler maps OCR detections into structured fields.

Current matching strategies include:

- Declaration label anchors
- Spatial proximity
- Relative position
- Text similarity
- Confidence weighting
- Product/brand candidate scoring
- Quantity/date/MRP/batch/barcode patterns
- Geometry-aware evidence selection

The reconciler intentionally preserves uncertainty.

## 5. Target Fields

Where applicable, the system can extract:

- Brand
- Product name
- Net quantity
- Unit
- MRP
- Manufacturer
- Manufacturer address
- Packer
- Packer address
- Marketer
- Marketer address
- Importer
- Importer address
- Manufacturing date
- Packing date
- Best-before / expiry
- Batch number
- Consumer-care phone
- Consumer-care email
- Country of origin
- FSSAI license number
- Barcode

## 6. Semantic Providers

The current semantic fan-out supports:

- Gemini
- Cloudflare Gemma
- Cloudflare Moondream

Each provider runs independently.

A provider can be unavailable because of:

- Missing credentials
- Quota/rate limits
- Authentication failures
- Provider errors
- Model errors
- Empty responses
- Timeout

Provider failures are logged with the provider and model name.

Moondream is currently treated as a best-effort provider with a bounded timeout so a slow vision model does not block the rest of the pipeline indefinitely.

## 7. Semantic Consensus

Successful provider outputs are reconciled field by field.

The consensus logic can:

- select majority agreement
- preserve a single-provider result with reduced confidence
- mark conflicting successful values as ambiguous
- ignore unavailable providers

Consensus does not convert an AI prediction into a legal determination.

## 8. Confidence

Confidence describes the reliability of extraction or interpretation.

It is not legal certainty.

The system should preserve separate concepts for:

- OCR confidence
- Field confidence
- Product/category confidence
- Rule applicability
- Compliance result
- Officer verification

## 9. Visual Screening

The current scanning result can include assistive visual screening for:

- Readability
- Relative text size
- Declaration placement
- Detected text regions
- Image quality-related review signals

Approximate physical measurements derived from a photograph must be labeled as estimates unless reliable calibration exists.

## 10. Evidence Localization

Whenever geometry is available, extracted values should retain source image and bounding-box information.

This supports:

- Evidence highlighting
- Source-image review
- Declaration evidence
- Auditable field correction

## 11. Human Review Triggers

Manual review should be considered for:

- Low OCR confidence
- Low semantic confidence
- Conflicting providers
- Conflicting package images
- Missing critical fields
- Ambiguous classification
- Poor image quality
- Uncertain placement/readability
- Context-dependent legal requirements

## 12. Compliance Boundary

AI may suggest a likely declaration or issue.

The compliance engine determines rule outcomes from structured data and configured rule logic.

Example:

```text
OCR:
MRP = ₹20
      ↓
Field reconciliation
      ↓
Applicable rule
      ↓
Deterministic / configured validation
      ↓
Finding + evidence
      ↓
Officer verification
```

## 13. Failure Observability

Every semantic provider should produce enough backend logging to answer:

- Which provider ran?
- Which model ran?
- Did it succeed?
- How long did it take?
- If it failed, what status/code/reason was returned?

This is especially important when multiple providers are used in parallel.

## 14. Evaluation Metrics

Track separately:

- OCR accuracy
- Field precision/recall
- Product classification accuracy
- Rule evaluation correctness
- False-positive rate
- False-negative rate
- Processing time
- Manual correction rate
- Provider success/failure rates

## 15. Privacy and Security

Package images may contain commercially sensitive information.

Do not copy them to unnecessary services.

Protect:

- uploaded images
- API credentials
- inspection records
- audit information

## 16. AI Governance

Officer corrections should be preserved as feedback data where appropriate.

The prototype should not silently retrain production models from every correction.

Model/provider changes should be documented and evaluated separately.
