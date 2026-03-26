import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SendMessageComposer } from "../../api";
import { ATMDepositComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ATMDepositComposer";
import { ATMWithdrawComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ATMWithdrawComposer";
import "./ATMView.scss";

type Mode = "menu" | "deposit" | "withdraw";
type Stage = "insert" | Mode;
type ATMPayload = { username?: string; cash?: number; bank?: number };

const LS_KEY_POS = "atm_view_pos_v1";
const OPEN_CLASS_MS = 220;
const CLOSE_CLASS_MS = 180;
const CARD_INSERT_MS = 700;

export const ATMView: FC = () => {
    const [visible, setVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [stage, setStage] = useState<Stage>("insert");
    const [bank, setBank] = useState(0);
    const [cash, setCash] = useState(0);
    const [amount, setAmount] = useState(0);
    const [username, setUsername] = useState<string>("");
    const [isCardAnimating, setIsCardAnimating] = useState(false);

    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem(LS_KEY_POS);
            if (saved) return JSON.parse(saved);
        } catch {}
        return { x: 40, y: 80 };
    });

    const dragRef = useRef<HTMLDivElement | null>(null);
    const dragging = useRef({ active: false, offX: 0, offY: 0 });
    const closeTimer = useRef<number | null>(null);
    const cardTimer = useRef<number | null>(null);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const nz = (value: unknown) => (Number.isFinite(value) ? Number(value) : 0);

    const clearTimers = () => {
        if (closeTimer.current) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }

        if (cardTimer.current) {
            window.clearTimeout(cardTimer.current);
            cardTimer.current = null;
        }
    };

    useEffect(() => () => clearTimers(), []);

    useEffect(() => {
        const apply = (payload?: ATMPayload) => {
            if (!payload) return;
            if (typeof payload.username === "string") setUsername(payload.username);
            if (typeof payload.bank === "number") setBank(Math.max(0, nz(payload.bank)));
            if (typeof payload.cash === "number") setCash(Math.max(0, nz(payload.cash)));
        };

        const onOpen = (event: Event) => {
            apply((event as CustomEvent<ATMPayload>).detail);
            clearTimers();
            setAmount(0);
            setStage("insert");
            setIsCardAnimating(false);
            setIsClosing(false);
            setVisible(true);
        };

        const onATMUpdate = (event: Event) => apply((event as CustomEvent<ATMPayload>).detail);
        const onStats = (event: Event) => apply((event as CustomEvent<ATMPayload>).detail);
        const onStatsUpdate = (event: Event) => apply((event as CustomEvent<ATMPayload>).detail);

        window.addEventListener("atm_open", onOpen as EventListener);
        window.addEventListener("atm_update", onATMUpdate as EventListener);
        window.addEventListener("user_stats", onStats as EventListener);
        window.addEventListener("user_stats_update", onStatsUpdate as EventListener);

        return () => {
            window.removeEventListener("atm_open", onOpen as EventListener);
            window.removeEventListener("atm_update", onATMUpdate as EventListener);
            window.removeEventListener("user_stats", onStats as EventListener);
            window.removeEventListener("user_stats_update", onStatsUpdate as EventListener);
        };
    }, []);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const close = useCallback(() => {
        clearTimers();
        setIsClosing(true);
        closeTimer.current = window.setTimeout(() => {
            setVisible(false);
            setIsClosing(false);
            setStage("insert");
            setAmount(0);
            setIsCardAnimating(false);
        }, CLOSE_CLASS_MS);
    }, []);

    const beginCardInsert = useCallback(() => {
        if (isCardAnimating) return;

        setIsCardAnimating(true);
        cardTimer.current = window.setTimeout(() => {
            setStage("menu");
            setIsCardAnimating(false);
        }, CARD_INSERT_MS);
    }, [isCardAnimating]);

    const onHeaderDown = (event: React.MouseEvent) => {
        if (!dragRef.current) return;
        dragging.current.active = true;
        dragging.current.offX = event.clientX - pos.x;
        dragging.current.offY = event.clientY - pos.y;
        (event.currentTarget as HTMLElement).style.cursor = "grabbing";
        window.addEventListener("mousemove", onHeaderMove);
        window.addEventListener("mouseup", onHeaderUp);
    };

    const onHeaderMove = (event: MouseEvent) => {
        if (!dragging.current.active || !dragRef.current) return;
        const root = dragRef.current;
        const nextX = clamp(event.clientX - dragging.current.offX, 0, window.innerWidth - root.offsetWidth);
        const nextY = clamp(event.clientY - dragging.current.offY, 0, window.innerHeight - root.offsetHeight);
        setPos({ x: nextX, y: nextY });
    };

    const onHeaderUp = () => {
        dragging.current.active = false;
        try {
            localStorage.setItem(LS_KEY_POS, JSON.stringify(pos));
        } catch {}
        const header = document.querySelector(".atm-header") as HTMLElement | null;
        if (header) header.style.cursor = "grab";
        window.removeEventListener("mousemove", onHeaderMove);
        window.removeEventListener("mouseup", onHeaderUp);
    };

    const appendDigit = (digit: number) => {
        setAmount((prev) => {
            let next = prev * 10 + digit;
            if (next > 1_000_000) next = 1_000_000;
            return next;
        });
    };

    const clearAmount = () => setAmount(0);

    const mode = stage === "deposit" || stage === "withdraw" ? stage : "menu";

    const quicks = useMemo(() => {
        const base = [3, 15, 100, 150, 500];
        base.push(mode === "withdraw" ? bank : cash);
        return Array.from(new Set(base.filter((value) => value > 0))).slice(0, 6);
    }, [bank, cash, mode]);

    const canEnter = useMemo(() => {
        if (amount <= 0) return false;
        if (mode === "withdraw") return amount <= bank;
        if (mode === "deposit") return amount <= cash;
        return false;
    }, [amount, bank, cash, mode]);

    const onEnter = useCallback(() => {
        if (!canEnter) return;

        if (mode === "withdraw") {
            SendMessageComposer(new ATMWithdrawComposer(amount));
            setBank((prev) => Math.max(0, prev - amount));
            setCash((prev) => Math.max(0, prev + amount));
        }

        if (mode === "deposit") {
            SendMessageComposer(new ATMDepositComposer(amount));
            setCash((prev) => Math.max(0, prev - amount));
            setBank((prev) => Math.max(0, prev + amount));
        }

        setAmount(0);
        setStage("menu");
    }, [amount, canEnter, mode]);

    if (!visible) return null;

    return (
        <div className="atm-view-overlay">
            <div
                ref={dragRef}
                className={`atm-view ${isClosing ? "is-exiting" : "is-entering"}`}
                style={{ left: pos.x, top: pos.y }}
            >
                <div className="atm-header" onMouseDown={onHeaderDown}>
                    <span className="atm-title">ATM</span>
                    <button className="atm-close" onClick={close} aria-label="Close" />
                </div>

                <div className="atm-content">
                    {stage === "insert" && (
                        <div className="atm-insert-screen">
                            <div className="atm-insert-prompt">Click your card to insert</div>
                            <div className="atm-slot-area">
                                <div className="atm-card-slot" />
                                <button
                                    className={`atm-card ${isCardAnimating ? "is-inserting" : ""}`}
                                    onClick={beginCardInsert}
                                    disabled={isCardAnimating}
                                >
                                    <span className="atm-card-chip" />
                                    <span className="atm-card-tier">STANDARD</span>
                                    <span className="atm-card-number">4000 1200 0900 0008</span>
                                    <span className="atm-card-name">{username || "MAVERICK"}</span>
                                    <span className="atm-card-expiry">27/2069</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {stage === "menu" && (
                        <div className="atm-menu">
                            <div className="atm-balance-list">
                                <div className="atm-balance-card">
                                    <span className="atm-balance-label">BANK BALANCE</span>
                                    <span className="atm-balance-value">${bank}</span>
                                </div>
                                <div className="atm-balance-card">
                                    <span className="atm-balance-label">CASH ON HAND</span>
                                    <span className="atm-balance-value">${cash}</span>
                                </div>
                            </div>

                            <div className="atm-menu-actions">
                                <button
                                    className="atm-theme-button"
                                    onClick={() => {
                                        setStage("deposit");
                                        setAmount(0);
                                    }}
                                >
                                    Deposit
                                </button>
                                <button
                                    className="atm-theme-button atm-theme-button--accent"
                                    onClick={() => {
                                        setStage("withdraw");
                                        setAmount(0);
                                    }}
                                >
                                    Withdraw
                                </button>
                            </div>
                        </div>
                    )}

                    {(stage === "deposit" || stage === "withdraw") && (
                        <div className="atm-io">
                            <div className="atm-io-header-row">
                                <button
                                    className="atm-back-button"
                                    onClick={() => {
                                        setStage("menu");
                                        setAmount(0);
                                    }}
                                >
                                    ←
                                </button>
                                <div className="atm-io-title">{stage === "withdraw" ? "WITHDRAW" : "DEPOSIT"}</div>
                            </div>

                            <div className="atm-amount-display">
                                <span className="atm-amount-label">AMOUNT</span>
                                <span className="atm-amount-value">${amount}</span>
                            </div>

                            <div className="atm-quick-grid">
                                {quicks.map((quickValue, index) => {
                                    const disabled =
                                        (stage === "withdraw" && quickValue > bank) ||
                                        (stage === "deposit" && quickValue > cash);

                                    return (
                                        <button
                                            key={`${quickValue}-${index}`}
                                            className="atm-quick-button"
                                            disabled={disabled}
                                            onClick={() => setAmount(quickValue)}
                                        >
                                            +${quickValue}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="atm-keypad-wrap">
                                <div className="atm-keypad-grid">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                                        <button key={digit} className="atm-key" onClick={() => appendDigit(digit)}>
                                            {digit}
                                        </button>
                                    ))}
                                    <button className="atm-key atm-key--wide" onClick={() => appendDigit(0)}>
                                        0
                                    </button>
                                    <button className="atm-key atm-key--back" onClick={() => setStage("menu")}>
                                        BACK
                                    </button>
                                </div>

                                <div className="atm-side-actions">
                                    <button className="atm-theme-button atm-theme-button--danger" onClick={clearAmount}>
                                        C
                                    </button>
                                    <button className="atm-theme-button atm-theme-button--accent atm-ok-button" disabled={!canEnter} onClick={onEnter}>
                                        OK
                                    </button>
                                </div>
                            </div>

                            <div className="atm-footer-balance">
                                <span className="atm-footer-label">{stage === "withdraw" ? "BANK BALANCE" : "CASH ON HAND"}</span>
                                <span className="atm-footer-value">${stage === "withdraw" ? bank : cash}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
