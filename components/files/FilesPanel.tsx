"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePdfStore } from "@/store/pdf";
import { useUiStore } from "@/store/ui";
import { X } from "lucide-react";

type FileItem = { name: string; id: string; path: string; url?: string };

export function FilesPanel() {
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const { setCurrent } = usePdfStore();
  const { setRightPanelOpen, setCenterView } = useUiStore();
  const [isFetching, setIsFetching] = React.useState(true);

  const refresh = async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/api/pdf/list");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } finally {
      setIsFetching(false);
    }
  };

  React.useEffect(() => {
    refresh();
  }, []);

  const onUpload = async (file?: File) => {
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

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-lg font-semibold">Your PDFs</h1>
        <Button variant="ghost" size="icon" onClick={() => setCenterView("chat")} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4">
        <div
          className={cn(
            "rounded-xl border border-dashed bg-zinc-50 transition-colors p-8 flex items-center justify-between cursor-pointer",
            dragActive && "bg-zinc-100"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            onUpload(file);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-sm text-zinc-600">Drag & drop a PDF here or</div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0] ?? undefined)}
            />
            <Button disabled={uploading}>{uploading ? "Uploading..." : "Upload file"}</Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {isFetching ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border p-3 bg-white animate-pulse h-16" />
            ))
          ) : files.map((f) => (
            <button
              key={f.id}
              className="rounded-lg border p-3 bg-white flex items-center justify-between hover:bg-zinc-50 text-left"
              onClick={() => {
                setCurrent({ id: null, publicId: null, name: f.name, url: f.url ?? null, currentPage: 1, totalPages: null });
                setRightPanelOpen(true);
              }}
            >
              <div className="text-sm truncate" title={f.name}>{f.name}</div>
              <span className="text-xs text-primary">Open</span>
            </button>
          ))}
          {!isFetching && files.length === 0 ? (
            <div className="text-sm text-zinc-500">No PDFs yet. Upload one to get started.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


