import { useEffect, useState } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function transformImage(file, rotation, crop) {
  const bitmap = await createImageBitmap(file);
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const quarterTurn = normalizedRotation === 90 || normalizedRotation === 270;
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = quarterTurn ? bitmap.height : bitmap.width;
  rotatedCanvas.height = quarterTurn ? bitmap.width : bitmap.height;
  const rotatedContext = rotatedCanvas.getContext("2d");
  if (!rotatedContext) {
    bitmap.close();
    throw new Error("Could not prepare the image for editing.");
  }

  rotatedContext.save();
  if (normalizedRotation === 90) {
    rotatedContext.translate(rotatedCanvas.width, 0);
    rotatedContext.rotate(Math.PI / 2);
  } else if (normalizedRotation === 180) {
    rotatedContext.translate(rotatedCanvas.width, rotatedCanvas.height);
    rotatedContext.rotate(Math.PI);
  } else if (normalizedRotation === 270) {
    rotatedContext.translate(0, rotatedCanvas.height);
    rotatedContext.rotate(-Math.PI / 2);
  }
  rotatedContext.drawImage(bitmap, 0, 0);
  rotatedContext.restore();
  bitmap.close();

  const left = clamp(crop.left, 0, 90) / 100;
  const top = clamp(crop.top, 0, 90) / 100;
  const right = clamp(crop.right, 10, 100) / 100;
  const bottom = clamp(crop.bottom, 10, 100) / 100;
  const sx = Math.round(rotatedCanvas.width * Math.min(left, right - 0.01));
  const sy = Math.round(rotatedCanvas.height * Math.min(top, bottom - 0.01));
  const ex = Math.round(rotatedCanvas.width * Math.max(right, left + 0.01));
  const ey = Math.round(rotatedCanvas.height * Math.max(bottom, top + 0.01));
  const width = Math.max(1, ex - sx);
  const height = Math.max(1, ey - sy);

  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Could not create the edited image.");
  outputContext.drawImage(rotatedCanvas, sx, sy, width, height, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    output.toBlob((value) => value ? resolve(value) : reject(new Error("Could not export the edited image.")), "image/jpeg", 0.9);
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-edited.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

export default function ImageEditor({ file, url, onApply, onClose }) {
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ left: 5, top: 5, right: 95, bottom: 95 });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRotation(0);
    setCrop({ left: 5, top: 5, right: 95, bottom: 95 });
    setError("");
  }, [file]);

  function updateCrop(key, value) {
    const numeric = Number(value);
    setCrop((current) => {
      const next = { ...current, [key]: numeric };
      next.left = clamp(next.left, 0, next.right - 5);
      next.top = clamp(next.top, 0, next.bottom - 5);
      next.right = clamp(next.right, next.left + 5, 100);
      next.bottom = clamp(next.bottom, next.top + 5, 100);
      return next;
    });
  }

  async function apply() {
    setWorking(true);
    setError("");
    try {
      const editedFile = await transformImage(file, rotation, crop);
      onApply(editedFile);
    } catch (editError) {
      setError(editError.message || "Could not apply image edits.");
    } finally {
      setWorking(false);
    }
  }

  return <div className="image-editor-overlay" role="dialog" aria-modal="true" aria-label="Edit package image">
    <div className="image-editor-modal">
      <div className="image-editor-header">
        <div><p className="eyebrow">IMAGE PREPARATION</p><h2>Crop and rotate image</h2><p>Fix orientation and remove irrelevant background before OCR.</p></div>
        <button type="button" className="image-editor-close" onClick={onClose}>Close</button>
      </div>

      <div className="image-editor-preview">
        <img src={url} alt="Editable package preview" style={{ transform: `rotate(${rotation}deg)` }} />
        <div className="image-editor-crop" style={{ left: `${crop.left}%`, top: `${crop.top}%`, right: `${100 - crop.right}%`, bottom: `${100 - crop.bottom}%` }}><span>OCR area</span></div>
      </div>

      <div className="image-editor-actions">
        <button type="button" className="secondary-button" onClick={() => setRotation((value) => value - 90)}>Rotate left</button>
        <button type="button" className="secondary-button" onClick={() => setRotation((value) => value + 90)}>Rotate right</button>
        <button type="button" className="secondary-button" onClick={() => { setRotation(0); setCrop({ left: 5, top: 5, right: 95, bottom: 95 }); }}>Reset</button>
      </div>

      <div className="image-editor-crop-controls">
        {[["left", "Crop left"], ["top", "Crop top"], ["right", "Crop right"], ["bottom", "Crop bottom"]].map(([key, label]) => <label key={key}>{label}<input type="range" min={key === "right" || key === "bottom" ? 10 : 0} max={key === "right" || key === "bottom" ? 100 : 90} value={crop[key]} onChange={(event) => updateCrop(key, event.target.value)} /><span>{crop[key]}%</span></label>)}
      </div>

      {error && <div className="status-message">{error}</div>}
      <div className="image-editor-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={working}>Cancel</button><button type="button" className="primary-button" onClick={apply} disabled={working}>{working ? "Applying..." : "Apply & use image"}</button></div>
    </div>
  </div>;
}
