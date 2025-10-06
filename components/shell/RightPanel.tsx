"use client";
import * as React from "react";
import { usePdfStore } from "@/store/pdf";
import { Button } from "@/components/ui/button";
import PdfCanvasViewer from "./pdf/PdfCanvasViewer";
import { 
    X,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    FileText,
    Maximize2
} from "lucide-react";

export function RightPanel() {
    const { current, setCurrent, setCurrentPage } = usePdfStore();
    const [zoom, setZoom] = React.useState(100);
    const [totalPages, setTotalPages] = React.useState<number | null>(current?.totalPages ?? null);
    const page = current?.currentPage ?? 1;

    const handleZoomIn = () => setZoom((z) => Math.min(200, z + 10));
    const handleZoomOut = () => setZoom((z) => Math.max(50, z - 10));
    const handlePrev = () => setCurrentPage(Math.max(1, page - 1));
    const handleNext = () => setCurrentPage(Math.min(totalPages, page + 1));

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

            {/* Controls */}
            <div className="h-12 border-b flex items-center justify-between px-4 gap-2">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrev}
                        disabled={page === 1}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                        <span className="text-sm font-medium">{page}</span>
                        <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNext}
                        disabled={page === totalPages}
                        className="h-8 w-8"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomOut}
                        disabled={zoom <= 50}
                        className="h-8 w-8"
                    >
                        <ZoomOut className="w-3 h-3" />
                    </Button>
                    <span className="text-xs font-medium min-w-[45px] text-center">{zoom}%</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomIn}
                        disabled={zoom >= 200}
                        className="h-8 w-8"
                    >
                        <ZoomIn className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Maximize2 className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Real single-page viewer using pdfjs-dist */}
            <div className="flex-1 overflow-y-auto bg-zinc-100">
                <div className="p-4">
                    {current?.url ? (
                        <div className="bg-white shadow mx-auto rounded-sm overflow-hidden" style={{ maxWidth: "100%" }}>
                            <div className="w-full" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
                                <PdfCanvasViewer
                                    url={current.url}
                                    page={page}
                                    scale={1}
                                    onLoaded={(n) => {
                                        setTotalPages(n);
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-[70vh] min-h-[400px] aspect-[8.5/11] flex items-center justify-center text-zinc-400 bg-white rounded-sm shadow mx-auto">
                            No PDF to preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


