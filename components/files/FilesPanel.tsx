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
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      return;
    }
    
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      setIsAuthenticated(!!session?.user);
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const refresh = async () => {
    if (!isAuthenticated || !supabaseBrowser) return [];
    
    setIsFetching(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error("No authentication token available");
        return [];
      }
      
      const res = await fetch("/api/pdf/list", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (res.status === 401) {
        // Authentication failed, user might need to log in again
        setIsAuthenticated(false);
        return [];
      }
      
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
        return data.files ?? [];
      } else {
        console.error("Failed to fetch PDFs:", res.statusText);
        return [];
      }
    } catch (error) {
      console.error("Error fetching PDFs:", error);
      return [];
    } finally {
      setIsFetching(false);
    }
  };

  React.useEffect(() => {
    // Sync with global auth store for immediate UI updates after OAuth
    setIsAuthenticated(!!user);
    setIsCheckingAuth(false);
    if (user) {
      // Immediately load files once user appears
      refresh();
    }
  }, [user]);

  React.useEffect(() => {
    checkAuth();
    
    // Fallback timeout to prevent infinite checking
    const timeout = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 5000); // 5 second timeout
    
    // Listen for authentication state changes
    if (supabaseBrowser) {
      const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
        setIsAuthenticated(!!session?.user);
        setIsCheckingAuth(false);
        clearTimeout(timeout); // Clear timeout when auth state changes
        
        if (session?.user) {
          refresh();
        } else {
          setFiles([]);
        }
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
    } else {
      setFiles([]);
    }
  }, [isAuthenticated]);

  const onUpload = async (file?: File) => {
    if (!file || !isAuthenticated || !supabaseBrowser) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error("No authentication token available");
        return;
      }
      
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pdf", { 
        method: "POST", 
        body: form,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (res.status === 401) {
        // Authentication failed, user might need to log in again
        setIsAuthenticated(false);
        return;
      }
      
      if (res.ok) {
        const uploadData = await res.json();
        // Refresh the files list and get the updated files
        const updatedFiles = await refresh();
        
        // Find the uploaded file in the refreshed files list and set it as current
        if (uploadData.path && updatedFiles.length > 0) {
          const uploadedFile = updatedFiles.find((f: any) => f.path === uploadData.path);
          
          if (uploadedFile?.url) {
            // Set the uploaded PDF as current and open right panel
            console.log("Setting PDF as current from FilesPanel:", file.name, uploadedFile.url);
            setCurrent({
              id: null,
              publicId: null,
              name: file.name,
              url: uploadedFile.url,
              currentPage: 1,
              totalPages: null
            });
            console.log("PDF set as current from FilesPanel, right panel should show automatically");
          } else {
            console.log("No URL found for uploaded file:", uploadedFile);
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
    if (!isAuthenticated || !supabaseBrowser) return;
    const confirmDelete = window.confirm("Delete this PDF permanently?");
    if (!confirmDelete) return;
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      const res = await fetch("/api/pdf", {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ path })
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
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


