import { createContext, useContext, useEffect, useState } from "react";
import { getProducts } from "../services/products.js";

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [source, setSource] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refreshProducts() {
    setLoading(true);
    setError("");
    try {
      const result = await getProducts();
      setProducts(result.products);
      setSource(result.source);
    } catch (loadError) {
      console.error("Could not load the product catalog:", loadError.message);
      setError("We couldn’t load the books right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getProducts()
      .then((result) => {
        if (!active) return;
        setProducts(result.products);
        setSource(result.source);
      })
      .catch((loadError) => {
        console.error("Could not load the product catalog:", loadError.message);
        if (active) setError("We couldn’t load the books right now. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <ProductsContext.Provider value={{ products, source, loading, error, refreshProducts }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) throw new Error("useProducts must be used inside ProductsProvider");
  return context;
}
