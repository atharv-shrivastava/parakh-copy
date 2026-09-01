
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";

import Shops from "./pages/Shops";
import ShopDetails from "./pages/ShopDetails";
import ShopProducts from "./pages/ShopProducts";

import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import CategoryPage from "./pages/CategoryPage";
import FoodProductRegistration from "./pages/FoodProductRegistration";

import Food from "./pages/Food";

import History from "./pages/History";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>

          {/* Dashboard */}
          <Route path="/" element={<Dashboard />} />

          {/* Scan */}
          <Route path="/scan" element={<Scan />} />

          {/* Shops */}
          <Route path="/shops" element={<Shops />} />

          <Route
            path="/shops/:shopId"
            element={<ShopDetails />}
          />

          <Route
            path="/shops/:shopId/products"
            element={<ShopProducts />}
          />

          {/* Products */}
          <Route path="/products" element={<Products />} />

          {/* Food */}
          <Route path="/products/food" element={<Food />} />

          {/* Register New Food Product */}
          <Route
            path="/products/register/food"
            element={<FoodProductRegistration />}
          />

          {/* Food Subcategories / Product Types */}
          <Route
            path="/products/food/:categorySlug"
            element={<CategoryPage />}
          />

          {/* Individual Products */}
          <Route
            path="/products/item/:id"
            element={<ProductDetails />}
          />

          {/* Other Pages */}
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
