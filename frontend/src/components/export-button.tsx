"use client";

import { useState } from "react";
import { useAuth } from "./auth-context";
import { Download } from "lucide-react";

interface ExportButtonProps {
  path: string;
  params: Record<string, string>;
  filename: string;
}

export function ExportButton({ path, params, filename }: ExportButtonProps) {
  const { getIdToken } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = await getIdToken();
      const url = new URL(`/proxy${path}`, window.location.origin);
      Object.entries({ ...params, format: "csv" }).forEach(([k, v]) =>
        url.searchParams.set(k, v)
      );

      const headers: Record<string, string> = { Accept: "text/csv" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-medium text-charcoal-muted hover:text-charcoal bg-surface-0 hover:bg-surface-100 border border-surface-200 rounded-lg shadow-subtle transition-colors disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {exporting ? "Exporting..." : "Export CSV"}
    </button>
  );
}
