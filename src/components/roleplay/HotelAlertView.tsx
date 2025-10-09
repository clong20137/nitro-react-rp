import { FC, useEffect, useRef, useState } from "react";
import "./HotelAlertView.scss";

type AlertPayload = {
    message: string;
    icon?: string; // optional: URL to an icon image
    soundUrl?: string; // optional: URL to an audio file (mp3/ogg/wav)
    title?: string; // optional: override title text
};

type AlertItem = { id: number } & Required<Pick<AlertPayload, "message">> & {
        icon?: string;
        soundUrl?: string;
        title?: string;
    };

const DISPLAY_MS = 10000; // how long each alert stays visible
const ALERT_SOUND_URL = "../../icons/audio/ping.mp3";
const DEFAULT_TITLE = "Important Message";
const DEFAULT_ICON = "../../icons/alert.gif";

export const HotelAlertView: FC = () => {
    const [queue, setQueue] = useState<AlertItem[]>([]);
    const [current, setCurrent] = useState<AlertItem | null>(null);
    const timerRef = useRef<number | null>(null);
    const idRef = useRef(1);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // listen for alerts dispatched by the bridge
    useEffect(() => {
        const onHotelAlert = (e: Event) => {
            const ce = e as CustomEvent<AlertPayload>;
            if (!ce?.detail?.message) return;

            const { message, icon, soundUrl, title } = ce.detail;

            setQueue((prev) => [
                ...prev,
                {
                    id: idRef.current++,
                    message,
                    icon,
                    soundUrl,
                    title,
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

    // pop next from queue when nothing is shown
    useEffect(() => {
        if (!current && queue.length > 0) {
            setCurrent(queue[0]);
            setQueue((prev) => prev.slice(1));
        }
    }, [queue, current]);
    // auto-dismiss current
    useEffect(() => {
        if (!current) return;

        // 🔊 play sound when new alert becomes active
        try {
            const audio = new Audio(ALERT_SOUND_URL);
            audio.play().catch(() => {
                console.warn(
                    "Unable to autoplay alert sound (browser blocked)."
                );
            });
        } catch (e) {
            console.error("Error playing alert sound:", e);
        }

        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
            dismiss();
        }, DISPLAY_MS);

        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
        };
    }, [current]);

    const dismiss = () => {
        const el = document.querySelector(".hotel-alert");
        if (el) el.classList.add("out");
        window.setTimeout(() => setCurrent(null), 250); // matches CSS transition
    };

    if (!current) return null;

    return (
        <div className="hotel-alert-container" aria-live="polite" role="status">
            <div className="hotel-alert" onClick={dismiss}>
               
                <div className="hotel-alert__content">
                    <div className="hotel-alert__title">
                        {current.title || DEFAULT_TITLE}
                    </div>
                    <div className="hotel-alert__message">
                        {current.message}
                    </div>
                </div>

                <button
                    className="hotel-alert__close"
                    aria-label="Close hotel alert"
                    onClick={(e) => {
                        e.stopPropagation();
                        dismiss();
                    }}
                >
                    ×
                </button>
            </div>
        </div>
    );
};
