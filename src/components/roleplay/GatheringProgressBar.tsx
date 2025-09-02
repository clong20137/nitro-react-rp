import { useEffect, useRef, useState } from "react";
import "./GatherProgressView.scss";

export const GatheringProgressBar = () => {
    const [progress, setProgress] = useState(0); // 0..100
    const [visible, setVisible] = useState(false);

    // animation / clock refs
    const rafRef = useRef<number | null>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startRef = useRef<number>(0);
    const durationRef = useRef<number>(60000);

    // ensure clean stop
    const stopTimers = () => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
        }
    };

    useEffect(() => {
        const animate = () => {
            const now = performance.now();
            const elapsed = now - startRef.current;
            const pct = Math.max(
                0,
                Math.min((elapsed / durationRef.current) * 100, 100)
            );
            setProgress(pct);

            if (elapsed < durationRef.current) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                stopTimers();
                setVisible(false);
                setProgress(0);
            }
        };

        const tick = () => {
            // keep progress advancing even if rAF is throttled
            const now = performance.now();
            const elapsed = now - startRef.current;
            const pct = Math.max(
                0,
                Math.min((elapsed / durationRef.current) * 100, 100)
            );
            setProgress(pct);
            if (elapsed >= durationRef.current) {
                stopTimers();
                setVisible(false);
                setProgress(0);
            }
        };

        const handleStart = (e: any) => {
            const raw = e?.detail?.duration;
            const dur = typeof raw === "number" ? raw : parseInt(raw, 10);
            if (!Number.isFinite(dur) || dur <= 0) return;

            durationRef.current = dur;
            startRef.current = performance.now();

            stopTimers();
            setProgress(0);
            setVisible(true);

            // kick both: rAF for smoothness, interval as “anti-throttle” heartbeat
            rafRef.current = requestAnimationFrame(animate);
            tickRef.current = setInterval(tick, 100);
        };

        const handleCancel = () => {
            stopTimers();
            setVisible(false);
            setProgress(0);
        };

        // listen to your client events (fired when 4012 arrives)
        window.addEventListener("gather_progress", handleStart);
        window.addEventListener("gather_cancel", handleCancel);

        return () => {
            window.removeEventListener("gather_progress", handleStart);
            window.removeEventListener("gather_cancel", handleCancel);
            stopTimers();
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="gathering-bar-horizontal-wrapper">
            <div
                className="gathering-bar-horizontal"
                style={{ width: `${progress}%` }} // horizontal fill
            />
        </div>
    );
};
