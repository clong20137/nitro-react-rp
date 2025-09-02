import { useEffect, useRef, useState } from "react";
import "./GatherProgressView.scss";

type GatherEvt = CustomEvent<{ duration: number }>;

export const GatheringProgressBar = () => {
    const [progress, setProgress] = useState(0); // 0..100
    const [visible, setVisible] = useState(false);
    const rafRef = useRef<number | null>(null);
    const runIdRef = useRef(0); // prevents overlap glitches

    useEffect(() => {
        const startAnim = (duration: number) => {
            // reject silly values
            const dur = Math.max(50, Number(duration) || 0);
            const start = performance.now();
            const myRunId = ++runIdRef.current;

            setProgress(0);
            setVisible(true);

            const tick = (now: number) => {
                // if a newer run started, stop this one
                if (myRunId !== runIdRef.current) return;

                const elapsed = now - start;
                const pct = Math.min((elapsed / dur) * 100, 100);
                setProgress(pct);

                if (pct < 100) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    rafRef.current = null;
                    setVisible(false);
                }
            };

            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(tick);
        };

        const onGatherProgress = (e: Event) => {
            const detail = (e as GatherEvt).detail;
            if (!detail || typeof detail.duration !== "number") return;
            startAnim(detail.duration);
        };

        const onGatherCancel = () => {
            runIdRef.current++; // invalidate any running animation
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            setVisible(false);
            setProgress(0);
        };

        window.addEventListener(
            "gather_progress",
            onGatherProgress as EventListener
        );
        window.addEventListener("gather_cancel", onGatherCancel);

        return () => {
            window.removeEventListener(
                "gather_progress",
                onGatherProgress as EventListener
            );
            window.removeEventListener("gather_cancel", onGatherCancel);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="gathering-bar-horizontal-wrapper">
            <div
                className="gathering-bar-horizontal"
                // ✅ HORIZONTAL bars animate WIDTH, not height
                style={{ width: `${progress}%` }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                role="progressbar"
            />
        </div>
    );
};
