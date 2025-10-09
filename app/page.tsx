"use client";
import { MainLayout } from "@/components/layout/MainLayout";
import { LeftSidebar } from "@/components/shell/LeftSidebar";
import { CenterChat } from "@/components/shell/CenterChat";
import { RightPanel } from "@/components/shell/RightPanel";
import { FilesPanel } from "@/components/files/FilesPanel";
import { ProgressDashboard } from "@/components/progress/ProgressDashboard";
import { QuizModal } from "@/components/quiz/QuizModal";
import { useUiStore } from "@/store/ui";
import React from "react";
import { usePathname } from "next/navigation";

export default function Home() {
  const { centerView } = useUiStore();
  const pathname = usePathname();
  const center = React.useMemo(() => {
    // Route-driven center content; sidebar remains permanent
    if (pathname?.startsWith("/files") || centerView === "files") return <FilesPanel />;
    if (centerView === "progress") return <ProgressDashboard />;
    return <CenterChat />;
  }, [centerView, pathname]);
  
  return (
    <>
      <MainLayout left={<LeftSidebar />} center={center} right={<RightPanel />} />
      <QuizModal />
    </>
  );
}
