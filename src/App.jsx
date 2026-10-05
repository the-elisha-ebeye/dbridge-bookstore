import { Route, Routes } from "react-router-dom";
import StoreLayout from "./components/StoreLayout.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProductsProvider } from "./context/ProductsContext.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { AuthCallbackPage, OrderDetailPage, OrdersPage } from "./pages/AccountPages.jsx";
import BookDetailPage from "./pages/BookDetailPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RecommendPage from "./pages/RecommendPage.jsx";
import ShopPage from "./pages/ShopPage.jsx";

export default function App() {
  return (
    <div className="font-sans antialiased">
      <AuthProvider>
        <ProductsProvider>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="shop/:id" element={<BookDetailPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="recommend" element={<RecommendPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="auth/callback" element={<AuthCallbackPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="admin" element={<AdminPage />} />
          </Routes>
        </ProductsProvider>
      </AuthProvider>
    </div>
  );
}
