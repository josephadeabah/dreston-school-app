"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { downloadExport } from "@/lib/exportDownload";

export default function ExportButtons({
  basePath,
  filename,
}: {
  basePath: string; // e.g. "/exports/students?class_id=abc"
  filename: string; // fallback filename stem, no extension
}) {
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  async function handleExport(fmt: "pdf" | "docx") {
    setDownloading(fmt);
    const sep = basePath.includes("?") ? "&" : "?";
    try {
      await downloadExport(`${basePath}${sep}format=${fmt}`, `${filename}.${fmt}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download this export.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport("pdf")}
        disabled={downloading !== null}
        className="btn-secondary text-xs"
        title="Download as PDF"
      >
        {downloading === "pdf" ? "Preparing…" : "⬇ PDF"}
      </button>
      <button
        onClick={() => handleExport("docx")}
        disabled={downloading !== null}
        className="btn-secondary text-xs"
        title="Download as Word document"
      >
        {downloading === "docx" ? "Preparing…" : "⬇ Word"}
      </button>
    </div>
  );
}
