# PARAKH UI/UX Specification

## 1. UX Goal
PARAKH is an inspection-focused interface for field and desktop use. Important actions, uncertainty, evidence, and compliance state should be immediately understandable.

## 2. Platform
One responsive application serves phone, tablet, laptop, and desktop. Layout adapts rather than creating separate products.

## 3. Navigation
The current UI uses a persistent desktop sidebar and compact responsive navigation on smaller screens. Primary destinations are Dashboard, Scan, Shops, Products, History, and Reports, with E-commerce, Profile, and authorized Admin areas.

Navigation uses icons plus text and follows the active theme.

## 4. Themes
The application supports light, dark, dark-gradient, gradient, and rainbow themes. Themes affect backgrounds, surfaces, text, borders, inputs, sidebar, accents, and shadows. Dark themes must maintain strong contrast across every major page, including scan controls and visual inspection.

## 5. Dashboard
The dashboard uses real stored inspection data and can show inspection volume/trend, total inspections, violations, compliance information, recent inspections, product hierarchy, highest-violation shop, highest-violation brand, highest-violation rule, and quick actions. Admin dashboards can aggregate platform-wide data; normal user dashboards are scoped appropriately.

## 6. Scan
The core workflow is:
`Capture/Upload → Review → Analyze → OCR → Extraction → Visual Screening → Rules/Findings → Officer Review → Registration`

The UI supports multiple images, edit/remove actions, editable extracted fields, confidence/status indicators, evidence, and manual violations.

## 7. Visual Inspection
The scan result can show assistive readability, placement, declaration detection, text-region, and relative-size signals. Approximate measurements must be labeled as estimates unless reliable calibration exists.

## 8. Product Hierarchy
`Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant` must remain visually obvious and navigable.

## 9. Shops
Shops use real stored data. Listing/detail views should expose inspection and product history and work correctly with dark themes. Safe deletions should update optimistically without a full page reload.

## 10. Reports and History
History supports inspection search/filtering and evidence review. Reports use structured inspection information and distinguish extraction, rule findings, and officer decisions.

## 11. Admin
Admin pages share the same design system while exposing additional platform controls, rules, users, products, inspections, and analytics.

## 12. Performance
Use skeleton/loading states where useful. Use short-lived GET caching, mutation-triggered invalidation, bounded provider waits, and targeted UI updates. Avoid unnecessary full-page remounts/refetches.

## 13. Accessibility
Maintain strong contrast, touch targets, keyboard access, clear labels, non-color-only status communication, actionable errors, and reduced-motion support.

## 14. Visual Direction
Professional, precise, modern, restrained, and information-dense. Animations should be short and purposeful.
