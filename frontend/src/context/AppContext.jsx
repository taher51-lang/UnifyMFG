import React, { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
      const [prodRes, custRes, formRes] = await Promise.all([
        client.get("/products"),
        client.get("/customers"),
        client.get("/formulations")
      ]);
      setProducts(prodRes.data || []);
      setCustomers(custRes.data || []);
      setFormulations(formRes.data || []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch global data", err);
      setError("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  return (
    <AppContext.Provider value={{ products, customers, formulations, loading, error, refreshGlobalData: fetchGlobalData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
