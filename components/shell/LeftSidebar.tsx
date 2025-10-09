"use client";
import { Button } from "@/components/ui/button";
import { Plus, Files, BarChart3, History, HelpCircle } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { useUiStore } from "@/store/ui";
import { supabaseBrowser } from "@/lib/supabaseClient";
import * as React from "react";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { useQuizStore } from "@/store/quiz";

type ChatItem = {
  id: number;
  createdAt: string;
  pdfName: string | null;
  lastMessage: string | null;
};

export function LeftSidebar() {
  const { setCenterView } = useUiStore();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [chats, setChats] = React.useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = React.useState(false);
  const { user } = useAuthStore();
  const { setChatId, reset } = useChatStore();
  const { resetQuiz } = useQuizStore();

  // React immediately to global auth changes
  React.useEffect(() => {
    setIsAuthenticated(!!user);
    setIsCheckingAuth(false);
  }, [user]);

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

  // Load chat history when authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      setChats([]);
      return;
    }

    const loadChats = async () => {
      setLoadingChats(true);
      try {
        const res = await fetch('/api/chats', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setChats(data.chats || []);
        }
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoadingChats(false);
      }
    };

    loadChats();
  }, [isAuthenticated]);

  const handleNewChat = () => {
    reset();
    setCenterView("chat");
  };

  const handleChatClick = async (chatId: number) => {
    try {
      const res = await fetch(`/api/messages?chatId=${chatId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setChatId(chatId);
        // TODO: Load messages into chat store
        setCenterView("chat");
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  const handleGenerateQuiz = () => {
    resetQuiz();
    setCenterView("quiz");
  };

  const handleDashboardClick = () => {
    setCenterView("progress");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <Button className="w-full" onClick={handleNewChat}>
          <Plus className="h-4 w-4 mr-2" /> New Chat
        </Button>
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500 px-1">Uploaded Files</div>
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={() => isAuthenticated && setCenterView("files")}
            disabled={!isAuthenticated}
          >
            <Files className="h-4 w-4 mr-2" /> View PDFs
          </Button>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500 px-1">Progress</div>
          <Button 
            variant="ghost" 
            className="w-full justify-start"
            onClick={handleDashboardClick}
            disabled={!isAuthenticated}
          >
            <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start"
            onClick={handleGenerateQuiz}
            disabled={!isAuthenticated}
          >
            <HelpCircle className="h-4 w-4 mr-2" /> Generate Quiz
          </Button>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500 px-1">Chat History</div>
          <div className="space-y-1">
            {loadingChats ? (
              <div className="text-xs text-zinc-400 px-1">Loading...</div>
            ) : chats.length === 0 ? (
              <div className="text-xs text-zinc-400 px-1">No chats yet</div>
            ) : (
              chats.map((chat) => (
                <Button 
                  key={chat.id}
                  variant="ghost" 
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => handleChatClick(chat.id)}
                >
                  <History className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">
                      {chat.pdfName ? `Chat about ${chat.pdfName}` : 'General Chat'}
                    </div>
                    {chat.lastMessage && (
                      <div className="text-xs text-zinc-500 truncate">
                        {chat.lastMessage}
                      </div>
                    )}
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="p-3 border-t">
        <AuthStatus />
      </div>
    </div>
  );
}


