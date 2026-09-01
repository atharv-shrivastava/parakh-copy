
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";

import Shops from "./pages/Shops";
import ShopDetails from "./pages/ShopDetails";
import ShopProducts from "./pages/ShopProducts";

import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";

import Food from "./pages/Food";
import ReadyToEat from "./pages/ReadyToEat";
import ReadyToCook from "./pages/ReadyToCook";
import Staples from "./pages/Staples";
import CookingEssentials from "./pages/CookingEssentials";
import Beverages from "./pages/Beverages";
import Dairy from "./pages/Dairy";
import OtherFood from "./pages/OtherFood";

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

          <Route
            path="/products/food/ready-to-eat"
            element={<ReadyToEat />}
          />

          <Route
            path="/products/food/ready-to-cook"
            element={<ReadyToCook />}
          />

          <Route
            path="/products/food/staples"
            element={<Staples />}
          />

          <Route
            path="/products/food/cooking-essentials"
            element={<CookingEssentials />}
          />

          <Route
            path="/products/food/beverages"
            element={<Beverages />}
          />

          <Route
            path="/products/food/dairy"
            element={<Dairy />}
          />

          <Route
            path="/products/food/other"
            element={<OtherFood />}
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

