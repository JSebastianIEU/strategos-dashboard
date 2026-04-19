'use client';
/**
 * Slide-in right drawer that embeds a PDF in an iframe.
 * Tap outside or close button to dismiss.
 */
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Download } from 'lucide-react';

interface PdfDrawerProps {
    open: boolean;
    onClose: () => void;
    title: string;
    url: string;
}

export function PdfDrawer({ open, onClose, title, url }: PdfDrawerProps) {
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-3xl w-full h-[85vh] p-0 sm:rounded-xl flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
                    <DialogTitle className="text-sm">{title}</DialogTitle>
                    <a
                        href={url}
                        download
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                        <Download className="h-3 w-3" />
                        Download
                    </a>
                </div>
                <iframe src={url} className="flex-1 w-full" title={title} />
            </DialogContent>
        </Dialog>
    );
}
