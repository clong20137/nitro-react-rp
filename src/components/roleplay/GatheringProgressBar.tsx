import { useEffect, useRef, useState } from "react";
import "./GatherProgressView.scss";

export const GatheringProgressBar = () => {
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        let start = 0;
        let duration = 60000;

        const handleGatherStart = (e: any) => {
            if (typeof e.detail?.duration === "number")
                duration = e.detail.duration;
            else return; // or optionally log a warning
            start = performance.now();
            setProgress(0);
            setVisible(true);

            const animate = (now: number) => {
                const elapsed = now - start;
                const pct = Math.min((elapsed / duration) * 100, 100);
                setProgress(pct);

                if (elapsed < duration) {
                    intervalRef.current = requestAnimationFrame(animate);
                } else {
                    intervalRef.current = null;
                    setVisible(false);
                }
            };

            if (intervalRef.current) cancelAnimationFrame(intervalRef.current);
            intervalRef.current = requestAnimationFrame(animate);
        };

        const handleGatherCancel = () => {
            if (intervalRef.current) {
                cancelAnimationFrame(intervalRef.current);
                intervalRef.current = null;
            }
            setVisible(false); // <== instantly hides bar
            setProgress(0);
        };

        window.addEventListener("gather_progress", handleGatherStart);
        window.addEventListener("gather_cancel", handleGatherCancel);

        return () => {
            window.removeEventListener("gather_progress", handleGatherStart);
            window.removeEventListener("gather_cancel", handleGatherCancel);
            if (intervalRef.current) cancelAnimationFrame(intervalRef.current);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="gathering-bar-vertical-wrapper">
            <div
                className="gathering-bar-vertical"
                style={{ height: `${progress}%` }}
            />
        </div>
    );
};
