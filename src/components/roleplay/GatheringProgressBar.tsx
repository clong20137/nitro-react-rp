import { useEffect, useRef, useState } from "react";
import "./GatherProgressView.scss";

export const GatheringProgressBar = () => {
    const [visible, setVisible] = useState(false);
    const [durationMs, setDurationMs] = useState(60000);
    const [animKey, setAnimKey] = useState(0); // bump to restart CSS animation

    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHideTimer = () => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    useEffect(() => {
        const handleStart = (e: any) => {
            const raw = e?.detail?.duration;
            const dur =
                typeof raw === "number"
                    ? raw
                    : raw != null
                    ? parseInt(String(raw), 10)
                    : NaN;

            if (!Number.isFinite(dur) || dur <= 0) return;

            clearHideTimer();
            setDurationMs(dur);
            setVisible(true);

            // bump the key to force the CSS animation to restart from 0%
            setAnimKey((k) => (k + 1) & 0xffff);

            // hard stop (and hide) at the end of duration
            hideTimerRef.current = setTimeout(() => {
                setVisible(false);
            }, dur);
        };

        const handleCancel = () => {
            clearHideTimer();
            // hide immediately and bump key so if we start again, it restarts from 0
            setVisible(false);
            setAnimKey((k) => (k + 1) & 0xffff);
        };

        window.addEventListener("gather_progress", handleStart);
        window.addEventListener("gather_cancel", handleCancel);

        return () => {
            window.removeEventListener("gather_progress", handleStart);
            window.removeEventListener("gather_cancel", handleCancel);
            clearHideTimer();
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="gathering-bar-horizontal-wrapper">
            {/* key forces animation restart; CSS var sets duration */}
            <div
                key={animKey}
                className="gathering-bar-horizontal"
                style={{ ["--gather-dur" as any]: `${durationMs}ms` }}
            />
        </div>
    );
};
