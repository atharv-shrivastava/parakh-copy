function cleanText(value) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/[^\x20-\x7E]/g, "?").trim();
}
function escapePdf(value) { return cleanText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrap(text, width = 92) { const value = cleanText(text); if (!value) return [""]; const words = value.split(/\s+/); const lines = []; let line = ""; for (const word of words) { if (!line) line = word; else if (line.length + 1 + word.length <= width) line += ` ${word}`; else { lines.push(line); line = word; } } if (line) lines.push(line); return lines; }
function buildPages(lines, linesPerPage = 47) { const pages = []; for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage)); return pages.length ? pages : [[""]]; }
function makePdf(lines) {
  const pages = buildPages(lines); const objects = []; const add = (body) => { objects.push(body); return objects.length; }; const catalog = add(""); const pagesObj = add(""); const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); const pageIds = [];
  for (const pageLines of pages) { const commands = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL"]; pageLines.forEach((line, index) => { if (index > 0) commands.push("T*"); commands.push(`(${escapePdf(line)}) Tj`); }); commands.push("ET"); const stream = commands.join("\n"); const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`); pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`)); }
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`; objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  let pdf = "%PDF-1.4\n%PARAKH\n"; const offsets = [0]; objects.forEach((body, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; }); const xrefOffset = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`; pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`; return new Blob([pdf], { type: "application/pdf" });
}
export function downloadTextPdf(filename, sections) {
  const lines = ["PARAKH PRODUCT INSPECTION REPORT", "", `Generated: ${new Date().toLocaleString()}`, ""];
  for (const section of sections) { lines.push(String(section.title || "").toUpperCase()); lines.push("-".repeat(Math.min(86, Math.max(12, String(section.title || "").length)))); for (const row of section.rows || []) lines.push(...wrap(`${row.label}: ${row.value ?? "Not recorded"}`)); lines.push(""); }
  const url = URL.createObjectURL(makePdf(lines)); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
