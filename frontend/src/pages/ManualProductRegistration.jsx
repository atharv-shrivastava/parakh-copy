import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";
const MAX_IMAGES = 4;
const emptyForm = { brandName: "", productName: "", description: "", netQuantity: "", unit: "", mrp: "", barcode: "", shopName: "", shopAddress: "", shopCity: "", shopState: "", notes: "" };

function flatten(nodes, path = []) {
  return nodes.flatMap((node) => {
    const next = [...path, node];
    return [{ ...node, path: next }, ...flatten(node.children || [], next)];
  });
}

async function fileToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Could not prepare image."); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.62);
}

function ManualProductRegistration() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`${API_URL}/categories/tree/all`).then(async (r) => {
      const data = await r.json().catch(() => []);
      if (!r.ok) throw new Error(data.error || "Could not load categories");
      setCategories(data);
    }).catch((e) => setMessage(e.message));
  }, []);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!incoming.length) return;
    setImages((current) => {
      const accepted = incoming.slice(0, Math.max(0, MAX_IMAGES - current.length)).map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...current, ...accepted];
    });
    if (images.length + incoming.length > MAX_IMAGES) setMessage(`Maximum ${MAX_IMAGES} images can be retained.`);
  }

  function removeImage(index) {
    setImages((current) => {
      const target = current[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return current.filter((_, i) => i !== index);
    });
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      setCameraOpen(true);
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } });
    } catch { setMessage("Camera could not be opened. Check browser permission or use Upload Images."); }
  }

  function closeCamera() {
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return setMessage("Camera is still starting.");
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d"); if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) addFiles([new File([blob], `manual-${Date.now()}.jpg`, { type: "image/jpeg" })]); closeCamera(); }, "image/jpeg", 0.80);
  }

  async function save(event) {
    event.preventDefault();
    const selected = flatten(categories).find((c) => c.id === categoryId);
    if (!selected?.isFinalProductType) return setMessage("Select a final product category.");
    if (!form.productName.trim()) return setMessage("Product name is required.");
    if (!form.shopName.trim()) return setMessage("Shop name is required.");
    if (!images.length) return setMessage("Take or upload at least one package image.");
    setSaving(true); setMessage("");
    try {
      const imageUrls = await Promise.all(images.map(({ file }) => fileToDataUrl(file)));
      const response = await apiFetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId, imageUrls, ocrData: { provider: "manual", ocr: null, compliance: null }, complianceStatus: "NEEDS_REVIEW", violationReason: "Manual registration without OCR; inspect and verify declarations." }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not register product");
      navigate(`/products/item/${data.product?.id || data.id}`);
    } catch (e) { setMessage(e.message || "Registration failed."); }
    finally { setSaving(false); }
  }

  const finalCategories = flatten(categories).filter((category) => category.isFinalProductType);
  return <div className="scan-page manual-registration-page">
    <Link to="/scan" className="back-link">← Back to Scan</Link>
    <div className="page-header"><p className="eyebrow">MANUAL REGISTRATION</p><h1>Register product manually</h1><p>Take or upload package evidence, then enter the product information yourself. OCR and Rules Engine analysis are intentionally skipped.</p></div>
    {message && <div className="status-message">{message}</div>}

    <section className="scan-area">
      <div className="scan-icon">▧</div><h2>Package evidence</h2><p>Keep up to {MAX_IMAGES} clear package photos. At least one image is required.</p>
      <div className="scan-actions"><label className="scan-button secondary"><input type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />Upload Images</label><button type="button" className="scan-button primary" onClick={openCamera}>Use Camera</button></div>
      {images.length > 0 && <div className="scan-image-grid">{images.map((item, i) => <div className="scan-image-card" key={item.url}><img src={item.url} alt={`Evidence ${i + 1}`} /><button type="button" onClick={() => removeImage(i)}>Remove</button></div>)}</div>}
    </section>

    <form className="registration-form" onSubmit={save}>
      <div className="section-heading"><div><h2>Product information</h2><p>Everything here is entered manually.</p></div></div>
      <div className="form-grid">
        <label>Final category *<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Select final category</option>{finalCategories.map((c) => <option key={c.id} value={c.id}>{c.path.map((x) => x.name).join(" → ")}</option>)}</select></label>
        <label>Product name *<input required value={form.productName} onChange={(e) => update("productName", e.target.value)} /></label>
        <label>Brand / Manufacturer<input value={form.brandName} onChange={(e) => update("brandName", e.target.value)} /></label>
        <label>Net quantity<input value={form.netQuantity} onChange={(e) => update("netQuantity", e.target.value)} placeholder="e.g. 500" /></label>
        <label>Unit<input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="g, kg, ml, L, pcs..." /></label>
        <label>MRP<input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => update("mrp", e.target.value)} /></label>
        <label>Barcode<input value={form.barcode} onChange={(e) => update("barcode", e.target.value)} /></label>
        <label>Shop name *<input required value={form.shopName} onChange={(e) => update("shopName", e.target.value)} /></label>
        <label>Shop address<input value={form.shopAddress} onChange={(e) => update("shopAddress", e.target.value)} /></label>
        <label>City<input value={form.shopCity} onChange={(e) => update("shopCity", e.target.value)} /></label>
        <label>State<input value={form.shopState} onChange={(e) => update("shopState", e.target.value)} /></label>
        <label className="full-width">Description / notes<textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
      </div>
      <button className="register-product-button" disabled={saving}>{saving ? "Registering..." : "Register Product"}</button>
    </form>

    {cameraOpen && <div className="camera-modal"><div className="camera-panel"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-controls"><button type="button" onClick={capture}>Capture</button><button type="button" onClick={closeCamera}>Close</button></div></div></div>}
  </div>;
}

export default ManualProductRegistration;
