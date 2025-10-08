"use client";
import { Button } from "@/components/ui/button";
import { Send, Mic, Paperclip } from "lucide-react";
import * as React from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { usePdfStore } from "@/store/pdf";
import { useUiStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { YouTubeRecommendations, YouTubeRecommendationsCompact } from "@/components/youtube/YouTubeRecommendations";
import { YouTubeRecommendationsLoader as CompactLoader } from "@/components/youtube/YouTubeRecommendationsLoader";

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
  const [youtubeVideos, setYoutubeVideos] = React.useState<any[]>([]);
  const [youtubeTopics, setYoutubeTopics] = React.useState<string[]>([]);
  const [loadingYoutube, setLoadingYoutube] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const { setCurrent, current } = usePdfStore();
  const { setRightPanelOpen, rightPanelOpen } = useUiStore();
  const { user } = useAuthStore();
  const { chatId, setChatId, messages, addMessage, startAssistantMessage, appendAssistantDelta, setAssistantCitations } = useChatStore();

  // Fetch YouTube recommendations
  const fetchYouTubeRecommendations = async (pdfId?: number, currentQuestion?: string) => {
    if (!isAuthenticated) return;
    
    setLoadingYoutube(true);
    try {
      const params = new URLSearchParams();
      if (pdfId) params.append('pdfId', pdfId.toString());
      if (currentQuestion) params.append('currentQuestion', currentQuestion);
      
      const res = await fetch(`/api/youtube?${params}`, {
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        setYoutubeVideos(data.recommendations || []);
        setYoutubeTopics(data.topics || []);
      }
    } catch (error) {
      console.error('Error fetching YouTube recommendations:', error);
    } finally {
      setLoadingYoutube(false);
    }
  };

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

  // React immediately to global auth changes (e.g., after OAuth redirect)
  React.useEffect(() => {
    setIsAuthenticated(!!user);
    setIsCheckingAuth(false);
  }, [user]);

  // Fetch YouTube recommendations when PDF is selected
  React.useEffect(() => {
    if (current?.id && isAuthenticated) {
      fetchYouTubeRecommendations(current.id);
    }
  }, [current?.id, isAuthenticated]);

  // Check authentication status and listen for changes
  React.useEffect(() => {
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
      });
      
      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }
    
    return () => clearTimeout(timeout);
  }, []);

  // Adjust height when value changes
  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);
  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="h-full grid grid-rows-[1fr_auto]">
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="text-center py-8">
            <div className="text-sm text-zinc-500">Checking authentication...</div>
          </div>
        </div>
        <div className="border-t p-3">
          <div className="flex items-end justify-center">
            <div className="w-full max-w-4xl">
              <div className="relative rounded-xl border bg-zinc-100 px-3 py-2 shadow-sm">
                <div className="text-sm text-zinc-400 py-2 pr-24">Please wait...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-rows-[1fr_auto]">
      <div className="p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-sm text-zinc-500">No messages yet. Ask something about your textbook.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-1">{m.role}</div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
              {m.role === "assistant" && Array.isArray(m.citations) && m.citations.length > 0 ? (
                <div className="mt-2 border-t pt-2 space-y-1">
                  {m.citations.map((c, i) => (
                    <button key={i} className="text-xs text-primary underline" onClick={() => {
                      // jump uses 0-based index
                      try {
                        const { jumpToPage } = usePdfStore.getState();
                        if (typeof jumpToPage === 'function') {
                          // c.page is 1-based from backend; ensure safe
                          const p0 = Math.max(0, (c.page ?? 1) - 1);
                          jumpToPage(p0);
                          setRightPanelOpen(true);
                        }
                      } catch {}
                    }}>
                      (p. {c.page}) {c.text ? `— ${c.text.slice(0, 80)}…` : ''}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
        
        {/* YouTube Recommendations */}
        {youtubeVideos.length > 0 && (
          <div className="mt-4">
            <YouTubeRecommendationsCompact 
              videos={youtubeVideos}
              onVideoClick={(videoId) => {
                window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
              }}
            />
          </div>
        )}
        
        {/* YouTube Loading State */}
        {loadingYoutube && (
          <div className="mt-4">
            <CompactLoader />
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <form
          className="flex items-end justify-center"
          onSubmit={(e) => {
            e.preventDefault();
            const content = value.trim();
            if (!content) return;
            // Allow chatting without a PDF; only pass pdfId if present
            // Add user message locally
            addMessage({ id: `${Date.now()}-user`, role: "user", content, createdAt: Date.now() });
            setValue("");
            // Reset textarea height after clearing value
            setTimeout(adjustHeight, 0);

            // Start streaming from API
            (async () => {
              try {
                startAssistantMessage();
                const res = await fetch('/api/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ chatId, pdfId: current?.id ?? undefined, message: content }),
                });
                if (!res.ok || !res.body) {
                  appendAssistantDelta("(Failed to start chat)");
                  return;
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split('\n').filter(Boolean);
                  for (const line of lines) {
                    try {
                      const msg = JSON.parse(line);
                      if (msg.type === 'citations') {
                        setAssistantCitations(msg.data || []);
                      } else if (msg.type === 'delta') {
                        appendAssistantDelta(msg.data || '');
                      } else if (msg.type === 'done') {
                        // Fetch YouTube recommendations after assistant is done
                        fetchYouTubeRecommendations(current?.id ?? undefined, content);
                      } else if (msg.type === 'error') {
                        appendAssistantDelta(`\n[Error] ${msg.data}`);
                      } else if (msg.type === 'chat') {
                        if (msg.data?.chatId) setChatId(msg.data.chatId);
                      }
                    } catch {}
                  }
                }
              } catch (err) {
                appendAssistantDelta("\n[Error] Chat failed.");
              }
            })();
          }}
        >
          <div className="w-full max-w-4xl">
            <div className={`relative rounded-xl border px-3 py-2 shadow-sm bg-white focus-within:ring-2 focus-within:ring-zinc-200`}>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleValueChange}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder={"Ask me anything or upload a PDF file..."}
                className="w-full resize-none outline-none text-sm placeholder:text-zinc-400 bg-transparent py-2 pr-24 min-h-[20px] max-h-[300px] overflow-y-auto leading-relaxed disabled:cursor-not-allowed"
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
                    if (!file || !supabaseBrowser) return;
                    setUploading(true);
                    try {
                      const form = new FormData();
                      form.append("file", file);
                      let res = await fetch("/api/pdf", {
                        method: "POST",
                        body: form,
                        credentials: 'include',
                      });
                      if (res.status === 401) {
                        await supabaseBrowser.auth.refreshSession();
                        res = await fetch("/api/pdf", {
                          method: "POST",
                          body: form,
                          credentials: 'include',
                        });
                      }

                      if (!res.ok) {
                        console.error("Upload failed:", res.statusText);
                      } else {
                        // Get the uploaded file URL and set it as current PDF
                        const uploadData = await res.json();
                        console.log("Upload response:", uploadData);
                        if (uploadData.path) {
                          // Instead of creating signed URL immediately, fetch the files list
                          // to get the properly formatted URL (same as FilesPanel approach)
                          // Add a small delay to ensure file is fully processed
                          setTimeout(async () => {
                            try {
                              if (!supabaseBrowser) return;
                              let filesRes = await fetch("/api/pdf/list", {
                                credentials: 'include',
                              });
                              if (filesRes.status === 401) {
                                await supabaseBrowser.auth.refreshSession();
                                filesRes = await fetch("/api/pdf/list", { credentials: 'include' });
                              }
                              if (filesRes.ok) {
                                const filesData = await filesRes.json();
                                const uploadedFile = filesData.files?.find((f: any) => f.path === uploadData.path);
                                if (uploadedFile?.url) {
                                  console.log("Setting PDF as current from files list:", file.name, uploadedFile.url);
                                  setCurrent({
                                    id: uploadedFile?.pdfId ?? null,
                                    publicId: null,
                                    name: file.name,
                                    url: uploadedFile.url,
                                    currentPage: 1,
                                    totalPages: uploadedFile?.pageCount ?? null
                                  });
                                  setRightPanelOpen(true);
                                  console.log("PDF set as current and right panel opened");
                                } else {
                                  console.log("No URL found for uploaded file in files list:", uploadedFile);
                                }
                              } else {
                                console.error("Failed to fetch files list:", filesRes.statusText);
                              }
                            } catch (error) {
                              console.error("Error fetching files list:", error);
                            }
                          }, 500); // 500ms delay to ensure file is processed
                        }
                      }
                    } catch (error) {
                      console.error("Error uploading file:", error);
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


