
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://localhost:5000";

function FoodProductRegistration() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);

  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);

  const [newProductTypeName, setNewProductTypeName] = useState("");
  const [showNewProductType, setShowNewProductType] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const response = await fetch(`${API_URL}/api/categories`);

      if (!response.ok) {
        throw new Error("Failed to load categories");
      }

      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error(error);
      setMessage("Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }

  function createSlug(name) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleCategorySelect(category) {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setSelectedType(null);
    setShowNewSubcategory(false);
    setShowNewProductType(false);
    setMessage("");
  }

  function handleSubcategorySelect(subcategory) {
    setSelectedSubcategory(subcategory);
    setSelectedType(null);
    setShowNewProductType(false);
    setMessage("");
  }

  function handleProductTypeSelect(type) {
    setSelectedType(type);
    setMessage("");
  }

  async function addCategory() {
    if (!newCategoryName.trim()) {
      setMessage("Please enter a category name.");
      return;
    }

    const name = newCategoryName.trim();
    const slug = createSlug(name);

    try {
      const response = await fetch(`${API_URL}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          parentId: null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create category");
      }

      setNewCategoryName("");
      setShowNewCategory(false);

      await loadCategories();

      setMessage(`"${name}" added successfully.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  async function addSubcategory() {
    if (!newSubcategoryName.trim() || !selectedCategory) {
      setMessage("Please enter a subcategory name.");
      return;
    }

    const name = newSubcategoryName.trim();
    const slug = createSlug(name);

    try {
      const response = await fetch(`${API_URL}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          parentId: selectedCategory.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create subcategory");
      }

      setNewSubcategoryName("");
      setShowNewSubcategory(false);

      await loadCategories();

      const updatedResponse = await fetch(
        `${API_URL}/api/categories/${selectedCategory.slug}`
      );

      if (!updatedResponse.ok) {
        throw new Error("Subcategory created, but refresh failed.");
      }

      const updatedCategory = await updatedResponse.json();

      setSelectedCategory(updatedCategory);
      setMessage(`"${name}" added successfully.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  async function addProductType() {
    if (!newProductTypeName.trim() || !selectedSubcategory) {
      setMessage("Please enter a product type name.");
      return;
    }

    const name = newProductTypeName.trim();
    const slug = createSlug(name);

    try {
      const response = await fetch(`${API_URL}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          parentId: selectedSubcategory.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create product type");
      }

      setNewProductTypeName("");
      setShowNewProductType(false);

      const updatedResponse = await fetch(
        `${API_URL}/api/categories/${selectedSubcategory.slug}`
      );

      if (!updatedResponse.ok) {
        throw new Error("Product type created, but refresh failed.");
      }

      const updatedSubcategory = await updatedResponse.json();

      setSelectedSubcategory(updatedSubcategory);

      setMessage(`"${name}" added successfully.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  async function deleteCategory(category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/categories/${category.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      if (selectedCategory?.id === category.id) {
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setSelectedType(null);
      }

      await loadCategories();

      setMessage(`"${category.name}" deleted successfully.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  async function deleteSubcategory(subcategory) {
    const confirmed = window.confirm(
      `Delete "${subcategory.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/categories/${subcategory.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete subcategory");
      }

      if (selectedSubcategory?.id === subcategory.id) {
        setSelectedSubcategory(null);
        setSelectedType(null);
      }

      await loadCategories();

      if (selectedCategory) {
        const updatedResponse = await fetch(
          `${API_URL}/api/categories/${selectedCategory.slug}`
        );

        if (updatedResponse.ok) {
          const updatedCategory = await updatedResponse.json();
          setSelectedCategory(updatedCategory);
        }
      }

      setMessage(`"${subcategory.name}" deleted successfully.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  async function deleteProductType(productType) {
    const confirmed = window.confirm(
      `Delete "${productType.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/categories/${productType.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete product type");
      }

      if (selectedType?.id === productType.id) {
        setSelectedType(null);
      }

      if (selectedSubcategory) {
        const updatedResponse = await fetch(
          `${API_URL}/api/categories/${selectedSubcategory.slug}`
        );

        if (updatedResponse.ok) {
          const updatedSubcategory = await updatedResponse.json();
          setSelectedSubcategory(updatedSubcategory);
        }
      }

      setMessage(`"${productType.name}" deleted successfully.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  const subcategories = selectedCategory?.children ?? [];
  const productTypes = selectedSubcategory?.children ?? [];

  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT REGISTRATION</p>

        <h1>Register New Food Product</h1>

        <p>
          Select the appropriate category, subcategory, and product type.
        </p>
      </div>

      {message && <p>{message}</p>}

      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <>
          {/* MAIN CATEGORIES */}

          <section className="product-categories">
            <div className="section-heading">
              <div>
                <h2>Category</h2>
                <p>Select a main product category.</p>
              </div>
            </div>

            <div className="category-grid">
              {categories.map((category) => (
                <div key={category.id} className="category-item">
                  <button
                    type="button"
                    className={`category-card ${
                      selectedCategory?.id === category.id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <h3>{category.name}</h3>
                  </button>

                  <button
                    type="button"
                    className="delete-category-button"
                    onClick={() => deleteCategory(category)}
                  >
                    Delete
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="category-card"
                onClick={() => setShowNewCategory(!showNewCategory)}
              >
                <h3>+ Add New Category</h3>
              </button>
            </div>

            {showNewCategory && (
              <div className="category-form">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />

                <button type="button" onClick={addCategory}>
                  Add Category
                </button>
              </div>
            )}
          </section>

          {/* SUBCATEGORIES */}

          {selectedCategory && (
            <section className="product-categories">
              <div className="section-heading">
                <div>
                  <h2>{selectedCategory.name} Subcategories</h2>
                  <p>Select a subcategory.</p>
                </div>
              </div>

              <div className="category-grid">
                {subcategories.map((subcategory) => (
                  <div
                    key={subcategory.id}
                    className="category-item"
                  >
                    <button
                      type="button"
                      className={`category-card ${
                        selectedSubcategory?.id === subcategory.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        handleSubcategorySelect(subcategory)
                      }
                    >
                      <h3>{subcategory.name}</h3>
                    </button>

                    <button
                      type="button"
                      className="delete-category-button"
                      onClick={() =>
                        deleteSubcategory(subcategory)
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="category-card"
                  onClick={() =>
                    setShowNewSubcategory(!showNewSubcategory)
                  }
                >
                  <h3>+ Add New Subcategory</h3>
                </button>
              </div>

              {showNewSubcategory && (
                <div className="category-form">
                  <input
                    type="text"
                    placeholder={`New ${selectedCategory.name} subcategory`}
                    value={newSubcategoryName}
                    onChange={(e) =>
                      setNewSubcategoryName(e.target.value)
                    }
                  />

                  <button type="button" onClick={addSubcategory}>
                    Add Subcategory
                  </button>
                </div>
              )}
            </section>
          )}

          {/* PRODUCT TYPES */}

          {selectedSubcategory && (
            <section className="product-categories">
              <div className="section-heading">
                <div>
                  <h2>{selectedSubcategory.name} Product Types</h2>
                  <p>Select a product type or create a new one.</p>
                </div>
              </div>

              <div className="category-grid">
                {productTypes.map((productType) => (
                  <div
                    key={productType.id}
                    className="category-item"
                  >
                    <button
                      type="button"
                      className={`category-card ${
                        selectedType?.id === productType.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        handleProductTypeSelect(productType)
                      }
                    >
                      <h3>{productType.name}</h3>
                    </button>

                    <button
                      type="button"
                      className="delete-category-button"
                      onClick={() =>
                        deleteProductType(productType)
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="category-card"
                  onClick={() =>
                    setShowNewProductType(!showNewProductType)
                  }
                >
                  <h3>+ Add New Product Type</h3>
                </button>
              </div>

              {productTypes.length === 0 && !showNewProductType && (
                <p>No product types yet. Add one to continue.</p>
              )}

              {showNewProductType && (
                <div className="category-form">
                  <input
                    type="text"
                    placeholder={`New ${selectedSubcategory.name} product type`}
                    value={newProductTypeName}
                    onChange={(e) =>
                      setNewProductTypeName(e.target.value)
                    }
                  />

                  <button type="button" onClick={addProductType}>
                    Add Product Type
                  </button>
                </div>
              )}
            </section>
          )}

          {/* SELECTED PRODUCT TYPE */}

          {selectedType && (
            <section className="product-actions">
              <div className="section-heading">
                <div>
                  <h2>{selectedType.name}</h2>

                  <p>
                    {selectedCategory?.name} →{" "}
                    {selectedSubcategory?.name} →{" "}
                    {selectedType.name}
                  </p>
                </div>
              </div>

              <p>
                Products registered under this product type will appear
                here once the product registration form is connected.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default FoodProductRegistration;
