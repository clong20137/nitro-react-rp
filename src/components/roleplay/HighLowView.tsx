import React, { FC, useEffect, useState, useRef } from "react";
import { createRoot, Root } from "react-dom/client";
import "./HighLowView.scss";

/* composers */
import { HighLowGuessComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/HighLowGuessComposer";
import { HighLowLeaveComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/HighLowLeaveComposer";
import { HighLowAcceptComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/HighLowAcceptComposer";
import { HighLowDeclineComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/HighLowDeclineComposer";
import { SendMessageComposer } from "../../api";

/* senders */
const guessHigh = () => SendMessageComposer(new HighLowGuessComposer(1));
const guessLow = () => SendMessageComposer(new HighLowGuessComposer(2));
const leave = () => SendMessageComposer(new HighLowLeaveComposer());
const accept = () => SendMessageComposer(new HighLowAcceptComposer());
const decline = () => SendMessageComposer(new HighLowDeclineComposer());

/* ---------- types ---------- */
type HLMessage = { text: string; level: "info" | "warn" | "error" | string };

type HLState = {
    state: "IDLE" | "INVITE" | "PLAYING" | "ENDED";
    turn: "PLAYER" | "DEALER";
    currentCard: string;
    canAct: boolean;
    bet: number;
    messages?: HLMessage[];
};

/* ---------- component ---------- */
export const HighLowView: FC = () => {
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [state, setState] = useState<HLState | null>(null);
    const [toasts, setToasts] = useState<
        Array<{ id: number; text: string; level: string }>
    >([]);

    // confetti pieces
    const [confetti, setConfetti] = useState<
        Array<{ id: number; left: number; delay: number }>
    >([]);

    // draggable position
    const [dragPos, setDragPos] = useState(() => {
        if (typeof window === "undefined") return { x: 120, y: 120 };
        const w = window.innerWidth || 800;
        const h = window.innerHeight || 600;
        const defaultWidth = 480;
        const defaultHeight = 360;
        return {
            x: Math.max(8, (w - defaultWidth) / 2),
            y: Math.max(8, (h - defaultHeight) / 2),
        };
    });
    const [dragging, setDragging] = useState(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    // card animation key (forces re-mount to replay CSS animation)
    const [cardKey, setCardKey] = useState(0);

    // --- LISTENERS (highlow_state / highlow_module_result) ---
    useEffect(() => {
        const W = window as any;

        // 🔒 Only allow ONE HighLowView to attach listeners
        if (W.__HL_EVENTS_ATTACHED__) {
            return;
        }
        W.__HL_EVENTS_ATTACHED__ = true;

        const onModule = (e: Event) => {
            setClosing(false);
            setOpen(true);
            setState(
                (prev) =>
                    prev || {
                        state: "IDLE",
                        turn: "PLAYER",
                        currentCard: "?",
                        canAct: false,
                        bet: 0,
                    }
            );
        };

        const onState = (e: Event) => {
            const { detail } = e as CustomEvent;
            const s = detail as HLState;

            setClosing(false);
            setOpen(true);
            setState(s);
            setCardKey((k) => k + 1);

            const msgs = s.messages || [];
            msgs.forEach((m) =>
                setToasts((ts) =>
                    [
                        { id: Math.random(), text: m.text, level: m.level },
                        ...ts,
                    ].slice(0, 6)
                )
            );

            const hasWin = msgs.some((m) =>
                /win|won|victory|you.*won|you.*win/i.test(m.text || "")
            );
            if (hasWin) {
                const pieces = Array.from({ length: 50 }).map((_, i) => ({
                    id: Date.now() + i,
                    left: Math.random() * 100,
                    delay: Math.random() * 0.6,
                }));
                setConfetti(pieces);
                setTimeout(() => setConfetti([]), 1800);
            }
        };

        W.__HL_LISTENERS__ = { onModule, onState };

        window.addEventListener(
            "highlow_module_result",
            onModule as EventListener
        );
        window.addEventListener("highlow_state", onState as EventListener);

        return () => {
            window.removeEventListener(
                "highlow_module_result",
                onModule as EventListener
            );
            window.removeEventListener(
                "highlow_state",
                onState as EventListener
            );
            W.__HL_EVENTS_ATTACHED__ = false;
        };
    }, []);

    // --- DRAGGING EFFECT (MUST BE BEFORE ANY RETURN!) ---
    useEffect(() => {
        if (!dragging) return;

        const onMove = (evt: MouseEvent | TouchEvent) => {
            let clientX: number;
            let clientY: number;

            if (evt instanceof MouseEvent) {
                clientX = evt.clientX;
                clientY = evt.clientY;
            } else {
                const t = evt.touches[0];
                if (!t) return;
                clientX = t.clientX;
                clientY = t.clientY;
            }

            const offset = dragOffsetRef.current;
            const x = clientX - offset.x;
            const y = clientY - offset.y;

            const w = window.innerWidth || 800;
            const h = window.innerHeight || 600;

            const clampedX = Math.min(Math.max(4, x), w - 260);
            const clampedY = Math.min(Math.max(4, y), h - 200);

            setDragPos({ x: clampedX, y: clampedY });
        };

        const end = () => setDragging(false);

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", end);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", end);

        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", end);
            window.removeEventListener("touchmove", onMove as any);
            window.removeEventListener("touchend", end);
        };
    }, [dragging]);

    // ----- after this point we can early-return safely -----
    if (!open) return null;

    const playing = state?.state === "PLAYING";
    const inviting = state?.state === "INVITE";
    const myTurn = !!state?.canAct;

    const startClose = () => {
        setClosing(true);
        try {
            leave();
        } catch {}
        // let fade-out play before unmount
        setTimeout(() => {
            setOpen(false);
            setClosing(false);
        }, 180);
    };

    /* ------- minimal helpers to render a proper playing card ------- */
    const rankFromName = (name?: string): number | null => {
        if (!name) return null;
        const n = name.toString().trim().toLowerCase();
        if (n === "ace") return 1;
        if (n === "jack") return 11;
        if (n === "queen") return 12;
        if (n === "king") return 13;
        const v = parseInt(n, 10);
        return Number.isFinite(v) ? Math.max(1, Math.min(13, v)) : null;
    };

    const rankSymbol = (r: number | null): string => {
        if (r === null) return "?";
        if (r === 1) return "A";
        if (r === 11) return "J";
        if (r === 12) return "Q";
        if (r === 13) return "K";
        return String(r);
    };

    // Deterministic suit (since server only sends rank).
    const suitForRank = (r: number | null): "♠" | "♥" | "♦" | "♣" => {
        const idx = (((r ?? 0) % 4) + 4) % 4;
        return ["♠", "♥", "♦", "♣"][idx] as any;
    };

    const r = rankFromName(state?.currentCard);
    const suit = suitForRank(r);
    const rankTxt = rankSymbol(r);
    const isRed = suit === "♥" || suit === "♦";

    /* ---------- dragging start handlers ---------- */
    const beginDragMouse = (e: React.MouseEvent) => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        dragOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
        setDragging(true);
        e.preventDefault();
    };

    const beginDragTouch = (e: React.TouchEvent) => {
        if (!rootRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        const rect = rootRef.current.getBoundingClientRect();
        dragOffsetRef.current = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        };
        setDragging(true);
        e.preventDefault();
    };

    return (
        <div
            ref={rootRef}
            className={`hl-root ${closing ? "hl-closing" : "hl-open"}`}
            style={{ left: dragPos.x, top: dragPos.y }}
        >
            <div
                className="hl-header"
                onMouseDown={beginDragMouse}
                onTouchStart={beginDragTouch}
            >
                <span className="hl-title">High / Low</span>
                <div className="spacer" />
                <button className="btn grey hl-close-btn" onClick={startClose}>
                    ✕
                </button>
            </div>

            <div className="hl-body">
                {state?.state === "INVITE" && (
                    <div className="invite-banner">
                        {state.turn === "DEALER"
                            ? "Someone invited you to play High / Low!"
                            : "Waiting for the dealer to accept your invite..."}
                    </div>
                )}

                {/* big centered card */}
                <div className="card-stage">
                    <div
                        key={cardKey}
                        className={`card-big ${isRed ? "red" : ""} ${
                            myTurn ? "my-turn" : ""
                        }`}
                    >
                        {/* top-left rank */}
                        <div className="pip rank top">{rankTxt}</div>
                        {/* big center suit */}
                        <div className="pip suit">{suit}</div>
                        {/* bottom-right rank */}
                        <div className="pip rank bottom">{rankTxt}</div>
                    </div>
                </div>

                <div className="meta">
                    <div>
                        Turn: <b>{state?.turn ?? "-"}</b>
                    </div>
                    <div>
                        Bet: <b>{state?.bet ?? 0}</b>
                    </div>
                    <div>
                        Status: <b>{state?.state ?? "?"}</b>
                    </div>
                </div>

                <div className="controls">
                    {inviting && state?.turn === "DEALER" && (
                        <div className="act">
                            <button className="btn green" onClick={accept}>
                                Accept
                            </button>
                            <button className="btn grey" onClick={decline}>
                                Decline
                            </button>
                        </div>
                    )}

                    {playing && (
                        <div className="act">
                            <button
                                className="btn green"
                                disabled={!myTurn}
                                onClick={guessHigh}
                            >
                                High
                            </button>
                            <button
                                className="btn green"
                                disabled={!myTurn}
                                onClick={guessLow}
                            >
                                Low
                            </button>
                        </div>
                    )}

                    {inviting && state?.turn === "PLAYER" && (
                        <div className="waiting">
                            Waiting for dealer to accept...
                        </div>
                    )}
                </div>

                <div className="toasts">
                    {toasts.map((t) => (
                        <div key={t.id} className={`toast ${t.level}`}>
                            {t.text}
                        </div>
                    ))}
                </div>

                {confetti.length > 0 && (
                    <div className="hl-confetti" aria-hidden="true">
                        {confetti.map((p) => (
                            <span
                                key={p.id}
                                className="piece"
                                style={{
                                    left: `${p.left}%`,
                                    animationDelay: `${p.delay}s`,
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HighLowView;

/* ---------- HARD SINGLETON MOUNT (runs once per page) ---------- */

(() => {
    const W = window as any;
    if (W.__HL_APP_MOUNTED__) return; // already mounted
    W.__HL_APP_MOUNTED__ = true;

    const MOUNT_ID = "olrp-highlow-root";

    // remove any stray duplicates
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

    // If something already mounted a React root here, unmount it
    try {
        if (
            W.__HL_ROOT__ &&
            typeof (W.__HL_ROOT__ as Root).unmount === "function"
        ) {
            (W.__HL_ROOT__ as Root).unmount();
        }
    } catch {}

    const root = createRoot(host);
    root.render(<HighLowView />);
    W.__HL_ROOT__ = root;

    // Convenience bridge some code calls
    W.OLRP_OPEN_HL = (detail?: any) => {
        window.dispatchEvent(
            new CustomEvent("highlow_module_result", { detail: detail || {} })
        );
    };
})();
