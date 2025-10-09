"use client";
import * as React from "react";
import { usePdfStore } from "@/store/pdf";
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import { zoomPlugin, ZoomPlugin } from '@react-pdf-viewer/zoom';
import { searchPlugin } from '@react-pdf-viewer/search';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';

// Import the styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/full-screen/lib/styles/index.css';

type ReactPdfViewerProps = {
    url: string;
    onLoaded?: (numPages: number) => void;
};

export default function ReactPdfViewer({ url, onLoaded }: ReactPdfViewerProps) {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Create plugins with zoom limits
    const zoomPluginInstance = zoomPlugin();

    const fullScreenPluginInstance = fullScreenPlugin({
        onEnterFullScreen: () => {
            setIsFullScreen(true);
            // Disable zoom in fullscreen
            zoomPluginInstance.zoomTo(1);
        },
        onExitFullScreen: () => {
            setIsFullScreen(false);
        }
    });

    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    const toolbarPluginInstance = toolbarPlugin();
    const searchPluginInstance = searchPlugin();
    const { setJumpToPage } = usePdfStore();
    const viewerRef = React.useRef<any>(null);

    // Function to update scale factor CSS variable
    const updateScaleFactor = (scale: number) => {
        const viewerElement = document.querySelector('.rpv-core__viewer') as HTMLElement;
        if (viewerElement) {
            viewerElement.style.setProperty('--scale-factor', scale.toString());
        }
    };

    const handleDocumentLoad = (e: any) => {
        setLoading(false);
        if (onLoaded && e.doc) {
            onLoaded(e.doc.numPages);
        }
        // Set initial scale factor
        updateScaleFactor(1);
    };

    const handleDocumentError = (e: any) => {
        setError(e.message || "Failed to load PDF");
        setLoading(false);
    };

    // Set initial scale factor when URL changes
    React.useEffect(() => {
        updateScaleFactor(1);
    }, [url]);

    React.useEffect(() => {
        // Expose a jumpToPage function that accepts 1-based page index
        setJumpToPage?.((pageZeroBased: number) => {
            try {
                const pageIndexOneBased = Math.max(1, (pageZeroBased ?? 0) + 1);
                // Use the viewer's internal API if available
                const viewer = document.querySelector('.rpv-core__viewer');
                // Fallback: dispatch custom event for plugins that support it
                (viewerRef.current as any)?.jumpToPage?.(pageIndexOneBased - 1);
            } catch {}
        });
        return () => setJumpToPage?.(undefined);
    }, [setJumpToPage]);

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-full"
        >
            {error ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-red-500 px-4 py-2">{error}</div>
                </div>
            ) : (
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                    <div style={{ height: '100%' }}>
                        <Viewer
                            ref={viewerRef as any}
                            fileUrl={url}
                            plugins={[
                                defaultLayoutPluginInstance,
                                toolbarPluginInstance,
                                zoomPluginInstance,
                                searchPluginInstance,
                                fullScreenPluginInstance
                            ]}
                            onDocumentLoad={handleDocumentLoad}
                        />
                    </div>
                </Worker>
            )}
            {loading && !error && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <div className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-primary animate-spin" />
                        Loading PDF...
                    </div>
                </div>
            )}
        </div>
    );
}
