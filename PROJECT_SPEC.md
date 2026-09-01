# PARAKH Project Specification

## 1. Project Identity

**Project:** PARAKH

**Full form:** Packaged Article Regulatory Assessment & Knowledge Hub

**SIH Problem Statement:** 26034

**Domain:** Legal Metrology / Consumer Protection / AI-assisted Government Inspection

## 2. Problem

Manual inspection of packaged commodities is time-consuming and resource-intensive. Officers must visually inspect packages and verify mandatory declarations under the Legal Metrology Act, 2009 and the Legal Metrology (Packaged Commodities) Rules, 2011. Large product variety, inconsistent packaging, small text, and high inspection volume make consistent checking difficult.

## 3. Solution

PARAKH is an AI-assisted inspection platform that captures package images, extracts declarations using OCR and computer vision, classifies products, evaluates applicable Legal Metrology requirements through a configurable rule engine, highlights potential non-compliance, and allows an enforcement officer to verify the result.

The system maintains shop, product, inspection, evidence, and compliance history and provides analytics and report generation.

## 4. Design Principle

AI assists the officer. It does not make a final legal determination. Every potential violation should be explainable through the extracted field, applicable rule, supporting image/evidence, confidence score, and officer verification status.

## 5. Platforms

PARAKH is a responsive cross-platform application for mobile, tablet, laptop, and desktop. Mobile and web have feature parity. Scanning is optimized for mobile cameras, while the same dashboard, shops, products, history, reports, analytics, and administrative capabilities remain available on larger screens.

## 6. Main Modules

### 6.1 Dashboard

Show total inspections, today's inspections, compliant products, potential non-compliances, pending verification, repeat violations, recent inspections, category statistics, location statistics, and compliance trends.

### 6.2 Product Scanning

Allow an officer to capture multiple package images. Support image quality guidance, preprocessing, OCR, field extraction, classification, rule evaluation, and verification.

### 6.3 AI/OCR Extraction

Extract relevant package declarations including brand, product name, net quantity, MRP, manufacturer/packer/importer, address, date-related information, consumer-care details, and other applicable declarations.

Every extracted field receives a confidence score. Low-confidence values are highlighted for human review.

### 6.4 Product Classification

Use a hierarchical catalogue:

`Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant`

Example:

`Food → Ready to Eat → Chips → Lay's → Classic Salted → 50 g`

### 6.5 New Product Registration

If a product or classification does not exist, the officer can register it using the hierarchy. New categories, subcategories, product types, brands, products, and variants should be supported subject to appropriate permissions.

### 6.6 Legal Metrology Rule Engine

Maintain configurable and versioned rules representing requirements from the Legal Metrology Act, 2009 and Legal Metrology (Packaged Commodities) Rules, 2011 and applicable amendments/requirements used by the implementation.

A rule should contain at least:

- Rule/reference identifier
- Requirement description
- Applicability
- Required declaration or condition
- Validation logic
- Measurement requirement where applicable
- Exceptions
- Effective/version information
- Evidence requirements

The rule engine evaluates extracted data and produces a result such as Compliant, Potential Non-Compliance, or Needs Manual Verification.

### 6.7 Officer Verification

Show the officer the finding, extracted value, confidence, applicable requirement, and image evidence. The officer can confirm, reject, edit, or mark the finding for further review according to permissions.

### 6.8 Shops

Maintain shop profiles, locations, inspection counts, last inspection, products inspected, category breakdown, compliance statistics, and violation history.

### 6.9 Inspection History

Store officer, shop, location, date/time, product, extracted declarations, rule checks, findings, evidence, confidence scores, verification decisions, and notes.

Provide filters for date, location, shop, category, subcategory, product type, brand, product, compliance status, and violation type.

### 6.10 Reports

Generate inspection and compliance reports with inspection details, shop information, product data, images, extracted fields, applicable checks, findings, evidence, and officer verification. Support PDF and editable export formats.

### 6.11 Analytics

Provide category-wise, product-wise, brand-wise, shop-wise, and location-wise inspection/compliance analytics; violation trends; frequent violation types; repeat violations; and pending verification statistics.

### 6.12 Roles

**Inspector:** scan, inspect shops, manage permitted product entries, review findings, access history, and generate reports.

**Administrator:** manage inspectors, shops, products, categories, rule configuration, broader analytics, and system settings.

## 7. End-to-End Workflow

`Officer Login → Select/Add Shop → Scan Product → Capture Images → OCR + AI → Extract Fields → Classify Product → Apply Legal Metrology Rules → Generate Findings → Officer Review → Save Inspection → Update Shop/Product/History → Report & Analytics`

## 8. Proposed Technology

Frontend: React + TypeScript + Vite

Backend: Python + FastAPI

Database: PostgreSQL

AI/OCR: Python-based computer vision, OCR, NLP/LLM-assisted extraction where appropriate

API: REST

Authentication: secure role-based authentication

Storage: object storage or local development storage for package images and evidence

## 9. Non-Functional Requirements

- Responsive and mobile-first field workflow
- Cross-platform feature parity
- Secure authentication and authorization
- Auditability of important actions
- Explainable AI findings
- Configurable rules
- Maintainable architecture
- Fast inspection workflow
- Reliable data persistence
- Exportable reports

## 10. SIH Prototype Priorities

The first working prototype should prioritize a convincing end-to-end flow over attempting every possible AI capability:

1. Authentication and dashboard
2. Shop creation/selection
3. Product image capture/upload
4. OCR extraction
5. Structured field review
6. Product hierarchy and registration
7. Representative Legal Metrology rule checks
8. Potential violation highlighting with evidence
9. Officer verification
10. Inspection history
11. Reports
12. Basic analytics

Advanced model improvements and larger rule coverage can follow after the core flow is stable.
