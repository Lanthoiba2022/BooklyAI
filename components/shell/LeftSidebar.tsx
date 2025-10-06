"use client";
import { Button } from "@/components/ui/button";
import { Plus, Files, BarChart3, History } from "lucide-react";
 import { AuthStatus } from "@/components/auth/AuthStatus";
 import { useUiStore } from "@/store/ui";

export function LeftSidebar() {
  const { setCenterView } = useUiStore();
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <Button className="w-full">
          <Plus className="h-4 w-4 mr-2" /> New Chat
        </Button>
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500 px-1">Uploaded Files</div>
          <Button variant="ghost" className="w-full justify-start" onClick={() => setCenterView("files")}>
            <Files className="h-4 w-4 mr-2" /> View PDFs
          </Button>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500 px-1">Progress</div>
          <Button variant="ghost" className="w-full justify-start">
            <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
          </Button>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500 px-1">Chat History</div>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start">
              <History className="h-4 w-4 mr-2" /> Recent chat
            </Button>
          </div>
        </div>
      </div>
      <div className="p-3 border-t">
        <AuthStatus />
      </div>
    </div>
  );
}


