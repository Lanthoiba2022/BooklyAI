"use client";
import { Button } from "@/components/ui/button";
import { Send, Mic, Paperclip } from "lucide-react";
import * as React from "react";

// Custom hook for auto-resizing textarea
function useAutoResizeTextarea() {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Get the scrollHeight which represents the full content height
      const scrollHeight = textarea.scrollHeight;
      // Set the height to scrollHeight to show all content
      textarea.style.height = `${scrollHeight}px`;
    }
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export function CenterChat() {
  const [value, setValue] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea();

  const handleValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Adjust height after value changes
    setTimeout(adjustHeight, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Adjust height on keydown as well
    setTimeout(adjustHeight, 0);
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    // Also adjust height on input event
    setTimeout(adjustHeight, 0);
  };

  // Adjust height when value changes
  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);
  return (
    <div className="h-full grid grid-rows-[1fr_auto]">
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="text-sm text-zinc-500">No messages yet. Ask something about your textbook.</div>
      </div>
      <div className="border-t p-3">
        <form
          className="flex items-end justify-center"
          onSubmit={(e) => {
            e.preventDefault();
            setValue("");
            // Reset textarea height after clearing value
            setTimeout(adjustHeight, 0);
          }}
        >
          <div className="w-full max-w-4xl">
            <div className="relative rounded-xl border bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleValueChange}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder="Ask me anything or upload a PDF file..."
                className="w-full resize-none outline-none text-sm placeholder:text-zinc-400 bg-transparent py-2 pr-24 min-h-[20px] max-h-[300px] overflow-y-auto leading-relaxed"
                style={{ height: 'auto' }}
              />
              
              {/* Fixed Icons at Bottom Right */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Attach"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-8 w-8 p-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  aria-label="Voice"
                  className="h-8 w-8 p-0"
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button 
                  type="submit" 
                  aria-label="Send" 
                  disabled={uploading} 
                  className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]"
                >
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


