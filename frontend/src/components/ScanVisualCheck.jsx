import { useEffect, useMemo, useState } from "react";
import "../styles/scan-visual-check.css";

const STORAGE_KEY = "parakhVisualInspection";
const MAX_IMAGES = 4;
const MAX_ANALYSIS_SIDE = 1200;

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
        if (x < width * 0.04 || x > width * 0.96 || y < height * 0.04 || y > height * 0.96) {
          edgeDarkPixels += 1;
        }
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
      if (bandHeight >= 2 && bandHeight <= Math.max(60, height * 0.12)) {
        lineBands.push({ top: bandStart, height: bandHeight });
      }
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
  const medianLineHeight = lineBands.length
    ? [...lineBands.map((item) => item.height)].sort((a, b) => a - b)[Math.floor(lineBands.length / 2)]
    : 0;
  const textCoverage = Math.round(Math.min(100, (darkPixels / count) * 100 * 4));
  const edgeCrowding = Math.round(Math.min(100, (edgeDarkPixels / Math.max(1, darkPixels)) * 100));
  const placement = edgeCrowding > 18 ? "REVIEW" : lineBands.length >= 2 ? "SCREENED" : "UNABLE_TO_VERIFY";

  return {
    width,
    height,
    readability,
    sharpness,
    contrast: contrastScore,
    textLines: lineBands.length,
    textCoverage,
    edgeCrowding,
    medianLineHeight,
    placement,
  };
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

export default function ScanVisualCheck() {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(true);
  const [referenceWidth, setReferenceWidth] = useState("");

  useEffect(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setResults([]);

    let stopped = false;
    let observer;
    let timer;
    let running = false;
    let lastSignature = "";
    let debounceTimer;

    const run = async () => {
      if (running || stopped) return;

      const sources = getScanImages();
      const signature = sources.join("|");
      if (signature === lastSignature) return;
      lastSignature = signature;

      if (!sources.length) {
        setResults([]);
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }

      running = true;
      try {
        const inspected = await Promise.all(sources.map((src) => inspectImageSource(src).catch(() => null)));
        const next = inspected.filter(Boolean);
        if (!stopped) setResults(next);
      } finally {
        running = false;
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

  const average = results.length
    ? Math.round(results.reduce((sum, item) => sum + item.readability, 0) / results.length)
    : 0;
  const label = average >= 75 ? "Good" : average >= 50 ? "Fair" : "Poor";

  const estimatedMm = useMemo(() => {
    const widthMm = Number(referenceWidth);
    if (!Number.isFinite(widthMm) || widthMm <= 0) return null;

    const values = results
      .filter((item) => item.medianLineHeight > 0)
      .map((item) => (item.medianLineHeight * widthMm) / item.width);

    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [referenceWidth, results]);

  const placementLabel = results.length === 0
    ? "Needs review"
    : results.some((item) => item.placement === "REVIEW")
      ? "Review"
      : results.every((item) => item.placement === "SCREENED")
        ? "Screened"
        : "Needs review";

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
    };

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent("parakh:visual-analysis", { detail }));
  }, [results, average, estimatedMm, hasOcr]);

  if (!results.length) return null;

  return (
    <section className="scan-visual-check">
      <div className="section-heading">
        <div>
          <h2>Visual inspection</h2>
          <p>Automatic image screening for readability, text presence, layout crowding and calibrated text-size estimation.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <>
          <div className="visual-check-summary">
            <div><strong>Readability</strong><span>{label} · {average}/100</span></div>
            <div><strong>Text detection</strong><span>{results.reduce((sum, item) => sum + item.textLines, 0)} text-line regions detected</span></div>
            <div><strong>Placement screening</strong><span>{placementLabel}</span></div>
          </div>

          <div className="visual-check-calibration">
            <label>
              <span>Known package face width (mm)</span>
              <input
                type="number"
                min="1"
                step="0.1"
                placeholder="Optional calibration"
                value={referenceWidth}
                onChange={(event) => setReferenceWidth(event.target.value)}
              />
            </label>
            <div>
              <strong>Estimated text height</strong>
              <span>{estimatedMm === null ? "Needs calibration" : `${estimatedMm.toFixed(2)} mm`}</span>
              <small>Estimate uses detected text-line height relative to the image width. It is not a legal threshold by itself.</small>
            </div>
          </div>

          <div className="visual-check-grid">
            {results.map((item, index) => (
              <div className="visual-check-card" key={`${item.width}-${item.height}-${index}`}>
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
              </div>
            ))}
          </div>

          <div className="visual-check-note">
            Declaration presence is cross-checked through the OCR result shown above. Placement is a visual screening signal, not a final legal determination. Rules with measured font thresholds should use the calibrated value and the applicable legal rule.
          </div>
        </>
      )}
    </section>
  );
}
