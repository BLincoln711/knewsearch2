"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiFetch, BrandsResponse } from "@/lib/api";

interface BrandContextValue {
  brands: string[];
  selectedBrand: string;
  setSelectedBrand: (b: string) => void;
  loading: boolean;
  error: string | null;
}

const BrandContext = createContext<BrandContextValue>({
  brands: [],
  selectedBrand: "",
  setSelectedBrand: () => {},
  loading: true,
  error: null,
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BrandsResponse>("/brands")
      .then((res) => {
        setBrands(res.brands);
        if (res.brands.length > 0) {
          setSelectedBrand(res.brands[0]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BrandContext.Provider
      value={{ brands, selectedBrand, setSelectedBrand, loading, error }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
