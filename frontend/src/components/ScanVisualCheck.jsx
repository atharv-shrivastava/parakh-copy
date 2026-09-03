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

function normalizeBoundingBox(box) {
  if (!box || typeof box !== "object") return null;
  const left = Number(box.left ?? box.x);
  const top = Number(box.top ?? box.y);
  const width = Number(box.width ?? box.w);
  const height = Number(box.height ?? box.h);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;

  // Providers may return normalized 0..1 coordinates or percentage 0..100 coordinates.
  const scale = [left, top, width, height].some((value) => value > 1) ? 0.01 : 1;
  const normalized = { left: left * scale, top: top * scale, width: width * scale, height: height * scale };
  if (normalized.left < 0 || normalized.top < 0 || normalized.width <= 0 || normalized.height <= 0) return null;
  return {
    left: Math.min(1, normalized.left),
    top: Math.min(1, normalized.top),
    width: Math.min(1 - Math.min(1, normalized.left), normalized.width),
    height: Math.min(1 - Math.min(1, normalized.top), normalized.height),
  };
}

function normalizeDeclaration(item, index) {
  if (!item || typeof item !== "object") return null;
  const imageIndex = Number(item.imageIndex ?? item.image ?? 0);
  const rawConfidence = Number(item.confidence);
  const confidence = rawConfidence > 1 ? rawConfidence / 100 : Number.isFinite(rawConfidence) ? rawConfidence : 0;
  return {
    ...item,
    imageIndex: Number.isFinite(imageIndex) && imageIndex >= 1 && item.imageIndex != null ? imageIndex - 1 : Math.max(0, imageIndex || 0),
    type: String(item.type || item.declarationType || "OTHER_DECLARATION").toUpperCase(),
    text: String(item.text ?? item.extractedText ?? item.value ?? ""),
    confidence: Math.max(0, Math.min(1, confidence)),
    boundingBox: normalizeBoundingBox(item.boundingBox || item.bbox || item.box),
    _index: index,
  };
}

export default function ScanVisualCheck() {
  const [results, setResults] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [declarationMessage, setDeclarationMessage] = useState("");
  const [activeDeclarationImage, setActiveDeclarationImage] = useState(0);
  const [open, setOpen] = useState(true);
  const [referenceWidth, setReferenceWidth] = useState("");
  const [declarationBusy, setDeclarationBusy] = useState(false);

  useEffect(() => {
    const loadDeclarationEvidence = () => {
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(DECLARATION_KEY) || "[]");
        const normalized = Array.isArray(parsed) ? parsed.map(normalizeDeclaration).filter(Boolean) : [];
        setDeclarations(normalized);
        setDeclarationMessage(normalized.length ? `${normalized.length} declaration region${normalized.length === 1 ? "" : "s"} returned by OCR.` : "OCR completed without localized declaration regions.");
      } catch {
        setDeclarations([]);
        setDeclarationMessage("Declaration evidence could not be read.");
      }
    };

    loadDeclarationEvidence();
    const handleEvidence = (event) => {
      const next = Array.isArray(event.detail) ? event.detail.map(normalizeDeclaration).filter(Boolean) : [];
      setDeclarations(next);
      setDeclarationMessage(next.length ? `${next.length} declaration region${next.length === 1 ? "" : "s"} returned by OCR.` : "OCR completed without localized declaration regions.");
      setDeclarationBusy(false);
    };
    window.addEventListener("parakh:declaration-evidence", handleEvidence);

    return () => window.removeEventListener("parakh:declaration-evidence", handleEvidence);
  }, []);

  // The previous implementation rendered the declaration UI but never populated `results`.
  // Inspect the actual package images when this component mounts, then keep the results available
  // for the declaration-map renderer and the visual-inspection summary.
  useEffect(() => {
    let cancelled = false;
    const sources = getScanImages();
    if (!sources.length) return undefined;

    setDeclarationBusy(true);
    Promise.all(sources.map((src) => inspectImageSource(src).catch(() => null)))
      .then((next) => {
        if (cancelled) return;
        const valid = next.filter(Boolean);
        setResults(valid);
        setDeclarationBusy(false);
        if (!valid.length) setDeclarationMessage("Package images could not be inspected.");
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setDeclarationBusy(false);
          setDeclarationMessage("Package images could not be inspected.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveDeclarationImage((current) => Math.max(0, Math.min(current, Math.max(0, results.length - 1))));
  }, [results.length]);

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
  const hasOcr = typeof document !== "undefined" && document.querySelectorAll(".ocr-fields-grid > div").length > 0;

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
      declarationModel: declarations.length ? "ocr-provider-inline-evidence" : null,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent("parakh:visual-analysis", { detail }));
  }, [results, average, estimatedMm, hasOcr, declarations]);

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

        <div className="visual-declaration-header"><div><h3>Declaration map</h3><p>{declarationMessage || "Declaration regions returned with the OCR analysis are shown against their source image."}</p></div></div>
        <div className="visual-declaration-browser">
          <div className="visual-declaration-tabs" role="tablist" aria-label="Package images">
            {results.map((_item, imageIndex) => {
              const imageDeclarations = declarations.filter((item) => item.imageIndex === imageIndex);
              const selectedTab = activeDeclarationImage === imageIndex;
              return <button
                type="button"
                role="tab"
                aria-selected={selectedTab}
                className={selectedTab ? "visual-declaration-tab is-active" : "visual-declaration-tab"}
                key={`decl-tab-${imageIndex}`}
                onClick={() => setActiveDeclarationImage(imageIndex)}
              >
                Image {imageIndex + 1}
                <span>{imageDeclarations.length ? `${imageDeclarations.length} found` : "No localized regions"}</span>
              </button>;
            })}
          </div>
          {(() => {
            const imageIndex = Math.min(activeDeclarationImage, results.length - 1);
            const image = getScanImages()[imageIndex];
            const imageDeclarations = declarations.filter((item) => item.imageIndex === imageIndex);
            return <div className="visual-declaration-card is-single">
              <div className="visual-declaration-canvas">
                <img src={image} alt={`Declaration map for package image ${imageIndex + 1}`} />
                {imageDeclarations.map((item, index) => item.boundingBox && <div className="visual-declaration-box" key={`${item.type}-${item._index ?? index}`} style={{ left: `${item.boundingBox.left * 100}%`, top: `${item.boundingBox.top * 100}%`, width: `${item.boundingBox.width * 100}%`, height: `${item.boundingBox.height * 100}%` }} title={`${item.type} · ${Math.round(item.confidence * 100)}%`}><span>{item.type.replaceAll("_", " ")}</span></div>)}
              </div>
              <div className="visual-declaration-list">
                {imageDeclarations.length ? imageDeclarations.map((item, index) => <div key={`${item.type}-${item._index ?? index}`}><strong>{item.type.replaceAll("_", " ")}</strong><span>{item.text || "Localized region"}</span><small>{Math.round(item.confidence * 100)}% confidence{item.boundingBox ? " · localized" : " · location uncertain"}</small></div>) : <div className="visual-declaration-empty"><strong>No declaration regions localized for this image.</strong><span>The image was analyzed, but no declaration box could be returned with sufficient confidence.</span></div>}
              </div>
            </div>;
          })()}
        </div>

        <div className="visual-check-note">Declaration localization is AI-assisted evidence. Bounding boxes and confidence support officer review; they do not themselves establish legal compliance. Missing or uncertain regions remain reviewable rather than being treated as automatically absent.</div>
      </>}
    </section>
  );
}
