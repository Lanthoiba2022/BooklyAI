"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type FileItem = { name: string; id: string; path: string; url?: string };

export default function FilesPage() {
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/pdf/list");
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files ?? []);
    }
  };

  React.useEffect(() => {
    refresh();
  }, []);

  const onDrop = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pdf", { method: "POST", body: form });
      if (res.ok) await refresh();
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (path: string) => {
    const res = await fetch("/api/pdf", { method: "DELETE", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
    if (res.ok) await refresh();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">Your PDFs</h1>
      </div>
      <div className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <div
          className="col-span-1 md:col-span-2 xl:col-span-3 rounded-xl border border-dashed bg-zinc-50 hover:bg-zinc-100 transition-colors p-6 flex items-center justify-between"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            onDrop(file);
          }}
        >
          <div className="text-sm text-zinc-600">Drag & drop a PDF here or click to upload</div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onDrop(e.target.files?.[0] ?? undefined)}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </div>

        {files.map((f) => (
          <div key={f.id} className="rounded-lg border p-3 bg-white flex items-center min-w-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" title={f.name}>{f.name}</div>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-primary">Open</a>
              ) : null}
            </div>
            <div className="shrink-0 pl-2">
              <button className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-zinc-100" onClick={() => onDelete(f.path)} title="Delete">
                <Trash2 className="h-4 w-4 text-zinc-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


