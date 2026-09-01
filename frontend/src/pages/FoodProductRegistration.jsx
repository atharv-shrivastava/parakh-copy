import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function FoodProductRegistration() {
  const [searchParams] = useSearchParams();
  const [roots, setRoots] = useState([]);
  const [levels, setLevels] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState({ brandName: "", productName: "", description: "", netQuantity: "", unit: "", mrp: "", barcode: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadRoots() {
      try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) throw new Error("Unable to load categories");
        const data = await response.json();
        setRoots(data);

        const parentId = searchParams.get("parentId");
        if (parentId) {
          const categoryResponse = await fetch(`${API_URL}/categories/id/${parentId}`);
          if (categoryResponse.ok) {
            const category = await categoryResponse.json();
            const chain = [];
            let current = category;
            while (current) {
              chain.unshift(current);
              current = current.parent;
            }
            setLevels(chain);
            setSelectedIds(chain.map((item) => item.id));
          }
        }
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
    loadRoots();
  }, [searchParams]);

  async function selectLevel(levelIndex, id) {
    const nextIds = selectedIds.slice(0, levelIndex);
    nextIds[levelIndex] = id;
    setSelectedIds(nextIds);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/categories/id/${id}`);
      if (!response.ok) throw new Error("Unable to load category");
      const category = await response.json();
      setLevels((current) => [...current.slice(0, levelIndex), category]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function selectChoice(choiceId) {
    try {
      const response = await fetch(`${API_URL}/categories/id/${choiceId}`);
      if (!response.ok) throw new Error("Unable to load category");
      const category = await response.json();
      setLevels((current) => [...current, category]);
      setSelectedIds((current) => [...current, category.id]);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const selectedCategory = levels[levels.length - 1];
  const choices = levels.length === 0 ? roots : selectedCategory?.children ?? [];
  const selectedPath = levels.map((level) => level.name).join(" → ");
  const isLeaf = Boolean(selectedCategory && selectedCategory.children?.length === 0);

  async function registerProduct(event) {
    event.preventDefault();
    if (!selectedCategory || !isLeaf) {
      setMessage("Select the final product type before registering the product.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: selectedCategory.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed");

      setMessage(data.complianceStatus === "VIOLATION" ? `Product registered. Result: VIOLATION. ${data.violationReason}` : "Product registered. Basic compliance screening passed.");
      setForm({ brandName: "", productName: "", description: "", netQuantity: "", unit: "", mrp: "", barcode: "" });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="products-page">
      <Link to="/products" className="back-link">← Back to Products</Link>
      <div className="page-header">
        <p className="eyebrow">PRODUCT REGISTRATION</p>
        <h1>Register New Product</h1>
        <p>Choose the hierarchy dynamically. The same registration flow works for Food, Utensils, and every future category.</p>
      </div>

      {message && <div className="status-message">{message}</div>}

      {loading ? <p>Loading categories...</p> : (
        <>
          <section className="product-categories">
            <div className="section-heading"><div><h2>Product hierarchy</h2><p>{selectedPath || "Start with a main category."}</p></div></div>

            {levels.map((level, index) => (
              <div className="hierarchy-level" key={level.id}>
                <label>Level {index + 1}</label>
                <select value={selectedIds[index] || level.id} onChange={(event) => selectLevel(index, event.target.value)}>
                  <option value={level.id}>{level.name}</option>
                  {(index === 0 ? roots : (levels[index - 1]?.children ?? [])).filter((item) => item.id !== level.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            ))}

            {choices.length > 0 && (
              <div className="category-grid">
                {choices.map((choice) => (
                  <button key={choice.id} type="button" className="category-card" onClick={() => selectChoice(choice.id)}>
                    <h3>{choice.name}</h3>
                    <p>{choice.children?.length ? "Continue to next level" : "Final product type"}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {isLeaf && (
            <form className="registration-form" onSubmit={registerProduct}>
              <div className="section-heading"><div><h2>Product details</h2><p>Selected: {selectedPath}</p></div></div>
              <div className="form-grid">
                <label>Company / Manufacturer / Brand<input value={form.brandName} onChange={(e) => updateForm("brandName", e.target.value)} placeholder="e.g. Company name" /></label>
                <label>Product name *<input required value={form.productName} onChange={(e) => updateForm("productName", e.target.value)} /></label>
                <label>Net quantity<input value={form.netQuantity} onChange={(e) => updateForm("netQuantity", e.target.value)} placeholder="e.g. 100" /></label>
                <label>Unit<select value={form.unit} onChange={(e) => updateForm("unit", e.target.value)}><option value="">Select unit</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option><option value="m">m</option></select></label>
                <label>MRP<input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => updateForm("mrp", e.target.value)} /></label>
                <label>Barcode<input value={form.barcode} onChange={(e) => updateForm("barcode", e.target.value)} /></label>
                <label className="full-width">Description<textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} /></label>
              </div>
              <button className="register-product-button" type="submit" disabled={saving}>{saving ? "Registering..." : "Register Product"}</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default FoodProductRegistration;
