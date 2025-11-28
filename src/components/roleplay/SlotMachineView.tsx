import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import "./SlotMachineView.scss";

/* composers */
import { SendMessageComposer } from "../../api";
import { SlotMachineLeaveComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SlotMachineLeaveComposer";
import { SlotSpinComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SlotSpinComposer";

const leave = () => SendMessageComposer(new SlotMachineLeaveComposer());
const spin = (bet: number) => SendMessageComposer(new SlotSpinComposer(bet));

/* sprites */
const ICON_BASE = "/icons/slots/";
const SYMBOLS: string[] = [
    ICON_BASE + "sack.gif", // 0
    ICON_BASE + "7.gif", // 1
    ICON_BASE + "clover.gif", // 2
    ICON_BASE + "banana.gif", // 3
    ICON_BASE + "lemon.gif", // 4
    ICON_BASE + "diamond.gif", // 5
    ICON_BASE + "w.gif", // 6
    ICON_BASE + "cube.gif", // 7
];

/* types */
type SlotModuleOpen = {
    hasInfo: boolean;
    minBet: number;
    maxBet: number;
    reels: number;
};

type SlotStateMsg = {
    state: "IDLE" | "SPINNING" | "ENDED";
    reels?: number;
    stops?: number[];
    win?: number;
    bet?: number;
    messages?: Array<{ text: string; level: "info" | "warn" | "error" }>;
};

const buildStrip = (symbols: string[], repeat = 20) =>
    Array.from({ length: repeat }).flatMap(() => symbols);

/* --- helper: compute which reels should pulse --- */
function computeWinMask(stops: number[]): boolean[] {
    // Only 3 reels are supported by the default UI; if more, pulse triples only.
    const n = stops.length;
    if (n < 2) return Array(n).fill(false);

    if (n >= 3) {
        const [a, b, c] = [stops[0], stops[1], stops[2]];
        if (a === b && b === c) return [true, true, true];
        if (a === b) return [true, true, false];
        if (a === c) return [true, false, true];
        if (b === c) return [false, true, true];
        return [false, false, false];
    }

    // Fallback for 2 reels (not typical)
    return [stops[0] === stops[1], stops[0] === stops[1]];
}

export const SlotMachineView: FC = () => {
    const [open, setOpen] = useState(false);

    const [minBet, setMinBet] = useState(5);
    const [maxBet, setMaxBet] = useState(25);
    const [nReels, setNReels] = useState(3);

    const [bet, setBet] = useState(5);
    const [spinning, setSpinning] = useState(false);
    const [stops, setStops] = useState<number[]>([]);
    const [lastWin, setLastWin] = useState(0);
    const [toasts, setToasts] = useState<
        Array<{ id: number; text: string; level: string }>
    >([]);

    const [reelDone, setReelDone] = useState<boolean[]>([]);
    const [winMask, setWinMask] = useState<boolean[]>([]);

    const rootRef = useRef<HTMLDivElement>(null);

    /* ---- DRAG STATE ---- */
    const [position, setPosition] = useState<{ x: number; y: number } | null>(
        null
    );
    const [dragging, setDragging] = useState(false);

    // init position when opened
    useEffect(() => {
        if (!open) return;
        if (position !== null) return;

        const width = 580;
        const height = 360;
        const x = Math.max(10, (window.innerWidth - width) / 2);
        const y = Math.max(40, (window.innerHeight - height) / 2);

        setPosition({ x, y });
    }, [open, position]);

    const handleHeaderMouseDown = (
        e: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
        if (e.button !== 0) return;
        if (!rootRef.current) return;

        const rect = rootRef.current.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;

        const startPos = {
            x: position?.x ?? rect.left,
            y: position?.y ?? rect.top,
        };

        setDragging(true);

        const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            let nextX = startPos.x + dx;
            let nextY = startPos.y + dy;

            const margin = 20;
            const maxX = window.innerWidth - margin - rect.width;
            const maxY = window.innerHeight - margin - rect.height;

            if (nextX < margin) nextX = margin;
            if (nextY < margin) nextY = margin;
            if (nextX > maxX) nextX = maxX;
            if (nextY > maxY) nextY = maxY;

            setPosition({ x: nextX, y: nextY });
        };

        const onUp = () => {
            setDragging(false);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        e.preventDefault();
    };

    /* long strips */
    const strips = useMemo(() => {
        return Array.from({ length: Math.max(1, nReels) }).map(() =>
            buildStrip(SYMBOLS, 20)
        );
    }, [nReels]);

    /* event bridges */
    useEffect(() => {
        const W = window as any;
        if (!W.__SLOTS_LISTENERS__) {
            const onModule = (e: Event) => {
                const { detail } = e as CustomEvent<SlotModuleOpen>;
                const cfg = detail || {
                    hasInfo: true,
                    minBet: 5,
                    maxBet: 25,
                    reels: 3,
                };

                setOpen(true);

                // --- sanitize incoming min/max from server ---
                let min = typeof cfg.minBet === "number" ? cfg.minBet : 5;
                let max = typeof cfg.maxBet === "number" ? cfg.maxBet : 25;

                min = Math.round(min);
                max = Math.round(max);

                // enforce hard client bounds
                if (min < 5) min = 5;
                if (max > 25) max = 25;

                // if server sends invalid or reversed range, fall back to 5–25
                if (max < min) {
                    min = 5;
                    max = 25;
                }

                setMinBet(min);
                setMaxBet(max);
                setNReels(Math.max(1, cfg.reels ?? 3));

                // keep user's typed bet if it exists, otherwise clamp to range
                setBet((prev) => {
                    const raw = Number.isFinite(prev as number)
                        ? (prev as number)
                        : min;
                    const v = Math.round(raw);
                    return Math.min(Math.max(v, min), max);
                });

                setSpinning(false);
                setStops([]);
                setLastWin(0);
                setReelDone([]);
                setWinMask([]);
            };

            const onState = (e: Event) => {
                const { detail } = e as CustomEvent<SlotStateMsg>;
                const s = detail || { state: "IDLE" as const };

                if (typeof s.reels === "number" && s.reels > 0)
                    setNReels(s.reels);

                if (s.state === "SPINNING") {
                    setSpinning(true);
                    setLastWin(0);
                    setReelDone(
                        Array.from({ length: nReels }).map(() => false)
                    );
                    setWinMask([]); // clear old mask
                    return;
                }

                // Terminal/idle
                setSpinning(false);

                if (Array.isArray(s.stops)) {
                    const safeStops = s.stops.map((x) => {
                        const m = SYMBOLS.length;
                        return (((Number.isFinite(x) ? x : 0) % m) + m) % m;
                    });
                    setStops(safeStops);
                    setReelDone(
                        Array.from({ length: safeStops.length }).map(() => true)
                    );

                    // compute which reels won (for pulse)
                    const mask = computeWinMask(safeStops);
                    setWinMask(mask);
                } else {
                    setWinMask([]);
                }

                if (typeof s.win === "number") setLastWin(s.win);

                if (Array.isArray(s.messages) && s.messages.length) {
                    setToasts((ts) =>
                        [
                            {
                                id: Math.random(),
                                text: s.messages[0]!.text,
                                level: s.messages[0]!.level,
                            },
                            ...ts,
                        ].slice(0, 6)
                    );
                }
            };

            W.__SLOTS_LISTENERS__ = { onModule, onState };
            window.addEventListener(
                "slotmachine_module_result",
                onModule as EventListener
            );
            window.addEventListener(
                "slotmachine_state",
                onState as EventListener
            );
        }
    }, [nReels]);

    if (!open) return null;

    const clampBet = (v: number) => {
        // robust even if minBet/maxBet briefly get out of order
        const lo = Math.min(minBet, maxBet);
        const hi = Math.max(minBet, maxBet);
        return Math.min(Math.max(Math.round(v), lo), hi);
    };

    const adjustBet = (d: number) =>
        setBet((b) =>
            clampBet(
                (Number.isFinite(b as number) ? (b as number) : minBet) + d
            )
        );

    const onSpin = () => {
        if (spinning) return;
        const b = clampBet(bet); // uses what's currently typed
        setBet(b); // keep it in the box
        setSpinning(true);
        setReelDone(Array.from({ length: nReels }).map(() => false));
        setWinMask([]);
        try {
            spin(b);
        } catch {}
    };

    const onClose = () => {
        setOpen(false);
        try {
            leave();
        } catch {}
    };

    const CELL_H = 56;
    const VISIBLE_ROW = 3;

    const rootStyle: React.CSSProperties | undefined = position
        ? {
              left: position.x,
              top: position.y,
          }
        : undefined;

    return (
        <div className="slot-root" ref={rootRef} style={rootStyle}>
            <div
                className={
                    "slot-header" + (dragging ? " slot-header-grabbing" : "")
                }
                onMouseDown={handleHeaderMouseDown}
            >
                <span>Slots</span>

                {/* Close button styled like inventory view */}
                <button
                    className="inventory-close"
                    onClick={onClose}
                    aria-label="Close slots"
                    type="button"
                />
            </div>

            <div className="slot-body">
                {/* reels */}
                <div className="reels" data-reels={nReels}>
                    {strips.map((strip, i) => {
                        const stopIdx = (stops[i] ?? 0) % SYMBOLS.length;
                        const finalOffset = -((VISIBLE_ROW + stopIdx) * CELL_H);
                        const done = reelDone[i] || !spinning;
                        const isWinReel = !!winMask[i] && !spinning;

                        return (
                            <div
                                key={i}
                                className={`reel ${
                                    spinning && !done ? "spinning" : "stopped"
                                }`}
                                data-win={isWinReel ? "1" : "0"}
                                style={
                                    done
                                        ? ({
                                              ["--offset" as any]: `${finalOffset}px`,
                                          } as any)
                                        : undefined
                                }
                            >
                                {/* pulse overlay on the payline when this reel is part of the win */}
                                {isWinReel && <div className="pulse-ring" />}

                                <div className="tape">
                                    {strip.map((imgSrc, j) => (
                                        <div key={j} className="cell">
                                            <img
                                                src={imgSrc}
                                                alt=""
                                                className="sym-icon"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* payout banner */}
                <div className={`payout ${lastWin > 0 ? "show" : ""}`}>
                    {lastWin > 0 ? `You won +${lastWin} credits!` : "\u00A0"}
                </div>

                {/* controls */}
                <div className="controls">
                    <div className="betctrl">
                        <button
                            className="btn grey"
                            onClick={() => adjustBet(-1)}
                            disabled={spinning || bet <= minBet}
                        >
                            −
                        </button>
                        <div className="betbox">
                            <div className="label">Bet</div>
                            <input
                                type="number"
                                value={bet}
                                min={minBet}
                                max={maxBet}
                                onChange={(e) =>
                                    setBet(
                                        clampBet(
                                            parseInt(e.target.value || "0", 10)
                                        )
                                    )
                                }
                                disabled={spinning}
                            />
                            <div className="range">
                                ({minBet}–{maxBet})
                            </div>
                        </div>
                        <button
                            className="btn grey"
                            onClick={() => adjustBet(+1)}
                            disabled={spinning || bet >= maxBet}
                        >
                            ＋
                        </button>
                    </div>

                    <button
                        className="btn yellow big"
                        onClick={onSpin}
                        disabled={spinning}
                    >
                        {spinning ? "Spinning…" : "Spin"}
                    </button>
                </div>

                {/* toasts */}
                <div className="toasts">
                    {toasts.map((t) => (
                        <div key={t.id} className={`toast ${t.level}`}>
                            {t.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SlotMachineView;

/* ---------- HARD SINGLETON MOUNT ---------- */
(() => {
    const W = window as any;
    if (W.__SLOTS_APP_MOUNTED__) return;
    W.__SLOTS_APP_MOUNTED__ = true;

    const MOUNT_ID = "olrp-slots-root";
    const dupes = Array.from(
        document.querySelectorAll<HTMLElement>("#" + MOUNT_ID)
    );
    dupes.slice(1).forEach((n) => n.remove());

    let host = document.getElementById(MOUNT_ID) as HTMLElement | null;
    if (!host) {
        host = document.createElement("div");
        host.id = MOUNT_ID;
        document.body.appendChild(host);
    }

    try {
        if (
            W.__SLOTS_ROOT__ &&
            typeof (W.__SLOTS_ROOT__ as Root).unmount === "function"
        )
            (W.__SLOTS_ROOT__ as Root).unmount();
    } catch {}

    const root = createRoot(host);
    root.render(<SlotMachineView />);
    W.__SLOTS_ROOT__ = root;

    // convenience open
    W.OLRP_OPEN_SLOTS = (detail?: any) => {
        window.dispatchEvent(
            new CustomEvent("slotmachine_module_result", {
                detail: detail || {},
            })
        );
    };
})();
