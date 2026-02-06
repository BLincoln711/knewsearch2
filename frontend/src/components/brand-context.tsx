"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiFetch, BrandsResponse } from "@/lib/api";
import { useAuth } from "./auth-context";

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
  const { user, getIdToken } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getIdToken()
      .then((token) => apiFetch<BrandsResponse>("/brands", undefined, token ?? undefined))
      .then((res) => {
        setBrands(res.brands);
        if (res.brands.length > 0) {
          setSelectedBrand(res.brands[0]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, getIdToken]);

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
