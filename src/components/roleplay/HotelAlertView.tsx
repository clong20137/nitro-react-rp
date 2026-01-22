import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./HotelAlertView.scss";

type AlertPayload = {
    message: string;
    icon?: string;
    soundUrl?: string;
    title?: string;
    variant?: "info" | "success" | "warning" | "danger";
    sticky?: boolean;
    durationMs?: number;
};

type AlertItem = {
    id: number;
    message: string;
    icon?: string;
    soundUrl?: string;
    title?: string;
    variant?: "info" | "success" | "warning" | "danger";
    sticky?: boolean;
    durationMs?: number;
};

const DEFAULT_TITLE = "Announcement";
const DEFAULT_ICON = "../../icons/alert.png";
const DEFAULT_SOUND = "../../icons/audio/ping.mp3";

const DEFAULT_DURATION = 15000; // 15 seconds
const MAX_VISIBLE = 3;

export const HotelAlertView: FC = () => {
    const [queue, setQueue] = useState<AlertItem[]>([]);
    const idRef = useRef(1);

    // Listen for bridge events
    useEffect(() => {
        const onHotelAlert = (e: Event) => {
            const ce = e as CustomEvent<AlertPayload>;
            const payload = ce?.detail;
            if (!payload?.message) return;

            setQueue((prev) => [
                ...prev,
                {
                    id: idRef.current++,
                    message: payload.message,
                    icon: payload.icon,
                    soundUrl: payload.soundUrl,
                    title: payload.title,
                    variant: payload.variant || "info",
                    sticky: payload.sticky || false,
                    durationMs: payload.durationMs,
                },
            ]);
        };

        window.addEventListener("hotel_alert", onHotelAlert as EventListener);
        return () =>
            window.removeEventListener(
                "hotel_alert",
                onHotelAlert as EventListener
            );
    }, []);

    // Play sound when new items appear (debounced to newest)
    const lastPlayedRef = useRef<number>(0);
    useEffect(() => {
        if (!queue.length) return;
        const newest = queue[queue.length - 1];
        if (newest.id === lastPlayedRef.current) return;

        try {
            const audio = new Audio(newest.soundUrl || DEFAULT_SOUND);
            audio.volume = 0.85;
            audio.play().catch(() => {});
        } catch {}
        lastPlayedRef.current = newest.id;
    }, [queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // Dismiss helper
    const dismiss = (id: number) => {
        setQueue((prev) => prev.filter((a) => a.id !== id));
    };

    // Only render up to MAX_VISIBLE, newest on top
    const visible = useMemo(() => {
        const last = queue.slice(-MAX_VISIBLE);
        return last.reverse(); // stack downward; newest at the top
    }, [queue]);

    return (
        <div className="hotel-toast-region" aria-live="polite" role="status">
            {visible.map((a, index) => {
                const duration = a.sticky
                    ? undefined
                    : a.durationMs ?? DEFAULT_DURATION;
                return (
                    <Toast
                        key={a.id}
                        alert={a}
                        index={index}
                        duration={duration}
                        onClose={() => dismiss(a.id)}
                    />
                );
            })}
        </div>
    );
};

/** Single Toast */
const Toast: FC<{
    alert: AlertItem;
    index: number;
    duration?: number;
    onClose: () => void;
}> = ({ alert, index, duration, onClose }) => {
    const timerRef = useRef<number | null>(null);
    const elRef = useRef<HTMLDivElement | null>(null);
    const [leaving, setLeaving] = useState(false);

    const handleClose = useCallback(() => {
        if (leaving) return;
        setLeaving(true);
        // Give time for slide-up animation
        window.setTimeout(onClose, 180);
    }, [leaving, onClose]);

    // Auto-dismiss
    useEffect(() => {
        if (!duration) return;
        timerRef.current = window.setTimeout(handleClose, duration);
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
        };
    }, [duration, handleClose]);

    // Escape to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleClose]);

    // Pause on hover
    const pause = () => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
            elRef.current?.classList.add("paused");
        }
    };
    const resume = () => {
        if (timerRef.current || !duration || leaving) return;
        elRef.current?.classList.remove("paused");
        timerRef.current = window.setTimeout(handleClose, 1200); // small grace
    };

    const title = alert.title || DEFAULT_TITLE;

    return (
        <div
            ref={elRef}
            className={`hotel-toast variant-${alert.variant || "info"} ${
                leaving ? "hotel-toast--leaving" : ""
            }`}
            style={{ ["--delay-index" as any]: index }}
            onMouseEnter={pause}
            onMouseLeave={resume}
            onClick={handleClose}
            role="alert"
            aria-label={title}
        >
            {/* Close button in top-right */}
            <button
                className="hotel-toast__close"
                aria-label="Close hotel alert"
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
            >
                ×
            </button>

            {/* Header row: icon + title, vertically centered */}
            <div className="hotel-toast__header">
                <div className="hotel-toast__icon">
                    <img src={alert.icon || DEFAULT_ICON} alt="" />
                </div>
                <div className="hotel-toast__title">{title}</div>
            </div>

            {/* Message full width under header */}
            <div className="hotel-toast__message">{alert.message}</div>

            {!!duration && (
                <div
                    className="hotel-toast__progress"
                    style={{ animationDuration: `${duration}ms` }}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};
