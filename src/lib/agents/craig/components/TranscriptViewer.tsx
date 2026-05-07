/**
 * v33 — extracted from the inline block that ConversationsModule
 * defined locally. Reused in QuoteDetailSidebar (so Justin can read
 * the conversation without leaving the Quotations tab).
 */
export type TranscriptMessage = {
    role: string;
    content: string;
};

export interface TranscriptViewerProps {
    messages: TranscriptMessage[];
    /** Tailwind utility class for the scroll container's max-height.
     *  Default keeps it short enough to live inside a sidebar; the
     *  Conversations module passes a taller value. */
    maxHeightClass?: string;
}

export function TranscriptViewer({
    messages,
    maxHeightClass = 'max-h-[40vh]',
}: TranscriptViewerProps) {
    if (!messages || messages.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500 italic">
                No messages on this conversation yet.
            </div>
        );
    }
    return (
        <div className={['space-y-3 overflow-y-auto', maxHeightClass].join(' ')}>
            {messages.map((m, i) => {
                const isUser = m.role === 'user';
                const isSystem = m.role === 'system';
                return (
                    <div
                        key={i}
                        className={
                            isUser
                                ? 'rounded-lg bg-[var(--color-primary,#040f2a)] text-white p-3 ml-8 text-sm'
                                : isSystem
                                    ? 'rounded-lg bg-slate-50 border border-dashed border-slate-300 p-2 text-[11px] italic text-slate-600 mx-4'
                                    : 'rounded-lg bg-slate-100 p-3 mr-8 text-sm'
                        }
                    >
                        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">
                            {isUser ? 'Customer' : isSystem ? 'System' : 'Craig'}
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                );
            })}
        </div>
    );
}
