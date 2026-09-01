# PARAKH AI and OCR Modules

## 1. AI Philosophy

PARAKH uses AI where it provides value: visual text recognition, extraction, classification, confidence estimation, and assistance in interpreting unstructured package imagery. It should use deterministic software for deterministic checks.

The system must not fabricate missing declarations. Unknown information should remain unknown and be presented for verification.

## 2. AI Pipeline

```text
Package Image(s)
      ↓
Quality Assessment
      ↓
Preprocessing
      ↓
Text/Region Detection
      ↓
OCR
      ↓
Normalization
      ↓
Field Extraction
      ↓
Confidence Scoring
      ↓
Product Matching / Classification
      ↓
Rule Engine
```

## 3. Image Quality Assessment

Detect:

- Blur
- Low resolution
- Extreme perspective
- Rotation
- Glare
- Severe shadow
- Occlusion
- Cropped text
- Unreadable regions

The UI should guide the officer to recapture poor images.

## 4. OCR

The OCR layer should support printed package text and, where feasible, multiple Indian scripts. Model choice should be based on measured prototype accuracy rather than marketing claims.

The OCR output should retain:

- Text
- Confidence
- Bounding boxes
- Page/image reference

## 5. Text Normalization

Normalize common variations without destroying the original OCR value.

Examples include:

- Whitespace normalization
- Currency symbol normalization
- Unit normalization
- Case normalization for matching
- Date format normalization

Always preserve the raw OCR output separately.

## 6. Field Extraction

Target fields include, where applicable:

- Brand
- Product name
- Net quantity
- MRP
- Manufacturer
- Packer
- Importer
- Address
- Date/month/year information
- Consumer-care details
- Other mandatory declarations represented in the active rule set

Extraction should produce structured objects rather than free-form summaries.

## 7. Confidence Scoring

Confidence should reflect the reliability of extraction, not legal compliance.

For example:

```text
OCR confidence:        0.97
Field extraction:      0.94
Product match:         0.91
Rule applicability:    deterministic / confirmed
```

Do not combine unrelated scores into a misleading single number without defining the methodology.

## 8. Product Matching

The matching pipeline should compare normalized OCR text against the product catalogue using deterministic matching and, if useful, fuzzy/semantic matching.

Possible outcomes:

- Exact match
- Strong candidate
- Multiple candidates
- New product suggested
- Unable to classify

An officer can confirm classification.

## 9. Layout and Font Analysis

Computer vision may estimate:

- Text region size
- Relative text height
- Character visibility
- Contrast/readability
- Position of relevant declarations

Where an exact physical font-size determination cannot be reliably inferred from a photograph, the system must label the result as an estimate or manual-verification requirement rather than claiming exact measurement.

## 10. Compliance AI Boundary

AI can identify likely missing or suspicious declarations. The rule engine decides whether a configured requirement is satisfied based on structured inputs and deterministic checks where possible.

Example:

```text
OCR detects MRP = ₹20
       ↓
Rule engine checks applicable MRP requirement
       ↓
Result + evidence
       ↓
Officer verification
```

## 11. Evidence Localization

Whenever technically possible, extracted fields should retain their source image and bounding box. This allows the interface to draw an evidence rectangle around the text that produced a finding.

## 12. Human Review Triggers

Trigger manual review for:

- Low OCR confidence
- Conflicting values across package images
- Multiple product matches
- Missing critical fields
- Uncertain applicability
- Suspected image manipulation
- Font/readability measurements outside reliable bounds
- Any rule requiring contextual judgment

## 13. Learning Loop

Corrections made by officers can be collected as labelled feedback for future model improvement, subject to appropriate governance.

The prototype should not silently retrain production models from every officer edit. Feedback should be stored separately and used in a controlled training/evaluation process.

## 14. Evaluation Metrics

Track separately:

- OCR character/word accuracy
- Field extraction precision/recall
- Product classification accuracy
- Rule evaluation correctness
- False-positive rate
- False-negative rate
- Average processing time
- Manual correction rate

A compliance system should emphasize false-negative analysis because missed violations can be operationally important.

## 15. Model Versioning

Every AI-derived result should be associated with a model/service version where feasible. This allows later investigation of why an old inspection produced a particular extraction.

## 16. Privacy and Security

Images may contain commercially sensitive information. Access should be controlled and unnecessary raw data should not be copied between services.

## 17. SIH Prototype Strategy

Do not attempt to train a huge proprietary vision-language model. Demonstrate a reliable pipeline using existing OCR/vision capabilities, carefully designed extraction, a representative product catalogue, and a transparent rule engine.

The innovation should be the integrated inspection workflow and explainable compliance architecture, not a claim that PARAKH invented OCR.
