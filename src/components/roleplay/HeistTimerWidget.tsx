import { FC, useEffect, useMemo, useState } from "react";
import "./HeistTimerWidget.scss";

/**
 * Top-center heist timer widget (progress bar).
 * Listens for:
 * - window 'heist_timer_start' detail: { roomId, gangId, remainingSeconds, totalSeconds }
 * - window 'heist_timer_stop' detail: { roomId }
 *
 * Matches OlympusRP theme style (blue frame, thick border, shadow).
 */

type HeistTimerStartPayload = {
    roomId?: number;
    gangId?: number;
    remainingSeconds?: number;
    totalSeconds?: number;
};

const clampInt = (n: any, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isFinite(Number(n))
        ? Math.min(max, Math.max(min, Math.floor(Number(n))))
        : min;

const formatTime = (s: number) => {
    const sec = clampInt(s, 0);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
};

export const HeistTimerWidget: FC = () => {
    const [active, setActive] = useState(false);
    const [roomId, setRoomId] = useState<number>(0);
    const [gangId, setGangId] = useState<number>(0);

    // We store an absolute end timestamp so the UI stays smooth even if server only sends one packet.
    const [endAtMs, setEndAtMs] = useState<number>(0);
    const [totalSeconds, setTotalSeconds] = useState<number>(0);

    // Tick UI
    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNowMs(Date.now()), 200);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const onStart = (event: Event) => {
            const custom = event as CustomEvent<HeistTimerStartPayload>;
            const detail = custom.detail ?? {};

            const total = clampInt(detail.totalSeconds, 1, 60 * 60);
            const remaining = clampInt(detail.remainingSeconds, 0, total);

            setRoomId(clampInt(detail.roomId, 0));
            setGangId(clampInt(detail.gangId, 0));
            setTotalSeconds(total);

            // end timestamp based on *remaining*
            setEndAtMs(Date.now() + remaining * 1000);
            setActive(true);
        };

        const onStop = () => {
            setActive(false);
            setEndAtMs(0);
            setTotalSeconds(0);
            setRoomId(0);
            setGangId(0);
        };

        window.addEventListener("heist_timer_start", onStart as EventListener);
        window.addEventListener("heist_timer_stop", onStop as EventListener);

        return () => {
            window.removeEventListener(
                "heist_timer_start",
                onStart as EventListener
            );
            window.removeEventListener(
                "heist_timer_stop",
                onStop as EventListener
            );
        };
    }, []);

    const remainingSeconds = useMemo(() => {
        if (!active || endAtMs <= 0) return 0;
        const msLeft = endAtMs - nowMs;
        return clampInt(Math.ceil(msLeft / 1000), 0);
    }, [active, endAtMs, nowMs]);

    // Auto-stop when timer hits 0 (client-side safety)
    useEffect(() => {
        if (!active) return;
        if (remainingSeconds > 0) return;

        setActive(false);
        setEndAtMs(0);
        setTotalSeconds(0);
    }, [active, remainingSeconds]);

    const progressPct = useMemo(() => {
        if (!active || totalSeconds <= 0) return 0;
        const left = clampInt(remainingSeconds, 0, totalSeconds);
        const done = totalSeconds - left;
        return Math.max(0, Math.min(100, (done / totalSeconds) * 100));
    }, [active, remainingSeconds, totalSeconds]);

    if (!active) return null;

    return (
        <div className="heist-timer-widget">
            <div className="heist-timer-inner">
                <div className="heist-timer-top">
                    <span className="heist-timer-icon">⏳</span>
                    <span className="heist-timer-title">HEIST IN PROGRESS</span>

                    <span className="heist-timer-time">
                        {formatTime(remainingSeconds)}
                    </span>
                </div>

                <div className="heist-timer-bar">
                    <div
                        className="heist-timer-bar-fill"
                        style={{ ["--pct" as any]: `${progressPct}%` }}
                    />
                </div>

                <div className="heist-timer-meta">
                    <span className="heist-timer-meta-item">
                        Room #{roomId}
                    </span>
                    <span className="heist-timer-meta-dot">•</span>
                    <span className="heist-timer-meta-item">
                        Gang #{gangId}
                    </span>
                </div>
            </div>
        </div>
    );
};
