import { useEffect, useRef, useState } from "react";
import "./GatherProgressView.scss";

export const GatheringProgressBar = () => {
    const [visible, setVisible] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);
    const [durationMs, setDurationMs] = useState(30000);
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [label, setLabel] = useState<string>("Gathering...");
    const [animKey, setAnimKey] = useState(0);
    const [remainingMs, setRemainingMs] = useState(0);

    const startAtRef = useRef<number>(0);
    const endAtRef = useRef<number>(0); // NEW: source of truth for end time
    const rafRef = useRef<number | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopRAF = () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };
    const clearHideTimer = () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
    };

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const remain = Math.max(0, endAtRef.current - now); // <- uses refs, not state
            setRemainingMs(remain);
            if (remain > 0) rafRef.current = requestAnimationFrame(tick);
        };

        const handleStart = (e: Event) => {
            const d: any = (e as CustomEvent).detail || {};
            const dur = Number(d.durationMs ?? d.duration);
            const icon = d.icon || null;
            const name = d.name || "Gathering...";
            if (!Number.isFinite(dur) || dur <= 0) return;

            clearHideTimer();
            stopRAF();

            setDurationMs(dur); // still used for the CSS animation var
            setIconUrl(icon);
            setLabel(name);
            setFadingOut(false);
            setVisible(true);

            requestAnimationFrame(() => {
                setAnimKey((k) => (k + 1) & 0xffff);

                const now = performance.now();
                startAtRef.current = now;
                endAtRef.current = now + dur; // <- set precise end time for this gather
                setRemainingMs(dur);

                rafRef.current = requestAnimationFrame(tick);

                hideTimerRef.current = setTimeout(() => {
                    setFadingOut(true);
                    setTimeout(() => {
                        setVisible(false);
                        stopRAF();
                    }, 350); // match your fade duration
                }, dur); // <- use the event's dur directly
            });
        };

        const handleCancel = () => {
            clearHideTimer();
            stopRAF();
            setFadingOut(true);
            setTimeout(() => setVisible(false), 350);
            setRemainingMs(0);
        };

        // Register once; handlers rely on refs, not state
        window.addEventListener(
            "gather_progress",
            handleStart as EventListener
        );
        window.addEventListener("gather_cancel", handleCancel);

        return () => {
            window.removeEventListener(
                "gather_progress",
                handleStart as EventListener
            );
            window.removeEventListener("gather_cancel", handleCancel);
            clearHideTimer();
            stopRAF();
        };
    }, []); // <-- IMPORTANT: no durationMs dependency

    if (!visible) return null;
    const seconds = Math.ceil((remainingMs + 100) / 1000);

    return (
        <div
            className={`gathering-bar-horizontal-wrapper ${
                fadingOut ? "fade-out" : "fade-in"
            }`}
            key={animKey}
            style={{ ["--gather-dur" as any]: `${durationMs}ms` }} // CSS anim stays correct
            role="status"
            aria-live="polite"
            aria-label={`${label}, ${seconds} seconds remaining`}
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
                <div className="gathering-bar-horizontal" />
            </div>

            <div className="gathering-count">{seconds}s</div>
        </div>
    );
};
