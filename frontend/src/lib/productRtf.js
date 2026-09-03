import { getResponsibilityReference } from "./penalties";

function escapeRtf(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/[{}]/g, "\\$&").split("\r?\n").join("\\par ");
}

function unicodeRtf(value) {
  return String(value ?? "").split("").map((char) => {
    const code = char.charCodeAt(0);
    return code > 127 ? `\\u${code}?` : escapeRtf(char);
  }).join("");
}

function section(title, body) { return `\\par\\b ${unicodeRtf(title)}\\b0\\par ${body}`; }

export function downloadProductRtf({ product, user, violations = [], penaltySummary = null }) {
  const inspection = product?.inspections?.[0];
  const shop = inspection?.shop;
  const officer = inspection?.worker?.name || product?.owner?.name || user?.name || "Not recorded";
  const location = [shop?.address, shop?.city, shop?.state].filter(Boolean).join(", ") || "Not recorded";
  let body = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\fs22 ";
  body += `\\b PARAKH\\b0\\par ${unicodeRtf("PRODUCT INSPECTION REPORT")}\\par\\par `;
  body += section("Product Details", unicodeRtf(`Product: ${product?.productName || "Not recorded"}\\par Brand: ${product?.brandName || "Not recorded"}\\par Category: ${product?.category?.name || "Not recorded"}\\par MRP: ${product?.mrp == null ? "Not recorded" : "Rs. " + product.mrp}\\par Net Quantity: ${(product?.netQuantity || "Not recorded")} ${product?.unit || ""}\\par Barcode: ${product?.barcode || "Not recorded"}`));
  body += section("Shop & Inspector", unicodeRtf(`Shop: ${shop?.name || "Not recorded"}\\par Location: ${location}\\par Inspector / User: ${officer}\\par Compliance Status: ${product?.complianceStatus || "NEEDS_REVIEW"}`));
  body += section("Accepted Violations", violations.length ? violations.map((finding, index) => unicodeRtf(`${index + 1}. Rule ${finding?.ruleNumber || finding?.ruleCode || "Unknown"}: ${finding?.message || finding?.violationReason || "Violation recorded"}`)).join("\\par ") : unicodeRtf("No accepted violations recorded."));
  body += section("Penalty Reference", unicodeRtf(`Occurrence reference: ${penaltySummary?.occurrence || "Not recorded"}\\par Minimum indicated: ${penaltySummary?.hasUnknown ? "Not fully determinable" : penaltySummary ? "Rs. " + Number(penaltySummary.minTotal || 0).toLocaleString("en-IN") : "Not calculated"}\\par Maximum indicated: ${penaltySummary?.hasUnknown ? "Not fully determinable" : penaltySummary ? "Rs. " + Number(penaltySummary.maxTotal || 0).toLocaleString("en-IN") : "Not calculated"}`));
  if (penaltySummary?.rows?.length) {
    body += section("Penalty / Legal References", penaltySummary.rows.map((row, index) => {
      const title = row.finding?.ruleNumber || row.finding?.ruleCode || `Violation ${index + 1}`;
      const detail = row.detail?.label ? `Reference: ${row.detail.label}` : "No penalty provision configured or verified for this finding.";
      const provision = row.detail?.provision ? `\\par Legal reference: ${row.detail.provision}` : "";
      return unicodeRtf(`${title}: ${detail}${provision}`);
    }).join("\\par "));
    body += section("Responsibility Reference", penaltySummary.rows.map((row) => unicodeRtf(getResponsibilityReference(row.finding))).join("\\par "));
  }
  body += section("Important Legal Notice", unicodeRtf("This editable report is an inspection support record. PARAKH does not determine or impose a fine, establish guilt, or finally assign responsibility. Any penalty, notice, compounding action, prosecution or other enforcement measure must be determined by the competent Legal Metrology authority under applicable law and procedure. Responsibility may require investigation of the manufacturer, packer, importer, retailer/dealer or another responsible person."));
  body += "}";
  const filename = `PARAKH-${String(product?.productName || "product").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "product"}.rtf`;
  const blob = new Blob([body], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}