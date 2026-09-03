import { useEffect, useState } from "react";
import "../styles/scan-visual-check.css";

async function inspectImageSource(src) {
  const response = await fetch(src);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) { bitmap.close(); throw new Error("Could not inspect image."); }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0; let sumSq = 0; let edgeCount = 0; let edgeSamples = 0; let lapSum = 0; let lapSq = 0;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    const g = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    gray[y * width + x] = g; sum += g; sumSq += g * g;
  }
  const count = Math.max(1, width * height);
  const contrast = Math.sqrt(Math.max(0, sumSq / count - Math.pow(sum / count, 2)));
  for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < width - 1; x += 2) {
    const i = y * width + x; const c = gray[i]; const left = gray[i - 1]; const right = gray[i + 1]; const up = gray[i - width]; const down = gray[i + width];
    const gx = Math.abs(right - left); const gy = Math.abs(down - up);
    if (gx + gy > 55) edgeCount += 1; edgeSamples += 1;
    const lap = left + right + up + down - 4 * c; lapSum += lap; lapSq += lap * lap;
  }
  const lapVariance = Math.max(0, lapSq / Math.max(1, edgeSamples) - Math.pow(lapSum / Math.max(1, edgeSamples), 2));
  const sharpness = Math.min(100, Math.max(0, lapVariance / 7));
  const contrastScore = Math.min(100, Math.max(0, contrast * 2.2));
  const edgeScore = Math.min(100, edgeCount / Math.max(1, edgeSamples) * 600);
  const readability = Math.round(Math.min(100, 0.55 * sharpness + 0.35 * contrastScore + 0.10 * edgeScore));
  return { width, height, readability, sharpness, contrast: contrastScore };
}

export default function ScanVisualCheck() {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let stopped = false;
    let observer;
    const run = async () => {
      const images = Array.from(document.querySelectorAll('.scan-image-grid .scan-image-card img')).slice(0, 4);
      const next = [];
      for (let index = 0; index < images.length; index += 1) {
        try { next.push(await inspectImageSource(images[index].src)); } catch { next.push(null); }
      }
      if (!stopped) setResults(next.filter(Boolean));
    };
    const attach = () => {
      const grid = document.querySelector('.scan-image-grid');
      if (grid && !observer) { observer = new MutationObserver(() => run()); observer.observe(grid, { childList: true, subtree: true, attributes: true }); }
      run();
    };
    const timer = window.setInterval(attach, 400);
    attach();
    return () => { stopped = true; window.clearInterval(timer); observer?.disconnect(); };
  }, []);

  if (!results.length) return null;
  const average = Math.round(results.reduce((sum, item) => sum + item.readability, 0) / results.length);
  const label = average >= 75 ? "Good" : average >= 50 ? "Fair" : "Poor";

  return <section className="scan-visual-check">
    <div className="section-heading"><div><h2>Visual check</h2><p>Runs locally on the same scan images. This is a screening aid, not a legal determination.</p></div><button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)}>{open ? "Hide" : "Show"}</button></div>
    {open && <><div className="visual-check-summary"><div><strong>Overall readability</strong><span>{label} · {average}/100</span></div><div><strong>Images checked</strong><span>{results.length}</span></div><div><strong>Font size</strong><span>Manual/calibrated check required</span></div></div><div className="visual-check-grid">{results.map((item, index) => <div className="visual-check-card" key={index}><strong>Image {index + 1}</strong><span>{item.width} × {item.height}px</span><span>Readability {item.readability}/100</span><span>Sharpness {Math.round(item.sharpness)}/100</span><span>Contrast {Math.round(item.contrast)}/100</span></div>)}</div></>}
  </section>;
}
