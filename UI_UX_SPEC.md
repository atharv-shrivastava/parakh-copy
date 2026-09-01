# PARAKH UI/UX Specification

## 1. UX Goal

PARAKH is designed for government enforcement officers who may use it in the field. The interface must minimize unnecessary typing and make the scan-to-verification workflow obvious.

## 2. Platform Principle

There is one product, not a separate web product and mobile product.

The same feature set must be available on:

- Phone
- Tablet
- Laptop
- Desktop

The layout and input method adapt to screen size and device capabilities.

## 3. Navigation

Primary navigation:

- Dashboard
- Scan
- Shops
- Products
- Inspections / History
- Reports
- Analytics
- Administration (authorized users)

The mobile navigation may use a bottom navigation bar or compact navigation, while desktop can use a sidebar. Both expose the same functional destinations.

## 4. Dashboard

Desktop should use cards and charts; mobile should stack them vertically.

Key cards:

- Total inspections
- Today's inspections
- Potential non-compliance
- Pending verification
- Compliance rate

Quick actions:

- Scan product
- Add shop
- Search product
- View history

## 5. Scan Screen

The scan interface should prioritize the camera/upload action.

```text
Shop
 ↓
Capture image
 ↓
Add additional side
 ↓
Processing
 ↓
Extracted information
 ↓
Compliance results
 ↓
Officer verification
```

The interface should indicate which package side is being captured when useful, such as front, back, side, or declaration panel.

## 6. Image Quality UX

Before processing, provide useful guidance:

- Move closer
- Reduce glare
- Keep package steady
- Capture the declaration clearly
- Rotate the package if information is missing

Do not bury these instructions inside technical error messages.

## 7. Extraction Review

Display extracted fields in a form-like layout.

Each field should show:

- Value
- Confidence indicator
- Source/evidence link when available
- Editable control

Low-confidence fields should be visually prominent but not alarming.

## 8. Compliance Result UX

Use clear status labels:

- Compliant
- Potential Non-Compliance
- Needs Manual Verification
- Not Applicable
- Unable to Determine

A result should show the applicable requirement and evidence, not just a red/green icon.

## 9. Shop Section

Shop list should support search and location filtering.

Shop details should show:

- Shop information
- Map/location where available
- Inspection count
- Last inspection
- Products scanned
- Category breakdown
- Compliance history
- Violations

Products should be grouped by category.

## 10. Product Section

The catalogue navigation should follow:

`Category → Subcategory → Product Type → Brand → Product → Variant`

The interface should make the hierarchy visually obvious.

Example:

`Food → Ready to Eat → Chips → Lay's → Classic Salted → 50 g`

## 11. Add New Product

Provide a guided flow rather than a huge form.

```text
Choose category
 ↓
Choose/create subcategory
 ↓
Choose/create product type
 ↓
Choose/create brand
 ↓
Enter product name
 ↓
Enter pack size/variant
 ↓
Review
 ↓
Save / submit for approval
```

## 12. History

History should support filtering by:

- Date
- Location
- Shop
- Product category
- Product type
- Brand
- Product
- Compliance status
- Violation

The user should be able to open an inspection and inspect its evidence and verification trail.

## 13. Reports

The report screen should provide:

- Preview
- Generate
- Download/export
- Report status

## 14. Analytics

Charts should remain understandable on small screens. On mobile, complex tables can become horizontally scrollable or transform into cards.

## 15. Accessibility

- High text readability
- Adequate touch target size
- Keyboard accessibility on desktop
- Clear labels
- Avoid relying on color alone
- Meaningful error messages
- Loading states for AI processing

## 16. Loading States

AI processing may take time. The interface should communicate the stage:

`Uploading → Improving image → Reading package → Extracting fields → Checking rules → Preparing results`

## 17. Empty States

Every empty page should explain what the user can do next.

Examples:

- No shops yet → Add a shop
- No inspections → Start an inspection
- Product not found → Register product
- No reports → Complete an inspection first

## 18. Confirmation and Destructive Actions

Require confirmation for destructive administrative actions. Inspection evidence should not be casually deleted.

## 19. Visual Direction

The visual style should be professional, restrained, and suitable for a government inspection system. Avoid excessive gradients, gaming-style dashboards, unnecessary animation, or decorative elements that compete with evidence and compliance findings.
