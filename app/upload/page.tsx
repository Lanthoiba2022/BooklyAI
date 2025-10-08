"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePdfStore } from "@/store/pdf";
import { useUiStore } from "@/store/ui";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function UploadPage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const { setCurrent } = usePdfStore();
  const { setRightPanelOpen } = useUiStore();

  const getAccessToken = React.useCallback(async (): Promise<string | null> => {
    if (!supabaseBrowser) return null;
    const { data: sess } = await supabaseBrowser.auth.getSession();
    let token = sess.session?.access_token ?? null;
    if (!token) {
      try { const { data } = await supabaseBrowser.auth.refreshSession(); token = data.session?.access_token ?? null; } catch {}
    }
    return token;
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    let token = await getAccessToken();
    if (!token) {
      setUploading(false);
      setMessage("Authentication required");
      return;
    }
    let res = await fetch("/api/pdf", { method: "POST", body: form, headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include' });
    if (res.status === 401) {
      try { await supabaseBrowser?.auth.refreshSession(); } catch {}
      token = await getAccessToken();
      if (!token) { setUploading(false); setMessage("Authentication required"); return; }
      res = await fetch("/api/pdf", { method: "POST", body: form, headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include' });
    }
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setMessage(data?.error ?? "Upload failed");
      return;
    }
    setMessage("Uploaded and queued for processing.");

    // Poll processing status if we have a pdfId
    if (data.pdfId) {
      try {
        const poll = async () => {
          for (let i = 0; i < 30; i++) { // up to ~60s
            const res = await fetch(`/api/pdf/status?pdfId=${data.pdfId}`, { credentials: 'include' });
            if (res.ok) {
              const s = await res.json();
              if (s.status === 'ready') return s;
            }
            await new Promise(r => setTimeout(r, 2000));
          }
          return null;
        };
        const status = await poll();
        if (status?.status === 'ready') {
          setMessage("Processing complete. PDF is ready.");
        } else {
          setMessage("Still processing. It will appear shortly.");
        }
      } catch {}
    }
    
    // If upload was successful and we have a path, set it as current PDF
    if (data.path && supabaseBrowser) {
      // Add a small delay to ensure file is fully processed
      setTimeout(async () => {
        try {
          // Instead of creating signed URL immediately, fetch the files list
          // to get the properly formatted URL (same as FilesPanel approach)
          const { data: { session } } = await supabaseBrowser.auth.getSession();
          let token = session?.access_token;
          if (!token) {
            try { await supabaseBrowser.auth.refreshSession(); } catch {}
            const { data: s2 } = await supabaseBrowser.auth.getSession();
            token = s2.session?.access_token;
          }
        
        if (token) {
          const filesRes = await fetch("/api/pdf/list", {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
          
          if (filesRes.ok) {
            const filesData = await filesRes.json();
            const uploadedFile = filesData.files?.find((f: any) => f.path === data.path);
            
            if (uploadedFile?.url) {
              console.log("Setting PDF as current from upload page files list:", file.name, uploadedFile.url);
              setCurrent({
                id: null,
                publicId: null,
                name: file.name,
                url: uploadedFile.url,
                currentPage: 1,
                totalPages: null
              });
              console.log("PDF set as current from upload page, right panel should show automatically");
            } else {
              console.log("No URL found for uploaded file in files list:", uploadedFile);
            }
          } else {
            console.error("Failed to fetch files list:", filesRes.statusText);
          }
        }
      } catch (error) {
        console.error("Error fetching files list:", error);
      }
    }, 500); // 500ms delay to ensure file is processed
    }
    
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