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

export const XPGainPopup: FC<Props> = ({
    amount,
    percent,
    gained,
    needed,
    durationMs = 5000,
    figure = GetSessionDataManager()?.figure ?? "",
    onDone,
}) => {
    const [visible, setVisible] = useState(true);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // ring math
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
        )
            return Math.max(0, Math.min(1, gained / needed));
        return 0.6;
    }, [percent, gained, needed]);

    const [dashOffset, setDashOffset] = useState(c);

    // animate ring
    useEffect(() => {
        const raf = requestAnimationFrame(() =>
            setDashOffset(c * (1 - progress))
        );
        return () => cancelAnimationFrame(raf);
    }, [c, progress]);

    // unmount only after fade animation ends
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const onEnd = (e: AnimationEvent) => {
            if (e.animationName === "xp-float") {
                // our fade/float animation
                setVisible(false);
                onDone?.();
            }
        };
        el.addEventListener("animationend", onEnd as any);
        return () => el.removeEventListener("animationend", onEnd as any);
    }, [onDone]);

    if (!visible) return null;

    return (
        <div
            ref={rootRef}
            className="xp-gain-popup"
            role="status"
            aria-live="polite"
            style={{ ["--xp-duration" as any]: `${durationMs}ms` }} // pass duration to CSS
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
            </div>

            <div className="xp-meta">
                <div className="xp-amount">+{amount} XP</div>
            </div>
        </div>
    );
};
