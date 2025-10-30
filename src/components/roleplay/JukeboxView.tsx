import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { SendMessageComposer } from "../../api";
import "./JukeboxView.scss";

// Soft-import composers so missing paths don’t explode dev builds
let JukeboxRequestComposerRef: any;
let JukeboxOpenCloseComposerRef: any;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    JukeboxRequestComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JukeboxRequestComposer").JukeboxRequestComposer;
} catch {}
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    JukeboxOpenCloseComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JukeboxOpenCloseComposer").JukeboxOpenCloseComposer;
} catch {}

/* ---------- types ---------- */
type QueueItem = {
    id: number;
    videoId: string;
    title: string;
    requestedBy: string;
    expedited?: boolean;
    position?: number;
};

type JState = {
    roomId: number;
    isOpen: boolean;
    isPlaying: boolean;
    currentVideoId?: string | null;
    currentTitle?: string | null;
    requestCost: number;
    expediteCost: number;
    queue: QueueItem[];
};

type Props = {
    onClose?: () => void; // optional; we also close locally
};

/* ---------- helpers ---------- */
const YT_ID = /(?:^|v=|\/|embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})(?:\b|$)/i;

function extractVideoId(s: string): string | null {
    if (!s) return null;
    const trimmed = s.trim();
    const m = YT_ID.exec(trimmed);
    if (m && m[1]) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
    return null;
}

/** Small, no-deps draggable hook (same pattern as TaxiView) */
function useDraggable<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const dragData = useRef<{
        ox: number;
        oy: number;
        sx: number;
        sy: number;
    } | null>(null);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!ref.current) return;
        const el = ref.current;
        const rect = el.getBoundingClientRect();

        dragData.current = {
            ox: e.clientX,
            oy: e.clientY,
            sx: rect.left,
            sy: rect.top,
        };

        const onMove = (ev: MouseEvent) => {
            if (!dragData.current) return;

            const dx = ev.clientX - dragData.current.ox;
            const dy = ev.clientY - dragData.current.oy;

            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            const newLeft = Math.min(
                Math.max(dragData.current.sx + dx, 8),
                vw - rect.width - 8
            );
            const newTop = Math.min(
                Math.max(dragData.current.sy + dy, 8),
                vh - rect.height - 8
            );

            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
            el.style.transform = `translate(0,0)`;
        };

        const onUp = () => {
            dragData.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, []);

    return { ref, onMouseDown };
}

/* ---------- component ---------- */
export const JukeboxView: React.FC<Props> = ({ onClose }) => {
    // ONLY render when we receive an explicit open signal
    const [open, setOpen] = useState(false);

    // Live state pushed by server (we do NOT auto-open on this)
    const [state, setState] = useState<JState>({
        roomId: 0,
        isOpen: true,
        isPlaying: false,
        currentVideoId: null,
        currentTitle: null,
        requestCost: 2,
        expediteCost: 5,
        queue: [],
    });

    const [input, setInput] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // drag like TaxiView
    const { ref: dragRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    /* ---------- bridges ---------- */
    useEffect(() => {
        // OPEN: fired by furniture double-click handler / interaction
        const onOpen = () => {
            setOpen(true);
            // optional: center on open
            if (dragRef.current) {
                const el = dragRef.current;
                el.style.left = "50%";
                el.style.top = "50%";
                el.style.transform = "translate(-50%, -50%)";
            }
        };

        // STATE updates (don’t open here)
        const onState = (e: any) => {
            const d = (e?.detail || {}) as Partial<JState>;
            setState((prev) => ({
                ...prev,
                ...d,
                queue: d.queue ?? prev.queue,
            }));
        };

        // TOAST passthrough (same as before)
        const onToast = (e: any) => {
            const d = e?.detail as { kind: string; text: string };
            if (!d) return;
            try {
                window.dispatchEvent(
                    new CustomEvent("nitro_alert", { detail: d.text })
                );
            } catch {
                console.log("[JUKEBOX]", d.kind, d.text);
            }
        };

        const onEsc = (e: KeyboardEvent) => {
            if (open && e.key === "Escape") doClose();
        };

        window.addEventListener("jukebox_open", onOpen as EventListener);
        window.addEventListener(
            "jukebox_state_update",
            onState as EventListener
        );
        window.addEventListener("jukebox_toast", onToast as EventListener);
        window.addEventListener("keydown", onEsc);

        return () => {
            window.removeEventListener("jukebox_open", onOpen as EventListener);
            window.removeEventListener(
                "jukebox_state_update",
                onState as EventListener
            );
            window.removeEventListener(
                "jukebox_toast",
                onToast as EventListener
            );
            window.removeEventListener("keydown", onEsc);
        };
    }, [open, dragRef]);

    const doClose = () => {
        setOpen(false);
        onClose?.();
    };

    /* ---------- actions ---------- */
    const sendRequest = (expedite: boolean) => {
        if (!JukeboxRequestComposerRef) return;
        const vid = extractVideoId(input);
        if (!vid) {
            window.dispatchEvent(
                new CustomEvent("nitro_alert", {
                    detail: "Enter a valid YouTube link or 11-char ID.",
                })
            );
            return;
        }
        setSubmitting(true);
        try {
            SendMessageComposer(new JukeboxRequestComposerRef(vid, expedite));
            setInput("");
        } finally {
            setTimeout(() => setSubmitting(false), 250);
        }
    };

    const toggleOpen = () => {
        if (!JukeboxOpenCloseComposerRef) return;
        SendMessageComposer(new JukeboxOpenCloseComposerRef(!state.isOpen));
        // optimistic
        setState((s) => ({ ...s, isOpen: !s.isOpen }));
    };

    const canSubmit = useMemo(
        () => !!extractVideoId(input) && !submitting,
        [input, submitting]
    );

    if (!open) return null;

    return (
        <div className="jukebox-layer">
            <div
                className="jukebox-view enter"
                ref={dragRef}
                role="dialog"
                aria-modal="true"
                aria-label="Room Jukebox"
                // initial center (drag hook will override left/top on move)
                style={{
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                }}
            >
                <div className="juke-header" onMouseDown={startDrag}>
                    <div className="title">
                        <i className="ico ico-note" /> Room Jukebox
                    </div>
                    <div className="spacer" />
                    <button
                        className="hb-btn hb-danger"
                        onClick={doClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div className="juke-body">
                    <div className="now-card">
                        <div className="now-row">
                            <div className="now-label">Status</div>
                            <div
                                className={`pill ${
                                    state.isOpen ? "ok" : "bad"
                                }`}
                            >
                                {state.isOpen ? "Open" : "Closed"}
                            </div>
                            <div
                                className={`pill ${
                                    state.isPlaying ? "ok" : ""
                                }`}
                            >
                                {state.isPlaying ? "Playing" : "Idle"}
                            </div>
                            <div className="spacer" />
                            <button
                                className="hb-btn hb-ghost"
                                onClick={toggleOpen}
                            >
                                {state.isOpen
                                    ? "Close Jukebox"
                                    : "Open Jukebox"}
                            </button>
                        </div>
                        <div
                            className="now-title"
                            title={state.currentTitle || ""}
                        >
                            {state.currentTitle
                                ? `Now Playing: ${state.currentTitle}`
                                : "No track playing"}
                        </div>
                    </div>

                    <div className="entry">
                        <label>Paste YouTube Link or ID</label>
                        <div className="entry-row">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="https://youtu.be/… or 11-char video id"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && canSubmit)
                                        sendRequest(false);
                                }}
                                autoFocus
                            />
                        </div>

                        <div className="actions">
                            <button
                                className="hb-btn hb-primary"
                                disabled={!canSubmit}
                                onClick={() => sendRequest(false)}
                            >
                                Add to Queue{" "}
                                <span className="cost">
                                    <i className="ico ico-diamond" />{" "}
                                    {state.requestCost}
                                </span>
                            </button>
                            <button
                                className="hb-btn hb-accent"
                                disabled={!canSubmit}
                                onClick={() => sendRequest(true)}
                                title="Jump to the front of the line"
                            >
                                Expedite Next{" "}
                                <span className="cost">
                                    <i className="ico ico-diamond" />{" "}
                                    {state.expediteCost}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="queue">
                        <div className="q-head">
                            <div>Up Next</div>
                            <div className="muted">
                                ({state.queue?.length || 0})
                            </div>
                        </div>

                        <div className="q-list">
                            {(state.queue ?? []).map((q) => (
                                <div
                                    key={q.id}
                                    className={`q-item ${
                                        q.expedited ? "expedited" : ""
                                    }`}
                                >
                                    <div className="q-title" title={q.title}>
                                        {q.title}
                                    </div>
                                    <div className="q-meta">
                                        <span className="by">
                                            by {q.requestedBy}
                                        </span>
                                        {q.expedited && (
                                            <span className="tag-rush">
                                                RUSH
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {!state.queue?.length && (
                                <div className="q-empty">
                                    No pending requests.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JukeboxView;
