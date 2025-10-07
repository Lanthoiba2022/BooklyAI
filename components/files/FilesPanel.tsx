"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePdfStore } from "@/store/pdf";
import { useUiStore } from "@/store/ui";
import { X, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/auth";

type FileItem = { name: string; id: string; path: string; url?: string };

export function FilesPanel() {
  const { user } = useAuthStore();
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const { setCurrent } = usePdfStore();
  const { setRightPanelOpen, setCenterView } = useUiStore();
  const [isFetching, setIsFetching] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  const checkAuth = async () => {
    if (!supabaseBrowser) {
      setIsCheckingAuth(false);
      return;
    }
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const getValidToken = async (): Promise<string | null> => {
    if (!supabaseBrowser) return null;
    let { data: { session } } = await supabaseBrowser.auth.getSession();
    if (session?.access_token) return session.access_token;
    try {
      await supabaseBrowser.auth.refreshSession();
      ({ data: { session } } = await supabaseBrowser.auth.getSession());
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  const refresh = async () => {
    if (!supabaseBrowser) return [] as FileItem[];
    setIsFetching(true);
    try {
      let token = await getValidToken();
      if (!token) {
        console.warn("No authentication token available after refresh attempt");
        return [] as FileItem[];
      }
      let res = await fetch("/api/pdf/list", { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) {
        await supabaseBrowser.auth.refreshSession();
        token = (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
        if (!token) return [] as FileItem[];
        res = await fetch("/api/pdf/list", { headers: { 'Authorization': `Bearer ${token}` } });
      }
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
        return data.files ?? [];
      }
      console.error("Failed to fetch PDFs:", res.statusText);
      return [] as FileItem[];
    } catch (error) {
      console.error("Error fetching PDFs:", error);
      return [] as FileItem[];
    } finally {
      setIsFetching(false);
    }
  };

  React.useEffect(() => {
    setIsAuthenticated(!!user);
    setIsCheckingAuth(false);
    if (user) {
      refresh();
    }
  }, [user]);

  React.useEffect(() => {
    checkAuth();

    const timeout = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 5000);

    if (supabaseBrowser) {
      const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          setIsAuthenticated(true);
          refresh();
        }
        setIsCheckingAuth(false);
        clearTimeout(timeout);
      });
      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    return () => clearTimeout(timeout);
  }, []);

  React.useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
  }, [isAuthenticated]);

  const onUpload = async (file?: File) => {
    if (!file || !supabaseBrowser) return;
    setUploading(true);
    try {
      let token = await getValidToken();
      if (!token) return;

      const form = new FormData();
      form.append("file", file);
      let res = await fetch("/api/pdf", {
        method: "POST",
        body: form,
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) {
        await supabaseBrowser.auth.refreshSession();
        token = (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
        if (!token) return;
        const retry = await fetch("/api/pdf", {
          method: "POST",
          body: form,
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!retry.ok) return;
        const uploadData = await retry.json();
        const updatedFiles = await refresh();
        if (uploadData.path && updatedFiles.length > 0) {
          const uploadedFile = updatedFiles.find((f: any) => f.path === uploadData.path);
          if (uploadedFile?.url) {
            console.log("Setting PDF as current from FilesPanel:", file.name, uploadedFile.url);
            setCurrent({ id: null, publicId: null, name: file.name, url: uploadedFile.url, currentPage: 1, totalPages: null });
            setRightPanelOpen(true);
            console.log("PDF set as current from FilesPanel and right panel opened");
          }
        }
        return;
      }
      if (res.ok) {
        const uploadData = await res.json();
        const updatedFiles = await refresh();
        if (uploadData.path && updatedFiles.length > 0) {
          const uploadedFile = updatedFiles.find((f: any) => f.path === uploadData.path);
          if (uploadedFile?.url) {
            console.log("Setting PDF as current from FilesPanel:", file.name, uploadedFile.url);
            setCurrent({ id: null, publicId: null, name: file.name, url: uploadedFile.url, currentPage: 1, totalPages: null });
            setRightPanelOpen(true);
            console.log("PDF set as current from FilesPanel and right panel opened");
          }
        }
      } else {
        console.error("Upload failed:", res.statusText);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (path: string) => {
    if (!supabaseBrowser) return;
    const confirmDelete = window.confirm("Delete this PDF permanently?");
    if (!confirmDelete) return;
    try {
      let token = await getValidToken();
      if (!token) return;
      let res = await fetch("/api/pdf", {
        method: "DELETE",
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ path })
      });
      if (res.status === 401) {
        await supabaseBrowser.auth.refreshSession();
        token = (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
        if (!token) return;
        const retry = await fetch("/api/pdf", {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ path })
        });
        if (!retry.ok) return;
        await refresh();
        return;
      }
      if (res.ok) {
        await refresh();
      } else {
        console.error("Delete failed:", await res.text());
      }
    } catch (e) {
      console.error("Error deleting file:", e);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-lg font-semibold">Your PDFs</h1>
          <Button variant="ghost" size="icon" onClick={() => setCenterView("chat")} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 flex items-center justify-center">
          <div className="text-sm text-zinc-500">Checking authentication...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-lg font-semibold">Your PDFs</h1>
          <Button variant="ghost" size="icon" onClick={() => setCenterView("chat")} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 flex flex-col items-center justify-center space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <div className="text-lg font-medium text-zinc-700">Authentication Required</div>
            <div className="text-sm text-zinc-500">Please sign in to view and manage your PDFs</div>
          </div>
          <a href="/signin">
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

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
            "rounded-xl border border-dashed bg-zinc-50 transition-colors p-8 flex items-center justify-between",
            isAuthenticated ? "cursor-pointer" : "cursor-not-allowed opacity-50",
            dragActive && "bg-zinc-100"
          )}
          onDragOver={(e) => {
            if (!isAuthenticated) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            if (!isAuthenticated) return;
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            onUpload(file);
          }}
          onClick={() => isAuthenticated && inputRef.current?.click()}
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
            <Button disabled={uploading || !isAuthenticated}>{uploading ? "Uploading..." : "Upload file"}</Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {isFetching ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border p-3 bg-white animate-pulse h-16" />
            ))
          ) : files.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border p-3 bg-white flex items-center hover:bg-zinc-50 min-w-0"
            >
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => {
                  setCurrent({ id: null, publicId: null, name: f.name, url: f.url ?? null, currentPage: 1, totalPages: null });
                  setRightPanelOpen(true);
                }}
              >
                <div className="text-sm truncate" title={f.name}>{f.name}</div>
                <span className="text-xs text-primary">Open</span>
              </button>
              <div className="shrink-0 pl-2">
                <button
                  className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-zinc-100"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(f.path); }}
                >
                  <Trash2 className="h-4 w-4 text-zinc-600" />
                </button>
              </div>
            </div>
          ))}
          {!isFetching && files.length === 0 ? (
            <div className="text-sm text-zinc-500">No PDFs yet. Upload one to get started.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


