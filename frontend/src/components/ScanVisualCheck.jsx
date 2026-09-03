import { useEffect, useMemo, useState } from "react";
import "../styles/scan-visual-check.css";

const STORAGE_KEY = "parakhVisualInspection";
const DECLARATION_KEY = "parakhDeclarationEvidence";
const MAX_IMAGES = 4;
const MAX_ANALYSIS_SIDE = 1200;

const DECLARATION_TYPES = [
  "PRODUCT_NAME",
  "BRAND",
  "NET_QUANTITY",
  "MRP",
  "MANUFACTURER",
  "PACKER",
  "IMPORTER",
  "ADDRESS",
  "DATE_OF_MANUFACTURE",
  "DATE_OF_PACKING",
  "BEST_BEFORE",
  "EXPIRY_DATE",
  "BATCH_NUMBER",
  "CONSUMER_CARE",
  "COUNTRY_OF_ORIGIN",
  "FSSAI_LICENSE",
  "BARCODE",
  "OTHER_DECLARATION",
];

function analyzePixels(data, width, height) {
  let sum = 0;
  let sumSq = 0;
  let edgeCount = 0;
  let edgeSamples = 0;
  let lapSum = 0;
  let lapSq = 0;
  let darkPixels = 0;
  let edgeDarkPixels = 0;
  const rowDensity = new Float32Array(height);
  const gray = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const g = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      gray[y * width + x] = g;
      sum += g;
      sumSq += g * g;
      if (g < 105) {
        darkPixels += 1;
        rowDensity[y] += 1;
        if (x < width * 0.04 || x > width * 0.96 || y < height * 0.04 || y > height * 0.96) edgeDarkPixels += 1;
      }
    }
  }

  const count = Math.max(1, width * height);
  const contrast = Math.sqrt(Math.max(0, sumSq / count - Math.pow(sum / count, 2)));
  const lineBands = [];
  let bandStart = -1;

  for (let y = 0; y < height; y += 1) {
    const density = rowDensity[y] / Math.max(1, width);
    const textLike = density >= 0.008 && density <= 0.48;
    if (textLike && bandStart < 0) bandStart = y;
    if ((!textLike || y === height - 1) && bandStart >= 0) {
      const end = textLike && y === height - 1 ? y : y - 1;
      const bandHeight = end - bandStart + 1;
      if (bandHeight >= 2 && bandHeight <= Math.max(60, height * 0.12)) lineBands.push({ top: bandStart, height: bandHeight });
      bandStart = -1;
    }
  }

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = y * width + x;
      const c = gray[i];
      const left = gray[i - 1];
      const right = gray[i + 1];
      const up = gray[i - width];
      const down = gray[i + width];
      const gx = Math.abs(right - left);
      const gy = Math.abs(down - up);
      if (gx + gy > 55) edgeCount += 1;
      edgeSamples += 1;
      const lap = left + right + up + down - 4 * c;
      lapSum += lap;
      lapSq += lap * lap;
    }
  }

  const sampleCount = Math.max(1, edgeSamples);
  const lapVariance = Math.max(0, lapSq / sampleCount - Math.pow(lapSum / sampleCount, 2));
  const sharpness = Math.min(100, Math.max(0, lapVariance / 7));
  const contrastScore = Math.min(100, Math.max(0, contrast * 2.2));
  const edgeScore = Math.min(100, (edgeCount / sampleCount) * 600);
  const readability = Math.round(Math.min(100, 0.55 * sharpness + 0.35 * contrastScore + 0.10 * edgeScore));
  const medianLineHeight = lineBands.length ? [...lineBands.map((item) => item.height)].sort((a, b) => a - b)[Math.floor(lineBands.length / 2)] : 0;
  const textCoverage = Math.round(Math.min(100, (darkPixels / count) * 100 * 4));
  const edgeCrowding = Math.round(Math.min(100, (edgeDarkPixels / Math.max(1, darkPixels)) * 100));
  const placement = edgeCrowding > 18 ? "REVIEW" : lineBands.length >= 2 ? "SCREENED" : "UNABLE_TO_VERIFY";

  return { width, height, readability, sharpness, contrast: contrastScore, textLines: lineBands.length, textCoverage, edgeCrowding, medianLineHeight, placement };
}

async function inspectImageSource(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load scan image.");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not inspect image.");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return analyzePixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

function getScanImages() {
  return Array.from(document.querySelectorAll(".scan-image-grid .scan-image-card img"))
    .slice(0, MAX_IMAGES)
    .map((image) => image.src)
    .filter(Boolean);
}

function parseVisualJson(text) {
  const source = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = source.indexOf("{");
  if (start < 0) throw new Error("Visual model did not return JSON.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error("Visual model returned incomplete JSON.");
}

function normalizeDeclaration(item, imageIndex) {
  const box = item?.boundingBox || item?.bbox || item?.box || {};
  const left = Number(box.left ?? box.x);
  const top = Number(box.top ?? box.y);
  const width = Number(box.width ?? box.w);
  const height = Number(box.height ?? box.h);
  const hasBox = [left, top, width, height].every(Number.isFinite);
  const type = String(item?.type || item?.declarationType || item?.field || "OTHER_DECLARATION").toUpperCase();
  return {
    imageIndex,
    type: DECLARATION_TYPES.includes(type) ? type : "OTHER_DECLARATION",
    text: typeof item?.text === "string" ? item.text.trim() : "",
    confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
    boundingBox: hasBox ? {
      left: Math.max(0, Math.min(1, left)),
      top: Math.max(0, Math.min(1, top)),
      width: Math.max(0, Math.min(1, width)),
      height: Math.max(0, Math.min(1, height)),
    } : null,
    notes: typeof item?.notes === "string" ? item.notes.trim() : "",
  };
}

async function detectDeclarations(src, imageIndex) {
  const puter = window.puter;
  if (!puter?.ai?.chat) throw new Error("Multimodal AI is unavailable.");
  const response = await puter.ai.chat(
    `Inspect this packaged-commodity photograph for visible declarations. Return ONLY valid JSON in this exact shape: {"declarations":[{"type":"MRP","text":"MRP ₹120","confidence":0.96,"boundingBox":{"left":0.1,"top":0.2,"width":0.3,"height":0.05},"notes":""}]}. Use normalized coordinates from 0 to 1 relative to the full image. Detect only text/declaration regions that are actually visible. Do not invent missing text. Use one of these declaration types: ${DECLARATION_TYPES.join(", ")}. Include important visible declaration regions even when confidence is moderate. Bounding boxes are required whenever the location can be estimated; otherwise use null.`,
    src,
    { model: "gpt-5.6-luna" },
  );
  const content = response?.message?.content || response?.content || response?.text || "";
  const parsed = parseVisualJson(content);
  return Array.isArray(parsed?.declarations) ? parsed.declarations.map((item) => normalizeDeclaration(item, imageIndex)).filter((item) => item.text || item.boundingBox) : [];
}

export default function ScanVisualCheck() {
  const [results, setResults] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [declarationBusy, setDeclarationBusy] = useState(false);
  const [declarationMessage, setDeclarationMessage] = useState("");
  const [open, setOpen] = useState(true);
  const [referenceWidth, setReferenceWidth] = useState("");

  useEffect(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(DECLARATION_KEY);
    setResults([]);
    setDeclarations([]);
    setDeclarationMessage("");

    let stopped = false;
    let observer;
    let timer;
    let running = false;
    let lastSignature = "";
    let debounceTimer;
    let declarationSignature = "";

    const run = async () => {
      if (running || stopped) return;
      const sources = getScanImages();
      const signature = sources.join("|");
      if (signature === lastSignature) return;
      lastSignature = signature;

      if (!sources.length) {
        setResults([]);
        setDeclarations([]);
        window.sessionStorage.removeItem(STORAGE_KEY);
        window.sessionStorage.removeItem(DECLARATION_KEY);
        return;
      }

      running = true;
      try {
        const inspected = await Promise.all(sources.map((src) => inspectImageSource(src).catch(() => null)));
        if (!stopped) setResults(inspected.filter(Boolean));
      } finally {
        running = false;
      }

      const visualSignature = sources.join("|");
      if (visualSignature !== declarationSignature && window.puter?.ai?.chat) {
        declarationSignature = visualSignature;
        setDeclarationBusy(true);
        setDeclarationMessage("Detecting declaration regions...");
        try {
          const detected = (await Promise.all(sources.map((src, index) => detectDeclarations(src, index).catch(() => [])))).flat();
          if (!stopped) {
            setDeclarations(detected);
            window.sessionStorage.setItem(DECLARATION_KEY, JSON.stringify(detected));
            setDeclarationMessage(detected.length ? `${detected.length} declaration regions detected.` : "No declaration regions could be confidently localized.");
          }
        } finally {
          if (!stopped) setDeclarationBusy(false);
        }
      }
    };

    const scheduleRun = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 120);
    };

    const attach = () => {
      const grid = document.querySelector(".scan-image-grid");
      if (grid && !observer) {
        observer = new MutationObserver(scheduleRun);
        observer.observe(grid, { childList: true, subtree: true });
      }
      scheduleRun();
    };

    timer = window.setInterval(attach, 900);
    attach();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(debounceTimer);
      observer?.disconnect();
    };
  }, []);

  const average = results.length ? Math.round(results.reduce((sum, item) => sum + item.readability, 0) / results.length) : 0;
  const label = average >= 75 ? "Good" : average >= 50 ? "Fair" : "Poor";

  const estimatedMm = useMemo(() => {
    const widthMm = Number(referenceWidth);
    if (!Number.isFinite(widthMm) || widthMm <= 0) return null;
    const values = results.filter((item) => item.medianLineHeight > 0).map((item) => (item.medianLineHeight * widthMm) / item.width);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [referenceWidth, results]);

  const placementLabel = results.length === 0 ? "Needs review" : results.some((item) => item.placement === "REVIEW") ? "Review" : results.every((item) => item.placement === "SCREENED") ? "Screened" : "Needs review";
  const hasOcr = document.querySelectorAll(".ocr-fields-grid > div").length > 0;

  useEffect(() => {
    if (!results.length) return;
    const detail = {
      readability: average,
      readable: average >= 50,
      textDetected: results.some((item) => item.textLines > 0),
      placementReview: results.some((item) => item.placement === "REVIEW"),
      fontSizeCalibrated: estimatedMm !== null,
      estimatedTextHeightMm: estimatedMm,
      declarationCoverageScreened: hasOcr,
      imagesChecked: results.length,
      declarationEvidence: declarations,
      declarationModel: declarations.length || declarationBusy ? "gpt-5.6-luna" : null,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent("parakh:visual-analysis", { detail }));
  }, [results, average, estimatedMm, hasOcr, declarations, declarationBusy]);

  if (!results.length) return null;

  return (
    <section className="scan-visual-check">
      <div className="section-heading">
        <div>
          <h2>Visual inspection</h2>
          <p>Automatic screening for readability, text regions, declaration locations and calibrated text-size estimation.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)}>{open ? "Hide" : "Show"}</button>
      </div>

      {open && <>
        <div className="visual-check-summary">
          <div><strong>Readability</strong><span>{label} · {average}/100</span></div>
          <div><strong>Text detection</strong><span>{results.reduce((sum, item) => sum + item.textLines, 0)} text-line regions detected</span></div>
          <div><strong>Placement screening</strong><span>{placementLabel}</span></div>
          <div><strong>Declaration regions</strong><span>{declarationBusy ? "Analyzing..." : declarations.length || "None localized"}</span></div>
        </div>

        <div className="visual-check-calibration">
          <label>
            <span>Known package face width (mm)</span>
            <input type="number" min="1" step="0.1" placeholder="Optional calibration" value={referenceWidth} onChange={(event) => setReferenceWidth(event.target.value)} />
          </label>
          <div>
            <strong>Estimated text height</strong>
            <span>{estimatedMm === null ? "Needs calibration" : `${estimatedMm.toFixed(2)} mm`}</span>
            <small>Estimate only. It is not a legal threshold by itself.</small>
          </div>
        </div>

        <div className="visual-check-grid">
          {results.map((item, index) => <div className="visual-check-card" key={`${item.width}-${item.height}-${index}`}>
            <strong>Image {index + 1}</strong>
            <span>{item.width} × {item.height}px</span>
            <span>Readability {item.readability}/100</span>
            <span>Sharpness {Math.round(item.sharpness)}/100</span>
            <span>Contrast {Math.round(item.contrast)}/100</span>
            <span>Text regions {item.textLines}</span>
            <span>Text coverage {item.textCoverage}%</span>
            <span>Edge crowding {item.edgeCrowding}% · {item.placement === "REVIEW" ? "Review" : item.placement === "SCREENED" ? "Screened" : "Unable to verify"}</span>
            <span>Median detected line {item.medianLineHeight || "n/a"} px</span>
            <span>Calibrated size {estimatedMm === null ? "n/a" : `${(item.medianLineHeight * Number(referenceWidth) / item.width).toFixed(2)} mm`}</span>
          </div>)}
        </div>

        <div className="visual-declaration-header"><div><h3>Declaration map</h3><p>{declarationBusy ? "Multimodal analysis is local to this scan and runs in the background." : declarationMessage || "Detected declaration regions are shown against their source image."}</p></div></div>
        {declarations.length > 0 && <div className="visual-declaration-grid">
          {results.map((_item, imageIndex) => {
            const image = getScanImages()[imageIndex];
            const imageDeclarations = declarations.filter((item) => item.imageIndex === imageIndex);
            if (!imageDeclarations.length) return null;
            return <div className="visual-declaration-card" key={`decl-image-${imageIndex}`}>
              <div className="visual-declaration-canvas">
                <img src={image} alt={`Declaration map for package image ${imageIndex + 1}`} />
                {imageDeclarations.map((item, index) => item.boundingBox && <div className="visual-declaration-box" key={`${item.type}-${index}`} style={{ left: `${item.boundingBox.left * 100}%`, top: `${item.boundingBox.top * 100}%`, width: `${item.boundingBox.width * 100}%`, height: `${item.boundingBox.height * 100}%` }} title={`${item.type} · ${Math.round(item.confidence * 100)}%`}><span>{item.type.replaceAll("_", " ")}</span></div>)}
              </div>
              <div className="visual-declaration-list">{imageDeclarations.map((item, index) => <div key={`${item.type}-${index}`}><strong>{item.type.replaceAll("_", " ")}</strong><span>{item.text || "Localized region"}</span><small>{Math.round(item.confidence * 100)}% confidence{item.boundingBox ? " · localized" : " · location uncertain"}</small></div>)}</div>
            </div>;
          })}
        </div>}

        <div className="visual-check-note">Declaration localization is AI-assisted evidence. Bounding boxes and confidence support officer review; they do not themselves establish legal compliance. Missing or uncertain regions remain reviewable rather than being treated as automatically absent.</div>
      </>}
    </section>
  );
}
