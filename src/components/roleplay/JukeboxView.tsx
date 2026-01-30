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
// OPTIONAL: if you have a "TrackEnded" outgoing composer, wire it here
let JukeboxTrackEndedComposerRef: any;

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
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    JukeboxTrackEndedComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JukeboxTrackEndedComposer").JukeboxTrackEndedComposer;
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

type Props = { onClose?: () => void };

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

function fmtTime(totalSec: number): string {
    if (!Number.isFinite(totalSec) || totalSec <= 0) return "0:00";
    const sec = Math.floor(totalSec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** Small, no-deps draggable hook (no transform-jump) */
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

/* ---------- YT IFrame API loader ---------- */
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: any;
    }
}

function useYouTubeApiReady() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // already loaded?
        if (window.YT && window.YT.Player) {
            setReady(true);
            return;
        }

        // avoid injecting twice
        const existing = document.querySelector(
            'script[data-yt-api="1"]'
        ) as HTMLScriptElement | null;
        if (existing) {
            // wait for it
            const t = window.setInterval(() => {
                if (window.YT && window.YT.Player) {
                    window.clearInterval(t);
                    setReady(true);
                }
            }, 50);
            return () => window.clearInterval(t);
        }

        window.onYouTubeIframeAPIReady = () => setReady(true);

        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.setAttribute("data-yt-api", "1");
        document.head.appendChild(script);

        const t = window.setInterval(() => {
            if (window.YT && window.YT.Player) {
                window.clearInterval(t);
                setReady(true);
            }
        }, 50);

        return () => window.clearInterval(t);
    }, []);

    return ready;
}

/* ---------- component ---------- */
export const JukeboxView: React.FC<Props> = ({ onClose }) => {
    // Controls ONLY the queue window visibility
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

    // Local-only mute + play/pause (overlay controls, does NOT affect server state)
    const [muted, setMuted] = useState(false);
    const [localPaused, setLocalPaused] = useState(false);

    // Duration + current time from player (for overlay)
    const [durationSec, setDurationSec] = useState(0);
    const [currentSec, setCurrentSec] = useState(0);

    // This overlay should be present as long as you’re in the same vRoom as jukebox.
    // If you already have a "current virtual room id" event, wire it here.
    // For now: show overlay when jukebox is playing or has a current title/video.
    const shouldShowOverlay =
        !!state.currentVideoId && (state.isPlaying || !!state.currentTitle);

    // YouTube player
    const ytReady = useYouTubeApiReady();
    const playerRef = useRef<any>(null);
    const playerHostRef = useRef<HTMLDivElement | null>(null);

    // Track last server video id so we only load when it changes
    const lastVidRef = useRef<string | null>(null);

    // Small guard so ENDED doesn’t spam
    const endedDebounceRef = useRef<number>(0);

    // drag window
    const { ref: dragRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    /* ---------- bridges ---------- */
    useEffect(() => {
        const onOpenEvt = () => setOpen(true);

        const onState = (e: any) => {
            const d = (e?.detail || {}) as Partial<JState>;
            setState((prev) => ({
                ...prev,
                ...d,
                queue: d.queue ?? prev.queue,
            }));
        };

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
        // audio continues
    };

    /* ---------- create persistent YT player once ---------- */
    useEffect(() => {
        if (!ytReady) return;
        if (!playerHostRef.current) return;
        if (playerRef.current) return;

        // Create once; we never destroy unless full unmount
        playerRef.current = new window.YT.Player(playerHostRef.current, {
            height: "0",
            width: "0",
            videoId: "",
            playerVars: {
                autoplay: 1,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                disablekb: 1,
            },
            events: {
                onReady: () => {
                    try {
                        playerRef.current.mute();
                        if (!muted) playerRef.current.unMute();
                    } catch {}
                },
                onStateChange: (ev: any) => {
                    // 0 = ended, 1 = playing, 2 = paused
                    if (!ev || typeof ev.data !== "number") return;

                    if (ev.data === 1) {
                        // playing
                        setLocalPaused(false);
                        // update duration ASAP
                        try {
                            const d = Number(
                                playerRef.current.getDuration?.() ?? 0
                            );
                            if (d > 0) setDurationSec(d);
                        } catch {}
                    }

                    if (ev.data === 2) {
                        // paused
                        setLocalPaused(true);
                    }

                    if (ev.data === 0) {
                        // ended
                        const now = Date.now();
                        if (now - endedDebounceRef.current < 900) return;
                        endedDebounceRef.current = now;

                        // ✅ Tell server to advance immediately (this is what eliminates dead air)
                        // Wire this to YOUR outgoing packet/composer.
                        try {
                            if (JukeboxTrackEndedComposerRef) {
                                SendMessageComposer(
                                    new JukeboxTrackEndedComposerRef()
                                );
                            } else {
                                // fallback: window event hook if your client->server bridge listens for it
                                window.dispatchEvent(
                                    new CustomEvent("jukebox_track_ended")
                                );
                            }
                        } catch {}
                    }
                },
            },
        });

        return () => {
            // If you *want* to destroy on hot reload/unmount:
            try {
                playerRef.current?.destroy?.();
            } catch {}
            playerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ytReady]);

    /* ---------- keep player mute in sync ---------- */
    useEffect(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
            if (muted) p.mute();
            else p.unMute();
        } catch {}
    }, [muted]);

    /* ---------- server sync -> load video without iframe remount ---------- */
    useEffect(() => {
        const p = playerRef.current;
        const vid = state.currentVideoId ?? null;

        // stop audio if not playing / no vid
        if (!p || !vid || !state.isPlaying) {
            try {
                // avoid "pause between songs" when server flips states briefly:
                // only stop if server truly indicates not playing
                if (!state.isPlaying) p.stopVideo?.();
            } catch {}
            return;
        }

        // compute offset from startedAt (sync with everyone)
        const nowSec = Math.floor(Date.now() / 1000);
        const started = state.startedAt ?? nowSec;
        let offset = nowSec - started;
        if (offset < 0) offset = 0;
        if (offset > 60 * 10) offset = 60 * 10;

        // If the server video changed, load it immediately (no remount = minimal gap)
        if (lastVidRef.current !== vid) {
            lastVidRef.current = vid;
            setDurationSec(0);
            setCurrentSec(0);

            try {
                p.loadVideoById({
                    videoId: vid,
                    startSeconds: offset,
                    suggestedQuality: "small",
                });
            } catch {
                // ignore
            }

            // OPTIONAL: pre-cue the next song in queue to reduce next transition gap further
            try {
                const next = state.queue?.[0]?.videoId;
                if (next && next !== vid) {
                    // cueing doesn't play, but primes the buffer a bit
                    p.cueVideoById({
                        videoId: next,
                        startSeconds: 0,
                        suggestedQuality: "small",
                    });
                }
            } catch {}

            return;
        }

        // Same vid: keep in sync (avoid drift)
        // Only correct if we’re off by more than ~2 seconds (so we don’t fight normal playback)
        try {
            const cur = Number(p.getCurrentTime?.() ?? 0);
            if (Number.isFinite(cur)) {
                const drift = Math.abs(cur - offset);
                if (drift > 2.25) {
                    p.seekTo?.(offset, true);
                }
            }
        } catch {}
    }, [state.isPlaying, state.currentVideoId, state.startedAt, state.queue]);

    /* ---------- poll player time for overlay ---------- */
    useEffect(() => {
        const p = playerRef.current;
        if (!p) return;

        const t = window.setInterval(() => {
            try {
                const d = Number(p.getDuration?.() ?? 0);
                if (d > 0) setDurationSec((prev) => (prev > 0 ? prev : d));

                const c = Number(p.getCurrentTime?.() ?? 0);
                if (c >= 0) setCurrentSec(c);
            } catch {}
        }, 500);

        return () => window.clearInterval(t);
    }, [ytReady]);

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

    const toggleMute = () => setMuted((m) => !m);

    const overlayPlayPause = () => {
        const p = playerRef.current;
        if (!p) return;

        try {
            const ps = p.getPlayerState?.();
            // 1 playing, 2 paused
            if (ps === 1) p.pauseVideo?.();
            else p.playVideo?.();
        } catch {}
    };

    const canSubmit = useMemo(
        () => !!extractVideoId(input) && !submitting,
        [input, submitting]
    );

    const overlayTitle = state.currentTitle || "Now Playing";
    const overlayDur = durationSec > 0 ? fmtTime(durationSec) : "--:--";
    const overlayCur =
        durationSec > 0 ? fmtTime(currentSec) : fmtTime(currentSec);

    return (
        <>
            {/* Persistent YT player host (0x0). DO NOT swap iframe URLs. */}
            <div
                style={{
                    position: "absolute",
                    width: 0,
                    height: 0,
                    overflow: "hidden",
                    pointerEvents: "none",
                }}
            >
                <div ref={playerHostRef as any} />
            </div>

            {/* Always-present overlay while in jukebox vRoom (or while playing). */}
            {shouldShowOverlay && (
                <div
                    className="jukebox-overlay"
                    aria-label="Jukebox Now Playing Overlay"
                >
                    <div className="jukebox-overlay__inner">
                        <div className="jukebox-overlay__meta">
                            <div
                                className="jukebox-overlay__title"
                                title={overlayTitle}
                            >
                                {overlayTitle}
                            </div>
                            <div className="jukebox-overlay__sub">
                                <span className="jukebox-overlay__time">
                                    {overlayCur} / {overlayDur}
                                </span>
                            </div>
                        </div>

                        <div className="jukebox-overlay__controls">
                            <button
                                type="button"
                                className="jukebox-overlay__btn"
                                onClick={overlayPlayPause}
                                title={localPaused ? "Play" : "Pause"}
                            >
                                {localPaused ? "Play" : "Pause"}
                            </button>

                            <button
                                type="button"
                                className={`jukebox-overlay__btn ${
                                    muted ? "is-muted" : ""
                                }`}
                                onClick={toggleMute}
                                title={muted ? "Unmute" : "Mute"}
                            >
                                {muted ? "Unmute" : "Mute"}
                            </button>

                            <button
                                type="button"
                                className="jukebox-overlay__btn jukebox-overlay__btn--queue"
                                onClick={() => setOpen(true)}
                                title="Open Queue"
                            >
                                Queue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Queue UI window (can be closed/minimized independently) */}
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
