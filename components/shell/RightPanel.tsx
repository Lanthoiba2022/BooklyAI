"use client";
import * as React from "react";
import { usePdfStore } from "@/store/pdf";
import { Button } from "@/components/ui/button";
import ReactPdfViewer from "./pdf/ReactPdfViewer";
import { 
    X,
    FileText
} from "lucide-react";

export function RightPanel() {
    const { current, setCurrent } = usePdfStore();
    const [totalPages, setTotalPages] = React.useState<number | null>(current?.totalPages ?? null);

    return (
        <div className="h-full flex flex-col bg-white border-l">
            {/* Header */}
            <div className="h-12 border-b flex items-center justify-between px-4">
                <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground truncate">{current?.name || "No PDF Selected"}</h3>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrent(null)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>


            {/* PDF Viewer using @react-pdf-viewer */}
            <div className="flex-1 overflow-hidden bg-zinc-100">
                {current?.url ? (
                    <ReactPdfViewer
                        url={current.url}
                        onLoaded={(n) => {
                            setTotalPages(n);
                        }}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-zinc-400">
                        <div className="text-center">
                            <div className="text-4xl mb-4">📄</div>
                            <div className="text-lg font-medium">No PDF to preview</div>
                            <div className="text-sm">Select a PDF from the files panel to get started</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


