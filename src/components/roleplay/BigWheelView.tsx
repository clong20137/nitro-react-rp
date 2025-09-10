import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import "./BigWheelView.scss";

import { SendMessageComposer } from "../../api";
import { WheelSpinComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/WheelSpinComposer";

type WheelStateMsg = {
    state: "SPINNING" | "IDLE";
    landedIndex: number;
    landedFace: string;
    win: number;
    betAmount: number;
    betFace: string;
    faces: string[];
};

const FACES_TO_COLOR: Record<string, string> = {
    "1": "#f4f4f4",
    "2": "#a8e6ff",
    "5": "#ffe8a1",
    "10": "#c4ffa8",
    "20": "#ffb3b3",
};

export const BigWheelView: FC = () => {
    const [open, setOpen] = useState(true);
    const [faces, setFaces] = useState<string[]>([]);
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0); // deg
    const [betFace, setBetFace] = useState<"1" | "2" | "5" | "10" | "20">("1");
    const [amount, setAmount] = useState(5);
    const [lastWin, setLastWin] = useState(0);

    const SEGMENTS = faces.length || 54;
    const perSegment = 360 / SEGMENTS;

    // listen for server state
    useEffect(() => {
        const onState = (e: Event) => {
            const s = (e as CustomEvent<WheelStateMsg>).detail;
            if (!s) return;

            if (s.faces && s.faces.length) setFaces(s.faces);

            if (s.state === "SPINNING") {
                setSpinning(true);
                setLastWin(0);
                // start from current rotation; we’ll later add the result rotation
                return;
            }

            // result: rotate wheel so the wedge s.landedIndex ends at 0deg under the pointer
            const targetIndex = s.landedIndex ?? 0;
            const baseTurns = 6 * 360; // many full spins
            const targetAngle =
                baseTurns + (360 - targetIndex * perSegment - perSegment / 2);
            setRotation((prev) => prev + targetAngle);
            setTimeout(() => {
                setSpinning(false);
                setLastWin(s.win || 0);
            }, 10); // unlock after applying rotation
        };

        window.addEventListener("bigwheel_state", onState as EventListener);
        return () =>
            window.removeEventListener(
                "bigwheel_state",
                onState as EventListener
            );
    }, [perSegment]);

    const onSpin = () => {
        if (spinning) return;
        setSpinning(true);
        SendMessageComposer(
            new WheelSpinComposer(betFace, Math.max(1, Math.round(amount)))
        );
    };

    return !open ? null : (
        <div className="bw-root">
            <div className="bw-card">
                <div className="bw-header">
                    <span>Big Wheel</span>
                    <button className="btn grey" onClick={() => setOpen(false)}>
                        ✕
                    </button>
                </div>

                <div className="bw-stage">
                    <div className="bw-pointer" />
                    <svg
                        className={`bw-wheel ${spinning ? "spinning" : ""}`}
                        viewBox="0 0 100 100"
                        style={{ transform: `rotate(${rotation}deg)` }}
                    >
                        {/* wedges */}
                        {Array.from({ length: SEGMENTS }).map((_, i) => {
                            const start = (i * perSegment * Math.PI) / 180;
                            const end = ((i + 1) * perSegment * Math.PI) / 180;
                            const large = end - start > Math.PI ? 1 : 0;
                            const x1 = 50 + 50 * Math.cos(start),
                                y1 = 50 + 50 * Math.sin(start);
                            const x2 = 50 + 50 * Math.cos(end),
                                y2 = 50 + 50 * Math.sin(end);
                            const f = faces[i % (faces.length || 1)] || "1";
                            const fill = FACES_TO_COLOR[f] || "#eee";
                            return (
                                <path
                                    key={i}
                                    d={`M50,50 L${x1},${y1} A50,50 0 ${large} 1 ${x2},${y2} z`}
                                    fill={fill}
                                    stroke="#222"
                                    strokeWidth="0.4"
                                />
                            );
                        })}
                        {/* hub */}
                        <circle
                            cx="50"
                            cy="50"
                            r="8"
                            fill="#333"
                            stroke="#000"
                        />
                    </svg>
                </div>

                <div className={`bw-win ${lastWin > 0 ? "show" : ""}`}>
                    {lastWin > 0 ? `You won +${lastWin} credits!` : "\u00A0"}
                </div>

                <div className="bw-controls">
                    <div className="faces">
                        {(["1", "2", "5", "10", "20"] as const).map((f) => (
                            <button
                                key={f}
                                className={`chip ${betFace === f ? "sel" : ""}`}
                                onClick={() => setBetFace(f as any)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="amount">
                        <span>Bet</span>
                        <input
                            type="number"
                            min={1}
                            max={5000}
                            value={amount}
                            onChange={(e) =>
                                setAmount(
                                    Math.max(
                                        1,
                                        parseInt(e.target.value || "1", 10)
                                    )
                                )
                            }
                        />
                    </div>
                    <button
                        className="btn yellow big"
                        onClick={onSpin}
                        disabled={spinning}
                    >
                        {spinning ? "Spinning…" : "Spin"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BigWheelView;

/* hard mount (optional) */
(() => {
    const W = window as any;
    if (W.__BIGWHEEL_MOUNTED__) return;
    W.__BIGWHEEL_MOUNTED__ = true;

    const id = "olrp-bigwheel-root";
    let host = document.getElementById(id);
    if (!host) {
        host = document.createElement("div");
        host.id = id;
        document.body.appendChild(host);
    }
    const root: Root = createRoot(host);
    root.render(<BigWheelView />);
})();
