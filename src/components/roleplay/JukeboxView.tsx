import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import "./JukeboxView.scss";

/* --------------------------------- Types --------------------------------- */

type Position = { x: number; y: number };

interface QueueItem {
    id: number;
    title: string;
    username?: string;
    rushed?: boolean;
}

interface NowPlaying {
    title: string;
    username?: string;
    positionSec?: number;
    durationSec?: number;
    muted?: boolean;
}

/* --------------------------------- Helpers -------------------------------- */

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

const fmtTime = (sec?: number) => {
    if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0)
        return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
};

/* ------------------------------- Component -------------------------------- */

export const JukeboxView: FC = () => {
    /* -----------------------------------------------------------------------
     * STATE (Replace these with your real jukebox events/parsers)
     * --------------------------------------------------------------------- */
    const [isOpen, setIsOpen] = useState(false);

    // demo state: wire these to your real packet events
    const [muted, setMuted] = useState(false);
    const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>({
        title: "Now Playing Track",
        username: "DJ Caleb",
        positionSec: 22,
        durationSec: 180,
        muted: false,
    });

    const [queue, setQueue] = useState<QueueItem[]>([
        { id: 1, title: "Song #1", username: "UserA" },
        { id: 2, title: "Song #2", username: "UserB", rushed: true },
    ]);

    /* -----------------------------------------------------------------------
     * OPTIONAL: Keep a timer updating progress if your server doesn't push it.
     * If your server *does* push positionSec, you can remove this.
     * --------------------------------------------------------------------- */
    useEffect(() => {
        const t = window.setInterval(() => {
            setNowPlaying((p) => {
                if (
                    !p ||
                    typeof p.positionSec !== "number" ||
                    typeof p.durationSec !== "number"
                )
                    return p;
                if (p.positionSec >= p.durationSec) return p;
                return { ...p, positionSec: p.positionSec + 1 };
            });
        }, 1000);
        return () => window.clearInterval(t);
    }, []);

    /* -----------------------------------------------------------------------
     * DRAG POSITION (window only)
     * --------------------------------------------------------------------- */
    const [pos] = useState<Position>(() => {
        const stored = localStorage.getItem("jukeboxPos");
        return stored ? JSON.parse(stored) : { x: 140, y: 90 };
    });

    const posRef = useRef<Position>(pos);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    const startDrag = (e: React.MouseEvent) => {
        dragRef.current = {
            dx: e.clientX - posRef.current.x,
            dy: e.clientY - posRef.current.y,
        };
        window.addEventListener("mousemove", onDrag);
        window.addEventListener("mouseup", stopDrag);
    };

    const onDrag = (e: MouseEvent) => {
        if (!dragRef.current || !viewRef.current) return;
        const next = {
            x: e.clientX - dragRef.current.dx,
            y: e.clientY - dragRef.current.dy,
        };
        posRef.current = next;
        viewRef.current.style.left = `${next.x}px`;
        viewRef.current.style.top = `${next.y}px`;
    };

    const stopDrag = () => {
        dragRef.current = null;
        localStorage.setItem("jukeboxPos", JSON.stringify(posRef.current));
        window.removeEventListener("mousemove", onDrag);
        window.removeEventListener("mouseup", stopDrag);
    };

    /* -----------------------------------------------------------------------
     * ACTIONS (replace with your composers)
     * --------------------------------------------------------------------- */
    const toggleMute = () => {
        setMuted((m) => !m);
        setNowPlaying((p) => (p ? { ...p, muted: !muted } : p));
    };

    const openQueue = () => setIsOpen(true);

    const closeWindow = () => setIsOpen(false);

    /* -----------------------------------------------------------------------
     * OVERLAY DERIVED
     * --------------------------------------------------------------------- */
    const overlayPct = useMemo(() => {
        if (
            !nowPlaying ||
            typeof nowPlaying.positionSec !== "number" ||
            typeof nowPlaying.durationSec !== "number"
        )
            return 0;
        if (nowPlaying.durationSec <= 0) return 0;
        return clampPct(
            (nowPlaying.positionSec / nowPlaying.durationSec) * 100
        );
    }, [nowPlaying]);

    const overlayLeftTime = useMemo(() => {
        if (
            !nowPlaying ||
            typeof nowPlaying.positionSec !== "number" ||
            typeof nowPlaying.durationSec !== "number"
        )
            return "--:--";
        const remaining = Math.max(
            0,
            nowPlaying.durationSec - nowPlaying.positionSec
        );
        return fmtTime(remaining);
    }, [nowPlaying]);

    /* -----------------------------------------------------------------------
     * RENDER
     * --------------------------------------------------------------------- */
    return (
        <>
            {/* ===========================================================
NOW PLAYING OVERLAY (NEW STYLE + NEW LOCATION)
- Same spot/weight as casino overlay reference
- Not tied to window open/closed
=========================================================== */}
            {nowPlaying && (
                <div className="jukebox-nowplaying">
                    <div className="jukebox-nowplaying__inner">
                        <span className="jukebox-nowplaying__icon">♪</span>

                        <div className="jukebox-nowplaying__meta">
                            <div
                                className="jukebox-nowplaying__title"
                                title={nowPlaying.title}
                            >
                                {nowPlaying.title}
                            </div>

                            <div className="jukebox-nowplaying__sub">
                                <span className="jukebox-nowplaying__by">
                                    {nowPlaying.username
                                        ? `by ${nowPlaying.username}`
                                        : "Jukebox"}
                                </span>

                                <span className="jukebox-nowplaying__time">
                                    • {fmtTime(nowPlaying.positionSec)} /{" "}
                                    {fmtTime(nowPlaying.durationSec)}
                                </span>

                                {muted && (
                                    <span className="jukebox-nowplaying__pill">
                                        Muted
                                    </span>
                                )}
                            </div>

                            <div className="jukebox-nowplaying__bar">
                                <div
                                    className="jukebox-nowplaying__fill"
                                    style={{ width: `${overlayPct}%` }}
                                />
                            </div>
                        </div>

                        <div className="jukebox-nowplaying__controls">
                            <button
                                className={`jukebox-nowplaying__btn ${
                                    muted ? "is-muted" : ""
                                }`}
                                onClick={toggleMute}
                                type="button"
                            >
                                {muted ? "Unmute" : "Mute"}
                            </button>

                            <button
                                className="jukebox-nowplaying__btn jukebox-nowplaying__btn--queue"
                                onClick={openQueue}
                                type="button"
                            >
                                Queue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===========================================================
OPTIONAL: YOUR JUKEBOX WINDOW / MODULE (UNCHANGED)
You said: overlay only — this stays as-is, but included here
so "full code" is in one place.
=========================================================== */}

            {isOpen && (
                <div className="jukebox-layer">
                    <div
                        ref={viewRef}
                        className="jukebox-view enter-br"
                        style={{
                            left: posRef.current.x,
                            top: posRef.current.y,
                            position: "absolute",
                        }}
                    >
                        <div className="juke-header" onMouseDown={startDrag}>
                            <div className="title">
                                <span className="juke-icon juke-icon-disc" />
                                <span className="title-text">Jukebox</span>
                            </div>

                            <button
                                className="juke-close-button"
                                onClick={closeWindow}
                                aria-label="Close"
                            />
                        </div>

                        <div className="juke-body">
                            <div className="now-card">
                                <div className="now-row">
                                    <div className="now-label">
                                        <span className="juke-icon juke-icon-play-pill" />
                                        Now Playing
                                    </div>

                                    <div
                                        className={`pill ${
                                            nowPlaying ? "ok" : "bad"
                                        }`}
                                    >
                                        {nowPlaying ? "LIVE" : "OFF"}
                                    </div>

                                    {muted && (
                                        <div className="pill muted-pill">
                                            Muted
                                        </div>
                                    )}
                                </div>

                                <div className="now-title">
                                    <span className="juke-icon juke-icon-disc-small" />
                                    {nowPlaying?.title ?? "No song playing"}
                                </div>
                            </div>

                            <div className="entry">
                                <label>Song ID</label>
                                <div className="entry-row">
                                    <input placeholder="Enter song id..." />
                                </div>

                                <div className="actions">
                                    <button
                                        className="hb-btn hb-primary"
                                        type="button"
                                    >
                                        Add
                                    </button>
                                    <button
                                        className="hb-btn hb-accent"
                                        type="button"
                                    >
                                        Rush
                                    </button>

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
                                                    : "juke-icon-horn"
                                            }`}
                                        />
                                        {muted ? "Muted" : "Sound"}
                                    </button>
                                </div>
                            </div>

                            <div className="queue">
                                <div className="q-head">
                                    <div>
                                        <span className="juke-icon juke-icon-disc-small" />
                                        Queue
                                    </div>
                                    <div className="muted">
                                        {queue.length} tracks
                                    </div>
                                </div>

                                <div className="q-list">
                                    {queue.length === 0 ? (
                                        <div className="q-empty">
                                            Queue is empty.
                                        </div>
                                    ) : (
                                        queue.map((q) => (
                                            <div
                                                key={q.id}
                                                className={`q-item ${
                                                    q.rushed ? "expedited" : ""
                                                }`}
                                            >
                                                <div className="q-title">
                                                    {q.title}
                                                </div>
                                                <div className="q-meta">
                                                    <span className="by">
                                                        {q.username
                                                            ? `by ${q.username}`
                                                            : "system"}
                                                    </span>
                                                    {q.rushed && (
                                                        <span className="tag-rush">
                                                            Rush
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
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
