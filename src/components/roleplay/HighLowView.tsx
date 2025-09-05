import React, { FC, useEffect, useState } from "react";
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
type HLState = {
    state: "IDLE" | "INVITE" | "PLAYING" | "ENDED";
    turn: "PLAYER" | "DEALER";
    currentCard: string;
    canAct: boolean;
    bet: number;
    messages?: Array<{ text: string; level: "info" | "warn" | "error" }>;
};

/* ---------- component ---------- */
export const HighLowView: FC = () => {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<HLState | null>(null);
    const [toasts, setToasts] = useState<
        Array<{ id: number; text: string; level: string }>
    >([]);

    useEffect(() => {
        // One-time listeners — stored on window to avoid duplicates under StrictMode
        const W = window as any;
        if (!W.__HL_LISTENERS__) {
            const onModule = (e: Event) => {
                // show the module; if we have no state yet, show a benign stub
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
                setState(s);
                (s.messages || []).forEach((m) =>
                    setToasts((ts) =>
                        [
                            { id: Math.random(), text: m.text, level: m.level },
                            ...ts,
                        ].slice(0, 6)
                    )
                );
                setOpen(true);
            };

            W.__HL_LISTENERS__ = { onModule, onState };
            window.addEventListener(
                "highlow_module_result",
                onModule as EventListener
            );
            window.addEventListener("highlow_state", onState as EventListener);
        }

        return () => {
            // keep listeners for future rounds; do not remove
        };
    }, []);

    if (!open) return null;

    const playing = state?.state === "PLAYING";
    const inviting = state?.state === "INVITE";
    const myTurn = !!state?.canAct;

    const close = () => {
        setOpen(false);
        try {
            leave();
        } catch {}
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

    // Deterministic suit (since server only sends rank). Keeps the same suit
    // for a given rank so both viewers see the same thing.
    const suitForRank = (r: number | null): "♠" | "♥" | "♦" | "♣" => {
        const idx = (((r ?? 0) % 4) + 4) % 4;
        return ["♠", "♥", "♦", "♣"][idx] as any;
    };

    const r = rankFromName(state?.currentCard);
    const suit = suitForRank(r);
    const rankTxt = rankSymbol(r);
    const isRed = suit === "♥" || suit === "♦";

    return (
        <div className="hl-root">
            <div className="hl-header">
                <span>High / Low</span>
                <div className="spacer" />
                <button className="btn grey" onClick={close}>
                    ✕
                </button>
            </div>

            <div className="hl-body">
                {/* big centered card */}
                <div className="card-stage">
                    <div className={`card-big ${isRed ? "red" : ""}`}>
                        {/* top-left rank */}
                        <div className="pip rank top">{rankTxt}</div>
                        {/* big center suit */}
                        <div className="pip suit">{suit}</div>
                        {/* bottom-right rank + small suit (rotated) */}
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
            </div>
        </div>
    );
};

export default HighLowView;

/* ---------- HARD SINGLETON MOUNT (runs once per page) ---------- */

(() => {
    const W = window as any;
    if (W.__HL_APP_MOUNTED__) return; // already mounted (even across hot reloads/StrictMode)
    W.__HL_APP_MOUNTED__ = true;

    const MOUNT_ID = "olrp-highlow-root";

    // remove any stray duplicates from previous code paths
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
