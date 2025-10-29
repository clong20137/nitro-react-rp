import { FC, useEffect, useMemo, useRef, useState } from "react";
import { GetSessionDataManager } from "../../api";
import { LayoutAvatarImageView } from "../../common";
import "./XpGainPopup.scss";

type Props = {
    amount: number;
    percent?: number;
    gained?: number;
    needed?: number;
    /** total lifetime; drives CSS via --xp-duration */
    durationMs?: number; // default 5000
    figure?: string;
    onDone?: () => void;
};

type Particle = {
    id: number;
    style: React.CSSProperties;
};

export const XPGainPopup: FC<Props> = ({
    amount,
    percent,
    gained,
    needed,
    durationMs = 6000,
    figure = GetSessionDataManager()?.figure ?? "",
    onDone,
}) => {
    const [visible, setVisible] = useState(true);
    const [particles, setParticles] = useState<Particle[]>([]);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // --- progress math for ring ---
    const size = 58;
    const stroke = 6;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;

    const progress = useMemo(() => {
        if (typeof percent === "number")
            return Math.max(0, Math.min(1, percent / 100));
        if (
            typeof gained === "number" &&
            typeof needed === "number" &&
            needed > 0
        ) {
            return Math.max(0, Math.min(1, gained / needed));
        }
        return 0.6;
    }, [percent, gained, needed]);

    const [dashOffset, setDashOffset] = useState(c);

    // Animate ring on mount / when progress changes
    useEffect(() => {
        const raf = requestAnimationFrame(() =>
            setDashOffset(c * (1 - progress))
        );
        return () => cancelAnimationFrame(raf);
    }, [c, progress]);

    // Spawn a burst of particles on mount
    useEffect(() => {
        const COUNT = 10; // tweak for more/less sparks
        const list: Particle[] = [];
        for (let i = 0; i < COUNT; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = 28 + Math.random() * 26; // px
            const tx = Math.cos(ang) * dist;
            const ty = -Math.abs(Math.sin(ang) * dist); // bias upward
            const delay = Math.random() * 180; // ms
            const scale = 0.7 + Math.random() * 0.8;

            list.push({
                id: i,
                style: {
                    // CSS custom props used by the keyframes
                    // @ts-ignore
                    "--tx": `${tx}px`,
                    "--ty": `${ty}px`,
                    "--p-delay": `${delay}ms`,
                    "--p-scale": scale,
                    left: "50%",
                    top: "50%",
                } as React.CSSProperties,
            });
        }
        setParticles(list);
    }, []);

    // End-of-life: listen for the container animation and also set a fallback timeout
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;

        const done = () => {
            setVisible(false);
            onDone?.();
        };

        const onEnd = (e: AnimationEvent) => {
            if (e.animationName === "xp-float") done();
        };

        el.addEventListener("animationend", onEnd as any);

        // Fallback in case animationend doesn’t fire (tab hidden, etc.)
        const t = window.setTimeout(done, durationMs + 150);

        return () => {
            el.removeEventListener("animationend", onEnd as any);
            clearTimeout(t);
        };
    }, [durationMs, onDone]);

    if (!visible) return null;

    return (
        <div
            ref={rootRef}
            className="xp-gain-popup"
            role="status"
            aria-live="polite"
            style={{ ["--xp-duration" as any]: `${durationMs}ms` }}
        >
            <div className="xp-ring">
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    aria-hidden
                >
                    <defs>
                        <linearGradient id="xpGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#3fd37b" />
                            <stop offset="100%" stopColor="#23a85a" />
                        </linearGradient>
                    </defs>

                    <circle
                        className="ring-bg"
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        strokeWidth={stroke}
                    />

                    <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                        <circle
                            className="ring-fg"
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            strokeWidth={stroke}
                            strokeDasharray={c}
                            strokeDashoffset={dashOffset}
                        />
                    </g>
                </svg>

                <div className="xp-avatar">
                    <LayoutAvatarImageView figure={figure} direction={2} />
                </div>

                {/* sparkle burst */}
                {particles.map((p) => (
                    <span className="particle" key={p.id} style={p.style} />
                ))}
            </div>

            <div className="xp-meta">
                <div className="xp-amount">+{amount} XP</div>
            </div>
        </div>
    );
};

export default XPGainPopup;
