import { useEffect, useRef, useState } from "react";
import "./GatherProgressView.scss";

/**
 * Start:
 * window.dispatchEvent(new CustomEvent('gather_progress', {
 * detail: { duration: 4500, icon: '/assets/items/wood.png', name: 'Chopping tree' }
 * }));
 * Cancel:
 * window.dispatchEvent(new Event('gather_cancel'));
 */
export const GatheringProgressBar = () => {
    const [visible, setVisible] = useState(false);
    const [durationMs, setDurationMs] = useState(30000);
    const [animKey, setAnimKey] = useState(0); // restart animation
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [label, setLabel] = useState<string>("Interacting with item..");

    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHideTimer = () => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    useEffect(() => {
        const handleStart = (e: any) => {
            const d = e?.detail ?? {};
            const raw = d.duration;
            const dur =
                typeof raw === "number"
                    ? raw
                    : raw != null
                    ? parseInt(String(raw), 10)
                    : NaN;

            if (!Number.isFinite(dur) || dur <= 0) return;

            clearHideTimer();
            setDurationMs(dur);
            setIconUrl(d.icon || null);
            setLabel(d.name || "Interacting with item..");
            setVisible(true);

            // force the CSS animation to restart from 0
            setAnimKey((k) => (k + 1) & 0xffff);

            hideTimerRef.current = setTimeout(() => setVisible(false), dur);
        };

        const handleCancel = () => {
            clearHideTimer();
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
        <div
            className="gathering-bar-horizontal-wrapper"
            key={animKey}
            style={{ ["--gather-dur" as any]: `${durationMs}ms` }}
        >
            <div className="gathering-icon" aria-hidden>
                {iconUrl ? (
                    <img src={iconUrl} alt="" />
                ) : (
                    <span className="placeholder">★</span>
                )}
            </div>

            <div className="gathering-content">
                <div className="gathering-label" title={label}>
                    {label}
                </div>
                {/* Track – the animated fill is the ::before pseudo-element */}
                <div className="gathering-bar-horizontal" />
            </div>
        </div>
    );
};
