import { getResponsibilityReference } from "./penalties";

function escapeRtf(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

function rtfText(value) {
  return escapeRtf(value).replace(/\r?\n/g, "\\line ");
}

function field(label, value) {
  return `\\trowd\\trgaph100\\trleft0\\clcbpat2\\cellx1900\\clbrdrt\\brdrs\\brdrw8\\clbrdrb\\brdrs\\brdrw8\\clbrdrl\\brdrs\\brdrw8\\clbrdrr\\brdrs\\brdrw8 ${rtfText(label)}\\cell\\clcbpat0\\cellx9000\\clbrdrt\\brdrs\\brdrw8\\clbrdrb\\brdrs\\brdrw8\\clbrdrl\\brdrs\\brdrw8\\clbrdrr\\brdrs\\brdrw8 ${rtfText(value)}\\cell\\row}`;
}

function sectionHeader(title) {
  return `\\par\\sb180\\sa80\\cf2\\fs24\\b ${rtfText(title.toUpperCase())}\\b0\\cf1\\fs22\\par`;
}

function bullet(text, boldPrefix = "") {
  const prefix = boldPrefix ? `\\b ${rtfText(boldPrefix)}\\b0 ` : "";
  return `\\li360\\fi-180\\bullet ${prefix}${rtfText(text)}\\par`;
}

function statusCell(label, value) {
  return `\\trowd\\trgaph100\\trleft0\\clcbpat2\\cellx3200\\clcbpat0\\cellx9000 ${rtfText(label)}\\cell ${rtfText(value)}\\cell\\row`;
}

function legalNotice() {
  return [
    "\\brdrbox\\brdrs\\brdrw12\\brdrcf2\\li120\\ri120\\sb120\\sa120",
    "\\b IMPORTANT LEGAL NOTICE\\b0\\par",
    rtfText("This report is an inspection support record. Penalty amounts, where shown, are indicative legal references only."), "\\par",
    rtfText("PARAKH does not determine or impose a fine, establish guilt, or finally assign responsibility."), "\\par",
    rtfText("Any penalty, compounding action, improvement notice, prosecution or other enforcement measure must be determined by the competent Legal Metrology authority under applicable law and procedure."), "\\par",
    rtfText("Responsibility may require investigation of the manufacturer, packer, importer, retailer/dealer or another responsible person."), "\\par",
    "\\brdrbox0"
  ].join("");
}

export function downloadProductRtf({ product, user, violations = [], penaltySummary = null }) {
  const inspection = product?.inspections?.[0];
  const shop = inspection?.shop;
  const officer = inspection?.worker?.name || product?.owner?.name || user?.name || "Not recorded";
  const location = [shop?.address, shop?.city, shop?.state].filter(Boolean).join(", ") || "Not recorded";
  const status = product?.complianceStatus || "NEEDS_REVIEW";
  const hasUnknown = Boolean(penaltySummary?.hasUnknown);
  const minValue = hasUnknown ? "Not fully determinable" : penaltySummary ? `Rs. ${Number(penaltySummary.minTotal || 0).toLocaleString("en-IN")}` : "Not calculated";
  const maxValue = hasUnknown ? "Not fully determinable" : penaltySummary ? `Rs. ${Number(penaltySummary.maxTotal || 0).toLocaleString("en-IN")}` : "Not calculated";

  const parts = [
    "{\\rtf1\\ansi\\deff0",
    "{\\fonttbl{\\f0 Calibri;}{\\f1 Calibri Light;}}",
    "{\\colortbl;\\red31\\green41\\blue55;\\red37\\green99\\blue235;\\red241\\green245\\blue249;\\red153\\green27\\blue27;}",
    "\\viewkind4\\uc1\\paperw11907\\paperh16840\\margl900\\margr900\\margt800\\margb800\\fs22\\f0\\cf1",
    "\\qc\\f1\\fs40\\b PARAKH\\b0\\par",
    "\\fs18\\cf2\\b PRODUCT INSPECTION REPORT\\b0\\cf1\\par",
    `\\fs16\\cf1 Generated: ${rtfText(new Date().toLocaleString())}\\par\\pard\\fs22`,
    sectionHeader("Product Details"),
    field("Product", product?.productName || "Not recorded"),
    field("Brand", product?.brandName || "Not recorded"),
    field("Category", product?.category?.name || "Not recorded"),
    field("MRP", product?.mrp == null ? "Not recorded" : `Rs. ${product.mrp}`),
    field("Net Quantity", `${product?.netQuantity || "Not recorded"} ${product?.unit || ""}`.trim()),
    field("Barcode", product?.barcode || "Not recorded"),
    sectionHeader("Shop & Inspector"),
    field("Shop", shop?.name || "Not recorded"),
    field("Location", location),
    field("Inspector / User", officer),
    field("Compliance Status", status),
    sectionHeader("Accepted Violations"),
    violations.length ? violations.map((finding, index) => bullet(`Rule ${finding?.ruleNumber || finding?.ruleCode || "Unknown"}: ${finding?.message || finding?.violationReason || "Violation recorded"}`)).join("") : bullet("No accepted violations recorded."),
    sectionHeader("Penalty Reference"),
    field("Occurrence Reference", penaltySummary?.occurrence || "Not recorded"),
    field("Minimum Indicated", minValue),
    field("Maximum Indicated", maxValue),
    sectionHeader("Penalty / Legal References"),
  ];

  if (penaltySummary?.rows?.length) {
    for (const [index, row] of penaltySummary.rows.entries()) {
      const title = row.finding?.ruleNumber || row.finding?.ruleCode || `Violation ${index + 1}`;
      const detail = row.detail?.label ? `Reference: ${row.detail.label}` : "No penalty provision configured or verified for this finding.";
      const provision = row.detail?.provision ? ` Legal reference: ${row.detail.provision}` : "";
      parts.push(field(title, `${detail}.${provision}`));
      parts.push(`\\li360\\fi-180\\cf1\\i Responsibility reference: ${rtfText(getResponsibilityReference(row.finding))}\\i0\\cf1\\par`);
    }
  } else {
    parts.push(bullet("No penalty reference data is available for this report."));
  }

  parts.push(sectionHeader("Important Legal Notice"), legalNotice());
  parts.push(sectionHeader("Officer Sign-off"));
  parts.push(field("Officer", officer));
  parts.push(field("Inspection Date", new Date(inspection?.inspectedAt || product?.createdAt || Date.now()).toLocaleString()));
  parts.push("\\par\\brdrb\\brdrs\\brdrw8\\brsp20\\tab Signature / remarks: ________________________________________________\\par");
  parts.push("\\par\\qc\\cf2\\fs16 PARAKH — Inspection support record\\cf1\\fs22\\par");
  parts.push("}");

  const body = parts.join("");
  const filename = `PARAKH-${String(product?.productName || "product").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "product"}.rtf`;
  const blob = new Blob([body], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}