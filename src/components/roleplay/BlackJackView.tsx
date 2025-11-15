import React, { FC, useEffect, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import "./BlackjackView.scss";

/* ----- composers (unchanged) ----- */
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

/* ---------- types (matches your parser) ---------- */
type BJPhase = "INVITE" | "PLAYING" | "ENDED";
type BJMsg = { text: string; level: "info" | "warn" | "error" };

type BJState = {
    phase?: BJPhase; // optional alias sent by server
    state?: BJPhase; // same as above
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
    /** Optional; if you wire it server-side we’ll use it. */
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

/* ---------- small drag hook using header as handle ---------- */
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

        const down = (e: MouseEvent | TouchEvent) => {
            const point = (e as TouchEvent).touches
                ? (e as TouchEvent).touches[0]
                : (e as MouseEvent);
            dragging = true;
            sx = point.clientX;
            sy = point.clientY;
            const r = node.getBoundingClientRect();
            bx = r.left;
            by = r.top;
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
            document.addEventListener("touchmove", move, { passive: false });
            document.addEventListener("touchend", up);
            e.preventDefault?.();
        };

        const move = (e: MouseEvent | TouchEvent) => {
            if (!dragging) return;
            const point = (e as TouchEvent).touches
                ? (e as TouchEvent).touches[0]
                : (e as MouseEvent);
            const nx = bx + (point.clientX - sx);
            const ny = by + (point.clientY - sy);
            node.style.left = `${nx}px`;
            node.style.top = `${ny}px`;
            node.style.transform = "translate(0,0)";
        };

        const up = () => {
            dragging = false;
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
            document.removeEventListener("touchmove", move as any);
            document.removeEventListener("touchend", up);
        };

        handle.addEventListener("mousedown", down as any);
        handle.addEventListener("touchstart", down as any);
        return () => {
            handle.removeEventListener("mousedown", down as any);
            handle.removeEventListener("touchstart", down as any);
        };
    }, [ref]);
}

/* ---------- main view ---------- */
type VCard = { id: number; code: string };

export const BlackjackView: FC = () => {
    const [open, setOpen] = useState(false);
    const [st, setSt] = useState<BJState | null>(null);

    const [toasts, setToasts] = useState<
        Array<{ id: number; text: string; level: string }>
    >([]);
    const [visDealer, setVisDealer] = useState<VCard[]>([]);
    const [visPlayer, setVisPlayer] = useState<VCard[]>([]);
    const [confetti, setConfetti] = useState<
        Array<{ id: number; left: number; delay: number }>
    >([]);
    const [tableFlash, setTableFlash] = useState(false);

    const idSeq = useRef(1);
    const lastPhaseRef = useRef<BJPhase | null>(null);
    const lastRevealRef = useRef<boolean>(false);

    const rootRef = useRef<HTMLDivElement>(null);
    useDrag(rootRef);

    /* Mount listeners once */
    useEffect(() => {
        const W = window as any;
        if (W.__BJ_LISTENERS__) return;

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
                        isDealer: detail.isDealer ?? false,
                    }
            );
            // clear stage for a fresh invite screen
            setVisDealer([]);
            setVisPlayer([]);
            idSeq.current = 1;
            lastPhaseRef.current = "INVITE";
            lastRevealRef.current = false;
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
                isDealer: !!incoming.isDealer,
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

            // celebrate natural blackjack (you) or a toast that mentions it
            const naturalBJ =
                safe.playerHand.length === 2 && safe.playerTotal === 21;
            const toastBJ = safe.messages.some((m) =>
                /blackjack/i.test(m.text)
            );
            if (naturalBJ || toastBJ) {
                setTableFlash(true);
                const pieces = Array.from({ length: 60 }).map((_, i) => ({
                    id: Date.now() + i,
                    left: Math.random() * 100,
                    delay: Math.random() * 0.6,
                }));
                setConfetti(pieces);
                setTimeout(() => setConfetti([]), 1800);
                setTimeout(() => setTableFlash(false), 600);
            }

            const prevPhase = lastPhaseRef.current;
            const prevReveal = lastRevealRef.current;
            lastPhaseRef.current = phase;
            lastRevealRef.current = !!safe.dealerReveal;

            // reset if new invite / cards removed / previous ended
            const resetNeeded =
                phase === "INVITE" ||
                safe.playerHand.length < visPlayer.length ||
                safe.dealerCards.length < visDealer.length ||
                prevPhase === "ENDED";

            if (resetNeeded) {
                setVisDealer([]);
                setVisPlayer([]);
                idSeq.current = 1;
            }

            // dealer hand staging:
            // when dealerReveal flips false->true, rebuild fully to replace "??" with real code
            const justRevealed = !prevReveal && !!safe.dealerReveal;
            if (justRevealed) {
                setVisDealer(
                    safe.dealerCards.map((code) => ({
                        id: idSeq.current++,
                        code,
                    }))
                );
            } else {
                setVisDealer((cur) => {
                    const next = [...cur];
                    for (let i = cur.length; i < safe.dealerCards.length; i++) {
                        next.push({
                            id: idSeq.current++,
                            code: safe.dealerCards[i],
                        });
                    }
                    return next;
                });
            }

            // player hand: append only new cards
            setVisPlayer((cur) => {
                const next = [...cur];
                for (let i = cur.length; i < safe.playerHand.length; i++) {
                    next.push({
                        id: idSeq.current++,
                        code: safe.playerHand[i],
                    });
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
        window.addEventListener("blackjack_state", onState as EventListener);

        return () => {
            window.removeEventListener(
                "blackjack_module_result",
                onModule as EventListener
            );
            window.removeEventListener(
                "blackjack_state",
                onState as EventListener
            );
            W.__BJ_LISTENERS__ = null;
        };
    }, [visDealer.length, visPlayer.length]);

    if (!open) return null;

    const phase: BJPhase = (st?.phase || st?.state || "INVITE") as BJPhase;
    const inviting = phase === "INVITE";
    const playing = phase === "PLAYING";
    const myTurn = !!st?.playerTurn;
    const isDealer = !!st?.isDealer; // if you wire it, UI will use it

    const close = () => {
        setOpen(false);
        try {
            leave();
        } catch {}
    };

    return (
        <div
            className={`bj-root ${tableFlash ? "bj-flash" : ""}`}
            ref={rootRef}
        >
            <div className="bj-header" title="Drag me">
                <span>Blackjack</span>
                <div className="spacer" />
                <button className="bj-close" onClick={close} />
            </div>

            <div className="bj-body">
                {/* INVITE */}
                {inviting && (
                    <div className="invite-banner">
                        <div className="invite-title">Bet {st?.bet ?? 0}</div>
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
                            {visDealer.map((d, idx) => (
                                <PlayingCard
                                    key={d.id}
                                    code={d.code}
                                    faceDown={!st?.dealerReveal && idx === 1}
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
                {playing && st?.insuranceOffered && !isDealer && myTurn && (
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

                {/* Confetti */}
                {confetti.length > 0 && (
                    <div className="bj-confetti" aria-hidden="true">
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

export default BlackjackView;

/* ---------- HARD SINGLETON MOUNT ---------- */
(() => {
    const W = window as any;
    if (W.__BJ_APP_MOUNTED__) return;
    W.__BJ_APP_MOUNTED__ = true;

    const MOUNT_ID = "olrp-blackjack-root";

    // remove stray dupes
    Array.from(document.querySelectorAll<HTMLElement>("#" + MOUNT_ID))
        .slice(1)
        .forEach((n) => n.remove());

    let host = document.getElementById(MOUNT_ID) as HTMLElement | null;
    if (!host) {
        host = document.createElement("div");
        host.id = MOUNT_ID;
        document.body.appendChild(host);
    }

    // unmount any previous root bound here
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

    // convenience opener
    W.OLRP_OPEN_BJ = (detail?: any) => {
        window.dispatchEvent(
            new CustomEvent("blackjack_module_result", { detail: detail || {} })
        );
    };
})();
