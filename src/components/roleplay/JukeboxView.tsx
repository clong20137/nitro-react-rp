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
    startedAt?: number; // unix seconds
    queue: QueueItem[];
};

type Props = {
    onClose?: () => void;
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

/** Small, no-deps draggable hook (no transform-jump now) */
function useDraggable<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const dragData = useRef<{
        ox: number;
        oy: number;
        sx: number;
        sy: number;
        w: number;
        h: number;
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
            w: rect.width,
            h: rect.height,
        };

        const onMove = (ev: MouseEvent) => {
            if (!dragData.current) return;

            const dx = ev.clientX - dragData.current.ox;
            const dy = ev.clientY - dragData.current.oy;

            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;

            const rawLeft = dragData.current.sx + dx;
            const rawTop = dragData.current.sy + dy;

            const minX = 8;
            const minY = 8;
            const maxX = vw - dragData.current.w - 8;
            const maxY = vh - dragData.current.h - 8;

            const newLeft = Math.min(Math.max(rawLeft, minX), maxX);
            const newTop = Math.min(Math.max(rawTop, minY), maxY);

            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
            // IMPORTANT: we do NOT touch el.style.transform here,
            // so no fighting with animations / centering.
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
    // ONLY control the *window* with this; audio continues regardless
    const [open, setOpen] = useState(false);

    // Live state pushed by server
    const [state, setState] = useState<JState>({
        roomId: 0,
        isOpen: true,
        isPlaying: false,
        currentVideoId: null,
        currentTitle: null,
        requestCost: 2,
        expediteCost: 5,
        startedAt: 0,
        queue: [],
    });

    const [input, setInput] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // 🔇 local mute toggle (per-user only)
    const [muted, setMuted] = useState(false);

    // Hidden player URL (includes start offset + mute flag)
    const [playerUrl, setPlayerUrl] = useState<string | null>(null);

    // drag like TaxiView (but with fixed base position)
    const { ref: dragRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    /* ---------- bridges ---------- */
    useEffect(() => {
        // OPEN: fired by furniture click
        const onOpenEvt = () => {
            setOpen(true);
        };

        // STATE updates (from parser → window.dispatchEvent)
        const onState = (e: any) => {
            const d = (e?.detail || {}) as Partial<JState>;
            setState((prev) => ({
                ...prev,
                ...d,
                queue: d.queue ?? prev.queue,
            }));
        };

        // TOAST passthrough
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

        window.addEventListener("jukebox_open", onOpenEvt as EventListener);
        window.addEventListener(
            "jukebox_state_update",
            onState as EventListener
        );
        window.addEventListener("jukebox_toast", onToast as EventListener);
        window.addEventListener("keydown", onEsc);

        return () => {
            window.removeEventListener(
                "jukebox_open",
                onOpenEvt as EventListener
            );
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
    }, [open]);

    const doClose = () => {
        setOpen(false);
        onClose?.();
        // NOTE: we do NOT stop audio here; audio is controlled by server state
    };

    /* ---------- AUDIO SYNC EFFECT ---------- */
    useEffect(() => {
        // Only play when server says playing + we have a video id
        if (!state.isPlaying || !state.currentVideoId) {
            setPlayerUrl(null);
            return;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const started = state.startedAt ?? nowSec;
        let offset = nowSec - started;

        // Clamp offset: never negative, never beyond 5 minutes
        if (offset < 0) offset = 0;
        if (offset > 5 * 60) offset = 5 * 60;

        const vid = state.currentVideoId;
        const url =
            `https://www.youtube.com/embed/${vid}` +
            `?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1` +
            `&start=${offset}` +
            `&mute=${muted ? 1 : 0}`;

        setPlayerUrl(url);
    }, [state.isPlaying, state.currentVideoId, state.startedAt, muted]);

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
        setState((s) => ({ ...s, isOpen: !s.isOpen }));
    };

    const toggleMute = () => {
        setMuted((m) => !m);
    };

    const canSubmit = useMemo(
        () => !!extractVideoId(input) && !submitting,
        [input, submitting]
    );

    return (
        <>
            {/* 🔊 Hidden YouTube iframe for audio playback.
This stays mounted even when the jukebox window is closed. */}
            <div
                style={{
                    position: "absolute",
                    width: 0,
                    height: 0,
                    overflow: "hidden",
                    pointerEvents: "none",
                }}
            >
                {state.isPlaying && state.currentVideoId && playerUrl && (
                    <iframe
                        title="Room Jukebox Audio"
                        src={playerUrl}
                        allow="autoplay"
                        style={{
                            width: 0,
                            height: 0,
                            border: 0,
                        }}
                    />
                )}
            </div>

            {/* UI window (can be closed/minimized independently) */}
            {open && (
                <div className="jukebox-layer">
                    <div
                        className="jukebox-view enter-br"
                        ref={dragRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Room Jukebox"
                    >
                        <div className="juke-header" onMouseDown={startDrag}>
                            <div className="title">
                                <span className="juke-icon juke-icon-horn" />
                                <span className="title-text">Room Jukebox</span>
                            </div>

                            <div className="spacer" />

                            <button
                                className={`hb-btn hb-ghost mute-btn ${
                                    muted ? "is-muted" : ""
                                }`}
                                onClick={toggleMute}
                                type="button"
                            >
                                <span
                                    className={`juke-icon ${
                                        muted
                                            ? "juke-icon-nohorn"
                                            : "juke-icon-music"
                                    }`}
                                />
                                {muted ? "Unmute" : "Mute"}
                            </button>

                            <button
                                className="juke-close-button"
                                onClick={doClose}
                                aria-label="Close"
                                type="button"
                            />
                        </div>

                        <div className="juke-body">
                            <div className="now-card">
                                <div className="now-row">
                                    <div className="now-label">
                                        <span className="juke-icon juke-icon-user-music" />
                                        Status
                                    </div>
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
                                        <span className="juke-icon juke-icon-play-pill" />
                                        {state.isPlaying ? "Playing" : "Idle"}
                                    </div>
                                    {muted && (
                                        <div className="pill muted-pill">
                                            <span className="juke-icon juke-icon-nohorn-small" />
                                            Muted
                                        </div>
                                    )}
                                    <div className="spacer" />
                                    <button
                                        className="hb-btn hb-ghost"
                                        onClick={toggleOpen}
                                        type="button"
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
                                    {state.currentTitle ? (
                                        <>
                                            <span className="juke-icon juke-icon-disc" />
                                            {`Now Playing: ${state.currentTitle}`}
                                        </>
                                    ) : (
                                        "No track playing"
                                    )}
                                </div>
                            </div>

                            <div className="entry">
                                <label>Paste YouTube Link or ID</label>
                                <div className="entry-row">
                                    <input
                                        value={input}
                                        onChange={(e) =>
                                            setInput(e.target.value)
                                        }
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
                                        type="button"
                                    >
                                        Add to Queue{" "}
                                        <span className="cost">
                                            <i className="ico-diamond" />{" "}
                                            {state.requestCost}
                                        </span>
                                    </button>
                                    <button
                                        className="hb-btn hb-accent"
                                        disabled={!canSubmit}
                                        onClick={() => sendRequest(true)}
                                        title="Jump to the front of the line"
                                        type="button"
                                    >
                                        Expedite Next{" "}
                                        <span className="cost">
                                            <i className="ico-diamond" />{" "}
                                            {state.expediteCost}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="queue">
                                <div className="q-head">
                                    <div>
                                        <span className="juke-icon juke-icon-disc-small" />
                                        Up Next
                                    </div>
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
                                            <div
                                                className="q-title"
                                                title={q.title}
                                            >
                                                {q.title || q.videoId}
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
            )}
        </>
    );
};

export default JukeboxView;
