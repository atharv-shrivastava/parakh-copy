import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function createSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function FoodProductRegistration() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function createMainCategory(event) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("Enter a category name.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: createSlug(trimmedName),
          parentId: null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create category");
      }

      setMessage(`Category "${data.name}" created successfully.`);
      setName("");

      setTimeout(() => {
        navigate(`/products/category/${data.id}`);
      }, 500);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="products-page">
      <Link to="/products" className="back-link">
        ← Back to Products
      </Link>

      <div className="page-header">
        <p className="eyebrow">CATEGORY MANAGEMENT</p>
        <h1>Register New Category</h1>
        <p>
          Create a new main category such as Food, Utensils, Cleaning, or any
          other product group. Products are added later through scanning.
        </p>
      </div>

      {message && <div className="status-message">{message}</div>}

      <form className="registration-form" onSubmit={createMainCategory}>
        <div className="section-heading">
          <div>
            <h2>Level 1 Category</h2>
            <p>This creates a new main category. Do not select Food or Utensils here.</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="full-width">
            Category name *
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Cleaning"
              autoFocus
            />
          </label>
        </div>

        <button
          type="submit"
          className="register-product-button"
          disabled={saving}
        >
          {saving ? "Creating..." : "Create Main Category"}
        </button>
      </form>
    </div>
  );
}

export default FoodProductRegistration;
