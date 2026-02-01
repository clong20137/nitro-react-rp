import { useEffect, useRef, useState } from "react";
import "./CombatCooldownView.scss";

type CombatCooldownDetail = {
    weaponType: number;
    totalMs: number;
    remainingMs: number;
};

const COOLDOWN_ICON = "/icons/punch_cooldown.png";

export const CombatCooldownView = () => {
    const [durationMs, setDurationMs] = useState(0);
    const [remainingMs, setRemainingMs] = useState(0);

    const endAtRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    // prevents spam-resetting while already cooling down
    const coolingRef = useRef(false);

    const stopRAF = () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const remain = Math.max(0, endAtRef.current - now);

            setRemainingMs(remain);

            if (remain > 0) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                coolingRef.current = false;
                stopRAF();
            }
        };

        const handleCooldown = (event: Event) => {
            const data = (event as CustomEvent).detail as CombatCooldownDetail;
            if (!data) return;

            // ignore packets while already cooling
            if (coolingRef.current) return;

            const remain = Math.max(0, Number(data.remainingMs ?? 0));
            if (!Number.isFinite(remain) || remain <= 0) return;

            coolingRef.current = true;

            const now = performance.now();
            setDurationMs(remain);
            setRemainingMs(remain);
            endAtRef.current = now + remain;

            stopRAF();
            rafRef.current = requestAnimationFrame(tick);
        };

        window.addEventListener(
            "combat_cooldown",
            handleCooldown as EventListener
        );

        return () => {
            window.removeEventListener(
                "combat_cooldown",
                handleCooldown as EventListener
            );
            stopRAF();
        };
    }, []);

    const isReady = remainingMs <= 0;

    // Radial math (no hooks)
    const radius = 22;
    const stroke = 5;
    const size = 60;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    // fill as time drains
    const progress =
        durationMs > 0
            ? Math.min(1, Math.max(0, 1 - remainingMs / durationMs))
            : 1;

    const dashOffset = circumference * (1 - progress);

    const seconds = Math.max(0, Math.ceil((remainingMs + 100) / 1000));

    return (
        <div className={`combat-cd-radial ${isReady ? "ready" : "cooling"}`}>
            <div className="combat-cd-wheel" aria-hidden>
                <svg
                    className="combat-cd-svg"
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                >
                    <circle
                        className="combat-cd-track"
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                    />
                    <circle
                        className="combat-cd-progress"
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                    />
                </svg>

                <div className="combat-cd-icon">
                    <img
                        src={COOLDOWN_ICON}
                        alt=""
                        draggable={false}
                        onError={(e) => {
                            // this will NOT crash your app; it just swaps fallback
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = "/icons/placeholder.png";
                        }}
                    />
                </div>
            </div>

            <div className="combat-cd-text">
                <div className="combat-cd-title">Attack</div>
                <div className="combat-cd-sub">
                    {isReady ? "READY" : `${seconds}s`}
                </div>
            </div>
        </div>
    );
};
