import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function CategoryPage() {
  const { categorySlug } = useParams();

  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategory() {
      try {
        const response = await fetch(
          `http://localhost:5000/api/categories/${categorySlug}`
        );

        if (!response.ok) {
          throw new Error("Category not found");
        }

        const data = await response.json();
        setCategory(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCategory();
  }, [categorySlug]);

  if (loading) {
    return <p>Loading category...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
      <Link to="/products">← Back to Products</Link>

      <h1>{category.name}</h1>

      {category.children?.length > 0 ? (
        <div>
          {category.children.map((child) => (
            <Link
              key={child.id}
              to={`/products/${child.slug}`}
            >
              <div>
                <h2>{child.name}</h2>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p>No subcategories yet.</p>
      )}
    </div>
  );
}

export default CategoryPage;