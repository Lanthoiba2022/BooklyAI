"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/pdf", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setMessage(data?.error ?? "Upload failed");
      return;
    }
    setMessage("Uploaded and queued for processing.");
    setFile(null);
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Upload a PDF</h1>
      <p className="text-sm text-zinc-500">Max size 50MB. Supported: PDF.</p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border p-2"
        />
        <Button type="submit" disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </form>
      {message ? <div className="text-sm text-zinc-600">{message}</div> : null}
    </div>
  );
}


