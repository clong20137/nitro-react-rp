import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import "./BlackjackView.scss";

/* ----- composers ----- */
import { SendMessageComposer } from "../../api";
import { BlackjackLeaveComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackLeaveComposer";
import { BlackjackAcceptComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackAcceptComposer";
import { BlackjackDeclineComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackDeclineComposer";
import { BlackjackHitComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackHitComposer";
import { BlackjackStandComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackStandComposer";
import { BlackjackDoubleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackDoubleComposer";
import { BlackjackSplitComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackSplitComposer";
import { BlackjackInsuranceComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackjackInsuranceComposer";

/* ----- send helpers ----- */
const leave = () => SendMessageComposer(new BlackjackLeaveComposer());
const accept = () => SendMessageComposer(new BlackjackAcceptComposer());
const decline = () => SendMessageComposer(new BlackjackDeclineComposer());
const hit = () => SendMessageComposer(new BlackjackHitComposer());
const stand = () => SendMessageComposer(new BlackjackStandComposer());
const doubleDown = () => SendMessageComposer(new BlackjackDoubleComposer());
const split = () => SendMessageComposer(new BlackjackSplitComposer());
const insuranceYes = () =>
    SendMessageComposer(new BlackjackInsuranceComposer(true));
const insuranceNo = () =>
    SendMessageComposer(new BlackjackInsuranceComposer(false));

/* ---------- types (matches parser) ---------- */
type BJPhase = "INVITE" | "PLAYING" | "ENDED";
type BJMsg = { text: string; level: "info" | "warn" | "error" };

type BJState = {
    phase?: BJPhase;
    state?: BJPhase;

    dealerReveal: boolean;
    dealerCards: string[];
    dealerTotal: number;

    playerHand: string[];
    playerTotal: number;
    playerTurn: boolean;

    canDouble: boolean;
    canSplit: boolean;
    insuranceOffered: boolean;

    bet: number;
    messages: BJMsg[];

    isDealer?: boolean;
};

/* ---------- card helpers ---------- */
const SUIT: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RANK: Record<string, string> = {
    A: "A",
    T: "10",
    J: "J",
    Q: "Q",
    K: "K",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
};

function parseCard(code: string) {
    if (!code || code === "?" || code === "HID" || code === "??")
        return { rank: "?", suit: "•", red: false, ten: false, hidden: true };

    const up = code.toUpperCase().trim();
    const rank = RANK[up[0]] || "?";
    const suit = SUIT[up[1]] || "•";
    const red = up[1] === "H" || up[1] === "D";
    const ten = rank === "10";
    return { rank, suit, red, ten, hidden: false };
}

const PlayingCard: FC<{
    code: string;
    faceDown?: boolean;
    className?: string;
}> = ({ code, faceDown, className }) => {
    const c = parseCard(code);
    const down = faceDown || c.hidden;
    const cls = [
        "card",
        c.red ? "red" : "black",
        down ? "down" : "up",
        c.ten ? "ten" : "",
        className || "",
    ]
        .join(" ")
        .trim();

    return (
        <div className={cls}>
            {down ? (
                <div className="back" />
            ) : (
                <>
                    <div className="corner tl">
                        <div className={`rank ${c.ten ? "ten" : ""}`}>
                            {c.rank}
                        </div>
                        <div className="suit">{c.suit}</div>
                    </div>
                    <div className="corner br">
                        <div className={`rank ${c.ten ? "ten" : ""}`}>
                            {c.rank}
                        </div>
                        <div className="suit">{c.suit}</div>
                    </div>
                </>
            )}
        </div>
    );
};

/* ---------- draggable ---------- */
function useDrag(ref: React.RefObject<HTMLElement>) {
    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const handle =
            (node.querySelector(".bj-header") as HTMLElement) || node;

        let sx = 0,
            sy = 0,
            bx = 0,
            by = 0,
            dragging = false;

        const down = (e: MouseEvent) => {
            dragging = true;
            sx = e.clientX;
            sy = e.clientY;
            const rect = node.getBoundingClientRect();
            bx = rect.left;
            by = rect.top;
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
            e.preventDefault();
        };

        const move = (e: MouseEvent) => {
            if (!dragging) return;
            node.style.left = `${bx + (e.clientX - sx)}px`;
            node.style.top = `${by + (e.clientY - sy)}px`;
            node.style.transform = "translate(0,0)";
        };

        const up = () => {
            dragging = false;
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
        };

        handle.addEventListener("mousedown", down);
        return () => handle.removeEventListener("mousedown", down);
    }, [ref]);
}

/* ---------- main view ---------- */
type VCard = { id: number; code: string; down?: boolean };

export const BlackjackView: FC = () => {
    const [open, setOpen] = useState(false);
    const [st, setSt] = useState<BJState | null>(null);
    const [toasts, setToasts] = useState<
        Array<{ id: number; text: string; level: string }>
    >([]);

    // Staged visible cards with stable IDs
    const [visDealer, setVisDealer] = useState<VCard[]>([]);
    const [visPlayer, setVisPlayer] = useState<VCard[]>([]);
    const idSeq = useRef(1);
    const lastPhaseRef = useRef<BJPhase | null>(null);

    const rootRef = useRef<HTMLDivElement>(null);
    useDrag(rootRef);

    useEffect(() => {
        const W = window as any;
        if (!W.__BJ_LISTENERS__) {
            const onModule = (e: Event) => {
                const detail = (e as CustomEvent).detail || {};
                setOpen(true);
                setSt(
                    (prev) =>
                        prev || {
                            phase: "INVITE",
                            dealerReveal: false,
                            dealerCards: [],
                            dealerTotal: 0,
                            playerHand: [],
                            playerTotal: 0,
                            playerTurn: false,
                            canDouble: false,
                            canSplit: false,
                            insuranceOffered: false,
                            bet: detail.bet ?? 0,
                            messages: [],
                            isDealer: detail.isDealer ?? undefined,
                        }
                );
                // brand new mount: clear stage
                setVisDealer([]);
                setVisPlayer([]);
                idSeq.current = 1;
                lastPhaseRef.current = "INVITE";
            };

            const onState = (e: Event) => {
                const incoming = (e as CustomEvent).detail as BJState;

                const phase: BJPhase = (incoming.phase ||
                    incoming.state ||
                    "INVITE") as BJPhase;

                const safe: BJState = {
                    phase,
                    state: incoming.state,
                    dealerReveal: !!incoming?.dealerReveal,
                    dealerCards: Array.isArray(incoming?.dealerCards)
                        ? incoming.dealerCards
                        : [],
                    dealerTotal: Number.isFinite((incoming as any)?.dealerTotal)
                        ? (incoming as any).dealerTotal
                        : 0,
                    playerHand: Array.isArray(incoming?.playerHand)
                        ? incoming.playerHand
                        : [],
                    playerTotal: Number.isFinite((incoming as any)?.playerTotal)
                        ? (incoming as any).playerTotal
                        : 0,
                    playerTurn: !!incoming?.playerTurn,
                    canDouble: !!incoming?.canDouble,
                    canSplit: !!incoming?.canSplit,
                    insuranceOffered: !!incoming?.insuranceOffered,
                    bet: Number.isFinite((incoming as any)?.bet)
                        ? (incoming as any).bet
                        : 0,
                    messages: Array.isArray(incoming?.messages)
                        ? incoming.messages
                        : [],
                    isDealer: incoming.isDealer,
                };

                setSt(safe);

                // toasts
                if (safe.messages.length) {
                    setToasts((ts) =>
                        [
                            {
                                id: Math.random(),
                                text: safe.messages[0].text,
                                level: safe.messages[0].level,
                            },
                            ...ts,
                        ].slice(0, 6)
                    );
                }

                // --- Stage management (prevent duplicates/redeal) ---
                const prevPhase = lastPhaseRef.current;
                lastPhaseRef.current = phase;

                // Round reset when we go to INVITE or card counts shrink
                const resetNeeded =
                    phase === "INVITE" ||
                    safe.playerHand.length < visPlayer.length ||
                    safe.dealerCards.length < visDealer.length;

                if (resetNeeded || prevPhase === "ENDED") {
                    setVisDealer([]);
                    setVisPlayer([]);
                    idSeq.current = 1;
                }

                // Player: append only new
                setVisPlayer((cur) => {
                    const next = [...cur];
                    for (let i = cur.length; i < safe.playerHand.length; i++) {
                        next.push({
                            id: idSeq.current++,
                            code: safe.playerHand[i],
                        });
                    }
                    // If server resent fewer (already handled by reset); if same length, keep
                    return next;
                });

                // Dealer: append only new; index 1 is hole card that may flip later
                setVisDealer((cur) => {
                    const next = [...cur];
                    for (let i = cur.length; i < safe.dealerCards.length; i++) {
                        const code = safe.dealerCards[i];
                        const down = !safe.dealerReveal && i === 1; // hide hole card until reveal
                        next.push({ id: idSeq.current++, code, down });
                    }
                    // Flip hole card without adding a new one
                    if (safe.dealerReveal && next[1] && next[1].down) {
                        next[1] = { ...next[1], down: false };
                    }
                    return next;
                });

                setOpen(true);
            };

            W.__BJ_LISTENERS__ = { onModule, onState };
            window.addEventListener(
                "blackjack_module_result",
                onModule as EventListener
            );
            window.addEventListener(
                "blackjack_state",
                onState as EventListener
            );
        }
    }, [visDealer.length, visPlayer.length]);

    if (!open) return null;

    const phase: BJPhase = (st?.phase || st?.state || "INVITE") as BJPhase;
    const inviting = phase === "INVITE";
    const playing = phase === "PLAYING";
    const myTurn = !!st?.playerTurn;

    // Dealer sees Accept/Decline during INVITE; player sees “waiting…”
    const isDealer = st?.isDealer ?? (inviting ? !myTurn : false);

    const close = () => {
        setOpen(false);
        try {
            leave();
        } catch {}
    };

    return (
        <div className="bj-root" ref={rootRef}>
            <div className="bj-header" title="Drag me">
                <span>Blackjack</span>
                <div className="spacer" />
                <button className="btn grey" onClick={close}>
                    ✕
                </button>
            </div>

            <div className="bj-body">
                {/* INVITE */}
                {inviting && (
                    <div className="invite-banner">
                        <div>
                            <b>Bet:</b> {st?.bet ?? 0}
                        </div>
                        <div className="act">
                            {isDealer ? (
                                <>
                                    <button
                                        className="btn green"
                                        onClick={accept}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        className="btn grey"
                                        onClick={decline}
                                    >
                                        Decline
                                    </button>
                                </>
                            ) : (
                                <div className="waiting">
                                    Waiting for dealer to accept...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TABLE */}
                <div className="table">
                    <div className="row dealer">
                        <div className="label">Dealer</div>
                        <div className="hand">
                            {visDealer.map((d) => (
                                <PlayingCard
                                    key={d.id}
                                    code={d.code}
                                    faceDown={!!d.down}
                                    className="deal-in"
                                />
                            ))}
                        </div>
                        <div className="total">
                            {st?.dealerReveal
                                ? `Total: ${st?.dealerTotal ?? 0}`
                                : "Total: ?"}
                        </div>
                    </div>

                    <div className="row player">
                        <div className="label">You</div>
                        <div className="hand">
                            {visPlayer.map((p) => (
                                <PlayingCard
                                    key={p.id}
                                    code={p.code}
                                    className="deal-in"
                                />
                            ))}
                        </div>
                        <div className="total">
                            Total: {st?.playerTotal ?? 0}
                        </div>
                    </div>
                </div>

                {/* INSURANCE — player only */}
                {playing && st?.insuranceOffered && myTurn && !isDealer && (
                    <div className="insurance">
                        Dealer shows an Ace. Take insurance?
                        <div className="act">
                            <button
                                className="btn yellow"
                                onClick={insuranceYes}
                            >
                                Yes
                            </button>
                            <button className="btn grey" onClick={insuranceNo}>
                                No
                            </button>
                        </div>
                    </div>
                )}

                {/* CONTROLS — player only */}
                {playing && !isDealer && (
                    <div className="controls">
                        <div className="act">
                            <button
                                className="btn yellow"
                                disabled={!myTurn}
                                onClick={hit}
                            >
                                Hit
                            </button>
                            <button
                                className="btn yellow"
                                disabled={!myTurn}
                                onClick={stand}
                            >
                                Stand
                            </button>
                            <button
                                className="btn yellow"
                                disabled={!myTurn || !st?.canDouble}
                                onClick={doubleDown}
                            >
                                Double
                            </button>
                            <button
                                className="btn yellow"
                                disabled={!myTurn || !st?.canSplit}
                                onClick={split}
                            >
                                Split
                            </button>
                        </div>
                    </div>
                )}

                {/* META */}
                <div className="meta">
                    <div>
                        Bet: <b>{st?.bet ?? 0}</b>
                    </div>
                    <div>
                        Status: <b>{phase}</b>
                    </div>
                    <div>
                        Turn:{" "}
                        <b>
                            {st?.playerTurn
                                ? "PLAYER"
                                : playing
                                ? "DEALER"
                                : "-"}
                        </b>
                    </div>
                </div>

                {/* TOASTS */}
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

export default BlackjackView;

/* ---------- HARD SINGLETON MOUNT ---------- */
(() => {
    const W = window as any;
    if (W.__BJ_APP_MOUNTED__) return;
    W.__BJ_APP_MOUNTED__ = true;

    const MOUNT_ID = "olrp-blackjack-root";

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
            W.__BJ_ROOT__ &&
            typeof (W.__BJ_ROOT__ as Root).unmount === "function"
        )
            (W.__BJ_ROOT__ as Root).unmount();
    } catch {}

    const root = createRoot(host);
    root.render(<BlackjackView />);
    W.__BJ_ROOT__ = root;

    W.OLRP_OPEN_BJ = (detail?: any) => {
        window.dispatchEvent(
            new CustomEvent("blackjack_module_result", { detail: detail || {} })
        );
    };
})();
