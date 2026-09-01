

import { Link, useParams } from "react-router-dom";

function ProductDetails() {
  const { id } = useParams();

  return (
    <div>
      <Link to="/products">← Back to Products</Link>

      <p>PRODUCT DETAILS</p>

      <h1>Product {id}</h1>

      <p>This is the individual product details page.</p>
    </div>
  );
}

export default ProductDetails;

