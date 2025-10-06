"use client";
import * as React from "react";

type PdfCanvasViewerProps = {
	url: string;
	page: number; // 1-based
	scale: number; // e.g., 1 = 100%
	onLoaded?: (numPages: number) => void;
};

export default function PdfCanvasViewer({ url, page, scale, onLoaded }: PdfCanvasViewerProps) {
	const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const renderTaskRef = React.useRef<any>(null);

	React.useEffect(() => {
		let cancelled = false;
        async function ensurePdfJs(): Promise<any> {
            const w = window as any;
            if (w.pdfjsLib) return w.pdfjsLib;
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load pdfjs script"));
                document.body.appendChild(script);
            });
            return (window as any).pdfjsLib;
        }

        async function loadAndRender() {
			setLoading(true);
			setError(null);
			try {
                const pdfjsLib = await ensurePdfJs();
                pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
                const loadingTask = pdfjsLib.getDocument(url);
				const pdf = await loadingTask.promise;
				if (cancelled) return;
				onLoaded?.(pdf.numPages);

				const safePage = Math.min(Math.max(1, page), pdf.numPages);
				const pdfPage = await pdf.getPage(safePage);
				if (cancelled) return;

				const viewport = pdfPage.getViewport({ scale });
				const canvas = canvasRef.current;
				if (!canvas) return;
				const context = canvas.getContext("2d");
				if (!context) return;
                // Prepare canvas and cancel any previous render task
                if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
                    try { renderTaskRef.current.cancel(); } catch {}
                }
                // Reset canvas
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                context.clearRect(0, 0, canvas.width, canvas.height);

                const task = pdfPage.render({ canvasContext: context, viewport });
                renderTaskRef.current = task;
                await task.promise;
				if (cancelled) return;
				setLoading(false);
			} catch (e: any) {
                // Ignore cancellation errors gracefully
                if (e && (e.name === "RenderingCancelledException" || e.message?.includes("Rendering cancelled") )) {
                    return;
                }
				if (!cancelled) {
					setError(e?.message || "Failed to render PDF");
					setLoading(false);
				}
			}
		}
		loadAndRender();
		return () => {
			cancelled = true;
            if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
                try { renderTaskRef.current.cancel(); } catch {}
            }
		};
	}, [url, page, scale, onLoaded]);

	return (
        <div className="relative w-full h-full flex items-center justify-center bg-white">
            {error ? (
                <div className="text-xs text-red-500 px-4 py-2">{error}</div>
            ) : (
                <canvas ref={canvasRef} className="block max-w-full h-auto" />
            )}
            {loading && !error && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <div className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-primary animate-spin" />
                        Loading page...
                    </div>
                </div>
            )}
		</div>
	);
}


