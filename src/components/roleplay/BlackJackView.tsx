import React, {
    FC,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createRoot, Root } from "react-dom/client";
import "./BlackjackView.scss";

/* real composers */
import { SendMessageComposer } from "../../api";
import { BlackJackJoinComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackJackJoinComposer";
import { BlackJackLeaveComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackJackLeaveComposer";
import { BlackJackBetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackJackBetComposer";
import { BlackJackActionComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackJackActionComposer";
import { BlackjackDealComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/BlackJackDealComposer";

/* ========================= bootstrap ========================= */
const MOUNT_ID = "olrp-blackjack-root";
let blackjackRoot: Root | null = null;
let mounted = false;

function ensureMount() {
    if (mounted) return;
    let host = document.getElementById(MOUNT_ID);
    if (!host) {
        host = document.createElement("div");
        host.id = MOUNT_ID;
        document.body.appendChild(host);
    }
    if (!blackjackRoot) blackjackRoot = createRoot(host!);
    blackjackRoot!.render(<BlackjackView />);
    mounted = true;
}

(window as any).OLRP_OPEN_BJ = (detail?: any) =>
    window.dispatchEvent(
        new CustomEvent("blackjack_module_result", { detail: detail || {} })
    );

function replayModuleResult(detail: any) {
    const d = { ...(detail || {}), __viaBootstrap: true };
    window.dispatchEvent(
        new CustomEvent("blackjack_module_result", { detail: d })
    );
}

function globalBootstrapListener(e: Event) {
    const ce = e as CustomEvent;
    const detail = ce.detail || {};
    if (detail.__viaBootstrap) return;
    ensureMount();
    setTimeout(() => replayModuleResult(detail), 0);
}
window.addEventListener(
    "blackjack_module_result",
    globalBootstrapListener as EventListener
);

/* ================ helpers ================ */
const on = <T extends Event>(type: string, cb: (e: T) => void) =>
    window.addEventListener(type, cb as EventListener);
const off = <T extends Event>(type: string, cb: (e: T) => void) =>
    window.removeEventListener(type, cb as EventListener);

const POS_KEY = "olrp.blackjack.pos";
const SIZE_KEY = "olrp.blackjack.size";

type BJState = {
    tableId: number;
    state: "WAITING" | "BETTING" | "DEALING" | "PLAYING" | "PAYOUT";
    minBet?: number;
    maxBet?: number;
    dealer: { cards: string[]; total?: number; reveal?: boolean };
    players: Array<{
        userId: number;
        name: string;
        seat?: number;
        bet: number;
        hand: string[];
        total: number;
        turn: boolean;
        bust?: boolean;
        stand?: boolean;
        blackjack?: boolean;
        delta?: number;
    }>;
    endsInMs?: number;
    myUserId?: number;
};

type BJMessage = { text: string; level?: "info" | "warn" | "error" };

/* ================ server composers ================ */
const joinTable = (tableId?: number) =>
    SendMessageComposer(new BlackJackJoinComposer(tableId ?? 0));
const leaveTable = (tableId?: number) =>
    SendMessageComposer(new BlackJackLeaveComposer(tableId ?? 0));
const placeBet = (amount: number, tableId?: number) =>
    SendMessageComposer(new BlackJackBetComposer(tableId ?? 0, amount));

const ACTION_MAP = { HIT: 1, STAND: 2, DOUBLE: 3 } as const;
type ActionKind = keyof typeof ACTION_MAP;
const doAction = (kind: ActionKind, tableId?: number) =>
    SendMessageComposer(
        new BlackJackActionComposer(tableId ?? 0, ACTION_MAP[kind])
    );
const doDeal = (tableId?: number) =>
    SendMessageComposer(new BlackjackDealComposer(tableId ?? 0));

/* ================ card parsing + totals ================ */
const SUIT_SYM: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RANK_TXT: Record<string, string> = {
    A: "A",
    K: "K",
    Q: "Q",
    J: "J",
    T: "10",
    "10": "10",
    "9": "9",
    "8": "8",
    "7": "7",
    "6": "6",
    "5": "5",
    "4": "4",
    "3": "3",
    "2": "2",
};
const parseCode = (code: string | undefined) => {
    if (!code) return { rank: "A", suit: "S" };
    if (code === "X") return { rank: "X", suit: "" }; // facedown
    if (code.length >= 3 && code.startsWith("10"))
        return { rank: "10", suit: code.slice(-1) };
    return { rank: code[0], suit: code[1] ?? "S" };
};

function prettyTotalFromHand(hand: string[], fallbackTotal: number): string {
    let minTotal = 0;
    let aces = 0;
    for (const code of hand) {
        if (!code || code === "X") continue;
        const { rank } = parseCode(code);
        if (rank === "A") {
            aces++;
            minTotal += 1;
        } else if (
            rank === "K" ||
            rank === "Q" ||
            rank === "J" ||
            rank === "T" ||
            rank === "10"
        ) {
            minTotal += 10;
        } else {
            minTotal += Number(rank) || 0;
        }
    }
    let soft = minTotal,
        a = aces;
    while (a > 0 && soft + 10 <= 21) {
        soft += 10;
        a--;
    }
    if (aces > 0 && soft !== minTotal) return `${minTotal}/${soft}`;
    return String(fallbackTotal ?? minTotal);
}

/* ================ Circular betting timer ================ */
const BetTimer: FC<{ remainingMs: number; totalMs: number }> = ({
    remainingMs,
    totalMs,
}) => {
    const R = 28;
    const C = 2 * Math.PI * R;
    const clamped = Math.max(0, Math.min(totalMs, remainingMs));
    const pct = totalMs > 0 ? clamped / totalMs : 0;
    const dash = Math.round(C * pct);
    const secs = Math.ceil(clamped / 1000);

    return (
        <div className="bet-timer" aria-live="polite">
            <svg
                className="timer-svg"
                width="64"
                height="64"
                viewBox="0 0 64 64"
            >
                <circle className="bg" cx="32" cy="32" r={R} />
                <circle
                    className="progress"
                    cx="32"
                    cy="32"
                    r={R}
                    style={{ strokeDasharray: C, strokeDashoffset: C - dash }}
                />
            </svg>
            <span className="time-text">{secs}</span>
        </div>
    );
};

/* ================ Card component ================ */
const Card: FC<{
    code: string;
    faceDown?: boolean;
    index?: number;
    delayMs?: number;
}> = ({ code, faceDown, index = 0, delayMs = 0 }) => {
    const { rank, suit } = parseCode(code);
    const red = suit === "H" || suit === "D";
    const isDown = faceDown || rank === "X";

    return (
        <div
            className={`card ${red ? "red" : ""}`}
            data-facedown={isDown ? "true" : "false"}
            data-deal-idx={index}
            style={{
                ["--deal-delay" as any]: `${Math.min(index, 6) * 90}ms`,
                ["--reveal-delay" as any]: `${delayMs}ms`,
            }}
        >
            <div className="card-face card-front">
                {!isDown && (
                    <>
                        <div className={`rank ${rank === "10" ? "ten" : ""}`}>
                            {RANK_TXT[rank] || rank}
                        </div>
                        <div className="suit">{SUIT_SYM[suit] || ""}</div>
                    </>
                )}
            </div>
            <div className="card-face card-back" />
        </div>
    );
};

/* ================ View ================ */
export const BlackjackView: FC = () => {
    const [open, setOpen] = useState(false);

    const localUserId =
        (window as any)?.Nitro?.instance?.sessionDataManager?.userId ??
        (window as any)?.Nitro?.sessionDataManager?.userId ??
        (window as any)?.HabboWebApi?.userId ??
        (window as any)?.OLRP_USER_ID ??
        0;

    const currentUserName =
        (window as any)?.Nitro?.instance?.sessionDataManager?.userName ??
        (window as any)?.Nitro?.sessionDataManager?.userName ??
        (window as any)?.HabboWebApi?.userName ??
        (window as any)?.OLRP_USER_NAME ??
        "";

    // drag/resize
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ w: 980, h: 620 });
    const dragging = useRef(false);
    const dragOff = useRef({ dx: 0, dy: 0 });
    const resizing = useRef(false);
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

    useLayoutEffect(() => {
        try {
            const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
            const s = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
            if (p && typeof p.x === "number" && typeof p.y === "number")
                setPos(p);
            if (s && typeof s.w === "number" && typeof s.h === "number")
                setSize(s);
        } catch {}
        if (!localStorage.getItem(POS_KEY)) {
            const vw = window.innerWidth,
                vh = window.innerHeight;
            setPos({
                x: Math.max(0, Math.round((vw - size.w) / 2)),
                y: Math.max(0, Math.round((vh - size.h) / 2)),
            });
        }
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragging.current) {
                setPos((p) => {
                    const x = e.clientX - dragOff.current.dx;
                    const y = e.clientY - dragOff.current.dy;
                    const maxX = Math.max(0, window.innerWidth - size.w);
                    const maxY = Math.max(0, window.innerHeight - size.h);
                    return {
                        x: Math.min(Math.max(0, x), maxX),
                        y: Math.min(Math.max(0, y), maxY),
                    };
                });
            } else if (resizing.current) {
                const dx = e.clientX - resizeStart.current.x;
                const dy = e.clientY - resizeStart.current.y;
                const W = Math.min(
                    Math.max(820, resizeStart.current.w + dx),
                    window.innerWidth - pos.x
                );
                const H = Math.min(
                    Math.max(480, resizeStart.current.h + dy),
                    window.innerHeight - pos.y
                );
                setSize({ w: W, h: H });
            }
        };
        const onUp = () => {
            if (dragging.current) {
                dragging.current = false;
                localStorage.setItem(POS_KEY, JSON.stringify(pos));
            }
            if (resizing.current) {
                resizing.current = false;
                localStorage.setItem(SIZE_KEY, JSON.stringify(size));
            }
            document.body.classList.remove("no-select");
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [pos, size]);

    // ===================== state from server =====================
    const [bj, setBJ] = useState<BJState | null>(null);

    // local view helpers
    const [dealerShown, setDealerShown] = useState<string[]>([]);
    const [dealerDrawMode, setDealerDrawMode] = useState(false);
    const [faceFade, setFaceFade] = useState(false);

    const effectiveUserId =
        bj?.myUserId && bj.myUserId > 0 ? bj.myUserId : localUserId;

    const me = useMemo(() => {
        if (!bj) return null;
        let mine = bj.players.find((p) => p.userId === effectiveUserId) || null;
        if (mine) return mine;
        if (currentUserName) {
            const low = currentUserName.toLowerCase();
            mine =
                bj.players.find((p) => (p.name || "").toLowerCase() === low) ||
                null;
        }
        return mine;
    }, [bj, effectiveUserId, currentUserName]);

    /* phase flags */
    const phase = bj?.state;
    const isWaiting = phase === "WAITING";
    const isBetting = phase === "BETTING";
    const isDealing = phase === "DEALING";
    const isPlaying = phase === "PLAYING";
    const isPayout = phase === "PAYOUT";
    const inRound = isDealing || isPlaying || isPayout;

    const isSeated = !!me;
    const hasBet = !!me && (me.bet ?? 0) > 0;
    const showDeal = isBetting && isSeated && hasBet;

    const canJoin = !inRound && !isSeated && (isWaiting || isBetting);
    const canLeave = isSeated || inRound;
    const canBet = isBetting && isSeated; // ← allow during BETTING window
    const canDeal = showDeal; // ← deal when showing the button

    const myTurn = useMemo(() => {
        if (!bj) return false;
        if (isPlaying) return !!me?.turn; // trust server
        return false; // never force-turn outside PLAYING
    }, [bj, isPlaying, me]);

    const canHit = isPlaying && myTurn && !me?.bust && !me?.stand;
    const canStand = isPlaying && myTurn && !me?.bust && !me?.stand;
    const canDouble =
        isPlaying &&
        myTurn &&
        (me?.hand?.length ?? 0) === 2 &&
        !me?.bust &&
        !me?.stand;

    // ===================== countdown (stable) =====================
    const [deadline, setDeadline] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());
    const lastEndsInRef = useRef<number | null>(null);
    const lastPhaseRef = useRef<string | null>(null);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 200);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const ends = bj?.endsInMs ?? null;
        const ph = bj?.state ?? null;
        const phaseChanged = lastPhaseRef.current !== ph;
        const endsChanged = lastEndsInRef.current !== ends;
        if (ends && (phaseChanged || endsChanged || deadline === null)) {
            setDeadline(Date.now() + ends);
            lastEndsInRef.current = ends;
            lastPhaseRef.current = ph;
        }
    }, [bj?.endsInMs, bj?.state]); // eslint-disable-line

    const remainingMs = Math.max(0, (deadline ?? 0) - now);
    const progress = useMemo(() => {
        if (!bj?.endsInMs) return 0;
        const used = bj.endsInMs - remainingMs;
        return Math.min(100, Math.max(0, (used / bj.endsInMs) * 100));
    }, [bj?.endsInMs, remainingMs]);

    // toasts
    const [toasts, setToasts] = useState<
        Array<{ id: number; text: string; level?: "info" | "warn" | "error" }>
    >([]);

    // bet controls
    const [bet, setBet] = useState<number>(100);
    const minBet = bj?.minBet ?? 1;
    const maxBet = bj?.maxBet ?? 1000;

    // open on module_result
    useEffect(() => {
        const onModule = (e: CustomEvent) => {
            const { hasInfo, tableId, minBet, maxBet } = e.detail || {};
            if (!hasInfo) return;
            setOpen(true);
            setBJ((prev) => ({
                tableId: tableId ?? prev?.tableId ?? 0,
                state: prev?.state ?? "WAITING",
                minBet: minBet ?? prev?.minBet,
                maxBet: maxBet ?? prev?.maxBet,
                dealer: prev?.dealer ?? { cards: [] },
                players: prev?.players ?? [],
            }));
            try {
                joinTable(tableId ?? 0);
            } catch {}
        };
        on<CustomEvent>("blackjack_module_result", onModule);
        return () => off<CustomEvent>("blackjack_module_result", onModule);
    }, []);

    // state stream → main reducer
    useEffect(() => {
        const onState = (e: CustomEvent) => {
            const s = e.detail as BJState;
            const myId =
                typeof s.myUserId === "number"
                    ? s.myUserId
                    : Number((s as any).myUserId) || 0;
            const players = (s.players || []).map((p: any) => ({
                ...p,
                userId:
                    typeof p.userId === "number"
                        ? p.userId
                        : Number(p.userId) || 0,
            }));
            setBJ({ ...s, myUserId: myId, players });
        };
        const onMsg = (e: CustomEvent) =>
            setToasts((t) =>
                [{ id: Math.random(), ...(e.detail as BJMessage) }, ...t].slice(
                    0,
                    4
                )
            );
        on<CustomEvent>("blackjack_state", onState);
        on<CustomEvent>("blackjack_message", onMsg);
        return () => {
            off<CustomEvent>("blackjack_state", onState);
            off<CustomEvent>("blackjack_message", onMsg);
        };
    }, []);

    /* ===================== Dealer reveal / draw pacing (robust) ===================== */
    const revealWanted =
        !!bj?.dealer.reveal ||
        bj?.state === "DEALING" ||
        bj?.state === "PAYOUT";

    // Step through dealer cards until we've displayed everything we've received from the server.
    useEffect(() => {
        if (!bj) return;

        const full = bj.dealer.cards || [];

        if (!revealWanted) {
            // Not revealing: mirror exactly what server sent (usually first up card + X's)
            setDealerDrawMode(false);
            setDealerShown(full.slice());
            return;
        }

        setDealerDrawMode(true);

        // Always ensure we at least have a slice of the full list (no shrink).
        setDealerShown((prev) => {
            if (prev.length > full.length) return full.slice();
            return prev.slice(0, full.length);
        });

        let i = 0;
        const startAt = Math.min(dealerShown.length, full.length);
        i = startAt;

        let timeout: number | undefined;
        const tick = () => {
            setDealerShown((prev) => {
                if (i >= full.length) return prev;
                const next = prev.slice(0, full.length);
                next[i] = full[i];
                i++;
                return next;
            });
            if (i < full.length) timeout = window.setTimeout(tick, 700);
        };

        // Kick the stepping loop when we still have cards to reveal.
        if (startAt < full.length) timeout = window.setTimeout(tick, 200);

        // Failsafe: if nothing progressed for 2s, snap to full (prevents “stuck until Leave”).
        const snap = window.setTimeout(() => {
            setDealerShown((prev) =>
                prev.length >= full.length ? prev : full.slice()
            );
        }, 2000);

        return () => {
            if (timeout) window.clearTimeout(timeout);
            window.clearTimeout(snap);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bj?.dealer.cards, revealWanted]);

    // fade+clear after payout (~5s)
    useEffect(() => {
        if (!isPayout) {
            setFaceFade(false);
            return;
        }
        setFaceFade(false);
        const fadeT = window.setTimeout(() => setFaceFade(true), 4400);
        return () => window.clearTimeout(fadeT);
    }, [isPayout]);

    // keep window open but allow manual close
    const close = () => {
        setOpen(false);
        try {
            leaveTable(bj?.tableId ?? 0);
        } catch {}
    };

    if (!open) return null;

    // reveal flag for render
    const dealerReveal = revealWanted;

    // fixed seats (0..2) with placeholders
    const seats: Array<BJState["players"][number] | null> = [null, null, null];
    (bj?.players || []).forEach((p) => {
        if (typeof p.seat === "number" && p.seat >= 0 && p.seat < 3)
            seats[p.seat] = p;
    });
    const mySeatIndex = me?.seat ?? -1;

    return (
        <div
            ref={rootRef}
            className="blackjack-view"
            style={{
                position: "fixed",
                zIndex: 1000,
                left: pos.x,
                top: pos.y,
                width: size.w,
                height: size.h,
            }}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bj-header"
                onMouseDown={(e) => {
                    if (!rootRef.current) return;
                    const rect = rootRef.current.getBoundingClientRect();
                    dragging.current = true;
                    dragOff.current = {
                        dx: e.clientX - rect.left,
                        dy: e.clientY - rect.top,
                    };
                    document.body.classList.add("no-select");
                }}
            >
                <span>
                    Blackjack {bj?.tableId ? `• Table #${bj.tableId}` : ""}
                </span>
                <div className="spacer" />
                <button className="bj-btn grey" onClick={close}>
                    ✕
                </button>
            </div>

            <div
                className={`bj-table ${dealerDrawMode ? "draw-slow" : ""}`}
                style={{ ["--panelW" as any]: "340px" }}
            >
                {/* BETTING circular timer */}
                {isBetting && bj?.endsInMs ? (
                    <BetTimer remainingMs={remainingMs} totalMs={bj.endsInMs} />
                ) : null}

                {/* Dealer */}
                <div className={`dealer ${faceFade ? "fade-out" : ""}`}>
                    <div className="label">Dealer</div>
                    <div
                        className={`hand fan ${
                            dealerReveal ? "reveal-all" : ""
                        }`}
                        style={{ overflow: "visible" }}
                    >
                        {(dealerReveal
                            ? dealerShown
                            : bj?.dealer.cards ?? []
                        ).map((c, i) => (
                            <Card
                                key={`dealer-${i}`}
                                code={c}
                                faceDown={c === "X" && !dealerReveal}
                                index={i}
                                delayMs={dealerReveal ? i * 700 : 0}
                            />
                        ))}
                    </div>
                    {!!bj?.dealer.total && dealerReveal && (
                        <div className="total">{bj.dealer.total}</div>
                    )}
                </div>

                {/* Felt payouts (static copy) */}
                <div className={`felt-payouts ${faceFade ? "fade-out" : ""}`}>
                    <div className="line big">BLACKJACK PAYS 3 TO 2</div>
                    <div className="line">
                        Perfect Pair (same suit & color) 25:1
                    </div>
                    <div className="line">Perfect Pair (same color) 15:1</div>
                    <div className="line">
                        Perfect Pair (different color) 5:1
                    </div>
                </div>

                {/* Seats */}
                <div className="players ring">
                    {seats.map((p, seatIdx) => {
                        const isMine = seatIdx === mySeatIndex;

                        if (!p) {
                            return (
                                <div
                                    key={`seat-${seatIdx}`}
                                    className={`seat placeholder seat-${seatIdx}`}
                                >
                                    <div className="seat-header">
                                        <span className="name">Empty</span>
                                        <span className="bet">$0</span>
                                    </div>
                                    <div className="hand horizontal" />
                                    <div className="footer">
                                        <span className="total">0</span>
                                    </div>
                                </div>
                            );
                        }

                        const totalText = prettyTotalFromHand(p.hand, p.total);

                        return (
                            <div
                                key={p.userId}
                                className={`seat seat-${seatIdx} ${
                                    p.turn ? "turn" : ""
                                } ${p.bust ? "bust" : ""} ${
                                    faceFade ? "fade-out" : ""
                                }`}
                            >
                                <div className="seat-header">
                                    <span className="name">{p.name}</span>
                                    <span className="bet">${p.bet ?? 0}</span>
                                </div>

                                <div className="hand horizontal">
                                    {p.hand.map((c, i) => (
                                        <div
                                            className="card-wrapper"
                                            key={`${p.userId}-${i}`}
                                            style={{ ["--i" as any]: i }}
                                        >
                                            <Card code={c} index={i} />
                                        </div>
                                    ))}
                                </div>

                                <div className="footer">
                                    <span className="total">{totalText}</span>
                                    {p.blackjack && (
                                        <span className="badge">BJ</span>
                                    )}
                                    {p.stand && (
                                        <span className="badge">STAND</span>
                                    )}
                                    {p.bust && (
                                        <span className="badge red">BUST</span>
                                    )}
                                    {typeof p.delta === "number" &&
                                        bj?.state === "PAYOUT" && (
                                            <span
                                                className={`delta ${
                                                    p.delta >= 0
                                                        ? "win"
                                                        : "lose"
                                                }`}
                                            >
                                                {p.delta >= 0 ? "+" : ""}
                                                {p.delta}
                                            </span>
                                        )}
                                </div>

                                {isMine && (
                                    <div className="seat-actions">
                                        <button
                                            className="bj-btn green"
                                            disabled={!canHit}
                                            onClick={() =>
                                                doAction(
                                                    "HIT",
                                                    bj?.tableId ?? 0
                                                )
                                            }
                                        >
                                            Hit
                                        </button>
                                        <button
                                            className="bj-btn white"
                                            disabled={!canStand}
                                            onClick={() =>
                                                doAction(
                                                    "STAND",
                                                    bj?.tableId ?? 0
                                                )
                                            }
                                        >
                                            Stand
                                        </button>
                                        <button
                                            className="bj-btn yellow"
                                            disabled={!canDouble}
                                            onClick={() =>
                                                doAction(
                                                    "DOUBLE",
                                                    bj?.tableId ?? 0
                                                )
                                            }
                                        >
                                            Double
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* linear timer (stable) */}
                {bj?.endsInMs ? (
                    <div className="timer">
                        <div
                            className="bar"
                            style={{ width: `${100 - progress}%` }}
                        />
                    </div>
                ) : null}

                {/* Floating betting controls */}
                <div className="corner-controls">
                    <div className="betting">
                        <div className="row">
                            <input
                                type="number"
                                min={minBet}
                                max={maxBet}
                                value={bet}
                                onChange={(e) =>
                                    setBet(
                                        Math.min(
                                            maxBet,
                                            Math.max(
                                                minBet,
                                                Number(e.target.value) || minBet
                                            )
                                        )
                                    )
                                }
                            />
                            <button
                                className="bj-btn green"
                                disabled={!canBet}
                                onClick={() => placeBet(bet, bj?.tableId ?? 0)}
                            >
                                Bet
                            </button>
                            {showDeal && (
                                <button
                                    className="bj-btn white"
                                    disabled={!canDeal}
                                    onClick={() => doDeal(bj?.tableId ?? 0)}
                                >
                                    Deal
                                </button>
                            )}
                            <button
                                className="bj-btn"
                                disabled={!canJoin}
                                onClick={() => joinTable(bj?.tableId ?? 0)}
                            >
                                Join
                            </button>
                            <button
                                className="bj-btn"
                                disabled={!canLeave}
                                onClick={() => leaveTable(bj?.tableId ?? 0)}
                            >
                                Leave
                            </button>
                        </div>
                        <div className="chips">
                            {[5, 10, 25, 50, 100].map((v) => (
                                <button
                                    key={v}
                                    className="chip"
                                    onClick={() =>
                                        setBet((b) =>
                                            Math.min(
                                                maxBet,
                                                Math.max(minBet, (b || 0) + v)
                                            )
                                        )
                                    }
                                >
                                    +{v}
                                </button>
                            ))}
                            <button
                                className="chip"
                                onClick={() => setBet(minBet)}
                            >
                                Min
                            </button>
                            <button
                                className="chip"
                                onClick={() => setBet(maxBet)}
                            >
                                Max
                            </button>
                            <span className="limits">
                                Limits: ${minBet}–${maxBet}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Toasts */}
                <div className="toasts">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className={`toast ${t.level || "info"}`}
                        >
                            {t.text}
                        </div>
                    ))}
                </div>
            </div>

            {/* resize */}
            <div
                className="resize-handle"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    if (!rootRef.current) return;
                    const rect = rootRef.current.getBoundingClientRect();
                    resizing.current = true;
                    resizeStart.current = {
                        x: e.clientX,
                        y: e.clientY,
                        w: rect.width,
                        h: rect.height,
                    };
                    document.body.classList.add("no-select");
                }}
                title="Resize"
            />
        </div>
    );
};

export default BlackjackView;
