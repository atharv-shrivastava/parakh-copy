import { getResponsibilityReference } from "./penalties";

function escapeRtf(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

function rtfText(value) {
  return escapeRtf(value).split(/\\r?\\n/).join("\\par ");
}

function section(title, lines) {
  return `\\par\\b ${rtfText(title)}\\b0\\par ${lines.map(rtfText).join("\\par ")}`;
}

export function downloadProductRtf({ product, user, violations = [], penaltySummary = null }) {
  const inspection = product?.inspections?.[0];
  const shop = inspection?.shop;
  const officer = inspection?.worker?.name || product?.owner?.name || user?.name || "Not recorded";
  const location = [shop?.address, shop?.city, shop?.state].filter(Boolean).join(", ") || "Not recorded";
  const lines = [];
  lines.push("\\b PARAKH\\b0", "PRODUCT INSPECTION REPORT");
  lines.push(section("Product Details", [
    `Product: ${product?.productName || "Not recorded"}`,
    `Brand: ${product?.brandName || "Not recorded"}`,
    `Category: ${product?.category?.name || "Not recorded"}`,
    `MRP: ${product?.mrp == null ? "Not recorded" : "Rs. " + product.mrp}`,
    `Net Quantity: ${product?.netQuantity || "Not recorded"} ${product?.unit || ""}`.trim(),
    `Barcode: ${product?.barcode || "Not recorded"}`
  ]));
  lines.push(section("Shop & Inspector", [
    `Shop: ${shop?.name || "Not recorded"}`,
    `Location: ${location}`,
    `Inspector / User: ${officer}`,
    `Compliance Status: ${product?.complianceStatus || "NEEDS_REVIEW"}`
  ]));
  lines.push(section("Accepted Violations", violations.length ? violations.map((finding, index) => `${index + 1}. Rule ${finding?.ruleNumber || finding?.ruleCode || "Unknown"}: ${finding?.message || finding?.violationReason || "Violation recorded"}`) : ["No accepted violations recorded."]));
  lines.push(section("Penalty Reference", [
    `Occurrence reference: ${penaltySummary?.occurrence || "Not recorded"}`,
    `Minimum indicated: ${penaltySummary?.hasUnknown ? "Not fully determinable" : penaltySummary ? "Rs. " + Number(penaltySummary.minTotal || 0).toLocaleString("en-IN") : "Not calculated"}`,
    `Maximum indicated: ${penaltySummary?.hasUnknown ? "Not fully determinable" : penaltySummary ? "Rs. " + Number(penaltySummary.maxTotal || 0).toLocaleString("en-IN") : "Not calculated"}`
  ]));
  if (penaltySummary?.rows?.length) {
    lines.push(section("Penalty / Legal References", penaltySummary.rows.map((row, index) => {
      const title = row.finding?.ruleNumber || row.finding?.ruleCode || `Violation ${index + 1}`;
      const detail = row.detail?.label ? `Reference: ${row.detail.label}` : "No penalty provision configured or verified for this finding.";
      const provision = row.detail?.provision ? ` Legal reference: ${row.detail.provision}` : "";
      return `${title}: ${detail}.${provision}`;
    })));
    lines.push(section("Responsibility Reference", penaltySummary.rows.map((row) => getResponsibilityReference(row.finding))));
  }
  lines.push(section("Important Legal Notice", ["This editable report is an inspection support record.", "PARAKH does not determine or impose a fine, establish guilt, or finally assign responsibility.", "Any penalty, compounding action, improvement notice, prosecution or other enforcement measure must be determined by the competent Legal Metrology authority under applicable law and procedure.", "Responsibility may require investigation of the manufacturer, packer, importer, retailer/dealer or another responsible person."]));
  const body = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\viewkind4\\fs22 ${lines.join("\\par ")}\\par}`;
  const filename = `PARAKH-${String(product?.productName || "product").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "product"}.rtf`;
  const blob = new Blob([body], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}