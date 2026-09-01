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
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/shops" element={<Shops />} />
          <Route path="/shops/:shopId" element={<ShopDetails />} />
          <Route path="/shops/:shopId/products" element={<ShopProducts />} />

          <Route path="/products" element={<Products />} />
          <Route path="/products/food" element={<Food />} />

          {/* This page creates a Level 1 category only. Products are created from Scan. */}
          <Route path="/products/register" element={<FoodProductRegistration />} />

          <Route path="/products/category/:categoryId" element={<CategoryPage />} />
          <Route path="/products/item/:id" element={<ProductDetails />} />

          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
