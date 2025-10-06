"use client";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, PanelRightOpen, PanelRightClose } from "lucide-react";
import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function MainLayout({
  left,
  center,
  right,
}: {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}) {
  const { sidebarOpen, rightPanelOpen, setSidebarOpen, setRightPanelOpen } = useUiStore();

  return (
    <div className="h-screen w-full grid grid-rows-[56px_1fr] overflow-hidden">
      <header className="h-14 px-3 flex items-center justify-between border-b bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold tracking-tight">Bookly</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setRightPanelOpen(!rightPanelOpen)}>
            {rightPanelOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>
      <div className={cn("grid gap-0", "grid-cols-1 md:grid-cols-[220px_1fr]", "overflow-hidden")}> 
        {/* Left Sidebar */}
        <aside
          className={cn(
            "border-r bg-zinc-50 md:block", // hidden on mobile unless open
            sidebarOpen ? "block" : "hidden md:block",
          )}
        >
          <div className="h-[calc(100vh-56px)] overflow-y-auto">{left}</div>
        </aside>
        {/* Center + Right (Resizable) */}
        <div className="h-[calc(100vh-56px)] overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={rightPanelOpen ? 60 : 100} minSize={30}>
              <main className="h-full overflow-y-auto">{center}</main>
            </ResizablePanel>
            {rightPanelOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={40} minSize={20} maxSize={60}>
                  <section className={cn("h-full border-l bg-white")}> 
                    <div className="h-full overflow-y-auto">{right}</div>
                  </section>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}


