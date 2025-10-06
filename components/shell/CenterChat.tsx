"use client";
import { Button } from "@/components/ui/button";
import { Send, Mic, Paperclip } from "lucide-react";
import * as React from "react";

export function CenterChat() {
  const [value, setValue] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div className="h-full grid grid-rows-[1fr_auto]">
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="text-sm text-zinc-500">No messages yet. Ask something about your textbook.</div>
      </div>
      <div className="border-t p-3">
        <form
          className="flex items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setValue("");
          }}
        >
          <div className="flex-1">
            <div className="rounded-xl border bg-white px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 flex items-center gap-2">
              <textarea
                rows={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ask me anything or upload a PDF file..."
                className="flex-1 resize-none outline-none text-sm placeholder:text-zinc-400 bg-transparent py-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    const res = await fetch("/api/pdf", { method: "POST", body: form });
                    if (!res.ok) {
                      console.error("Upload failed");
                    }
                  } finally {
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Attach"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Voice">
                  <Mic className="h-4 w-4" />
                </Button>
                <Button type="submit" aria-label="Send" disabled={uploading} className="bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


