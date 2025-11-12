import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SendMessageComposer } from "../../api";
import { ATMDepositComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ATMDepositComposer";
import { ATMWithdrawComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ATMWithdrawComposer";
import "./ATMView.scss";

type Mode = "menu" | "deposit" | "withdraw";
type ATMPayload = { username?: string; cash?: number; bank?: number };

const LS_KEY_POS = "atm_view_pos_v1";

export const ATMView: FC = () => {
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<Mode>("menu");
    const [bank, setBank] = useState(0);
    const [cash, setCash] = useState(0);
    const [amount, setAmount] = useState(0);
    const [username, setUsername] = useState<string>("");

    // draggable state
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem(LS_KEY_POS);
            if (saved) return JSON.parse(saved);
        } catch {}
        return { x: 40, y: 80 };
    });
    const dragRef = useRef<HTMLDivElement | null>(null);
    const dragging = useRef({ active: false, offX: 0, offY: 0 });

    // open from bridge
    useEffect(() => {
        const onOpen = (e: Event) => {
            const d = (e as CustomEvent<ATMPayload>)?.detail || {};
            setUsername(String(d.username ?? ""));
            setBank(Math.max(0, Number(d.bank ?? 0)));
            setCash(Math.max(0, Number(d.cash ?? 0)));
            setAmount(0);
            setMode("menu");
            setVisible(true);
        };
        const onUpdate = (e: Event) => {
            const d = (e as CustomEvent<ATMPayload>)?.detail || {};
            if (typeof d.bank === "number") setBank(Math.max(0, d.bank));
            if (typeof d.cash === "number") setCash(Math.max(0, d.cash));
        };
        window.addEventListener("atm_open", onOpen as EventListener);
        window.addEventListener("atm_update", onUpdate as EventListener);
        return () => {
            window.removeEventListener("atm_open", onOpen as EventListener);
            window.removeEventListener("atm_update", onUpdate as EventListener);
        };
    }, []);

    // drag handlers (attach to header only)
    const onHeaderDown = (ev: React.MouseEvent) => {
        const root = dragRef.current;
        if (!root) return;
        dragging.current.active = true;
        dragging.current.offX = ev.clientX - pos.x;
        dragging.current.offY = ev.clientY - pos.y;
        (ev.currentTarget as HTMLElement).style.cursor = "grabbing";
        window.addEventListener("mousemove", onHeaderMove);
        window.addEventListener("mouseup", onHeaderUp);
    };
    const onHeaderMove = (ev: MouseEvent) => {
        if (!dragging.current.active) return;
        const x = ev.clientX - dragging.current.offX;
        const y = ev.clientY - dragging.current.offY;
        setPos({ x, y });
    };
    const onHeaderUp = () => {
        dragging.current.active = false;
        try {
            localStorage.setItem(LS_KEY_POS, JSON.stringify(pos));
        } catch {}
        const header = document.querySelector(
            ".atm-header"
        ) as HTMLElement | null;
        if (header) header.style.cursor = "grab";
        window.removeEventListener("mousemove", onHeaderMove);
        window.removeEventListener("mouseup", onHeaderUp);
    };

    // helpers
    const close = useCallback(() => {
        setVisible(false);
        setAmount(0);
    }, []);

    const appendDigit = (d: number) => {
        setAmount((prev) => {
            let next = prev * 10 + d;
            if (next > 1_000_000) next = 1_000_000;
            return next;
        });
    };
    const clearAmount = () => setAmount(0);

    const quicks = useMemo(() => {
        const base = [3, 15, 100, 150, 500];
        base.push(mode === "withdraw" ? bank : cash);
        return Array.from(new Set(base.filter((v) => v > 0))).slice(0, 6);
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
            setBank((b) => Math.max(0, b - amount));
            setCash((c) => Math.max(0, c + amount));
        } else if (mode === "deposit") {
            SendMessageComposer(new ATMDepositComposer(amount));
            setCash((c) => Math.max(0, c - amount));
            setBank((b) => Math.max(0, b + amount));
        }
        setAmount(0);
        setMode("menu");
    }, [canEnter, amount, mode]);

    if (!visible) return null;

    return (
        <div className="atm-view-overlay">
            <div
                ref={dragRef}
                className="atm-view wanted-skin enter-br"
                style={{ left: pos.x, top: pos.y }}
            >
                {/* Header */}
                <div className="atm-header" onMouseDown={onHeaderDown}>
                    <span className="atm-title">
                        ATM {username ? ` Welcome, ${username}` : ""}
                    </span>
                    <button
                        className="close-button"
                        onClick={close}
                        aria-label="Close"
                    />
                </div>

                {/* Content */}
                <div className="atm-content">
                    {mode === "menu" && (
                        <div className="atm-menu">
                            <div className="info-cards">
                                <div className="card">
                                    <div className="label">BANK BALANCE</div>
                                    <div className="value">${bank}</div>
                                </div>
                                <div className="card">
                                    <div className="label">CASH BALANCE</div>
                                    <div className="value">${cash}</div>
                                </div>
                            </div>

                            <div className="menu-actions">
                                <button
                                    className="btn primary"
                                    onClick={() => {
                                        setMode("deposit");
                                        setAmount(0);
                                    }}
                                >
                                    Deposit
                                </button>
                                <button
                                    className="btn success"
                                    onClick={() => {
                                        setMode("withdraw");
                                        setAmount(0);
                                    }}
                                >
                                    Withdraw
                                </button>
                            </div>
                        </div>
                    )}

                    {(mode === "deposit" || mode === "withdraw") && (
                        <div className="atm-io">
                            <div className="io-top">
                                <button
                                    className="link"
                                    onClick={() => {
                                        setMode("menu");
                                        setAmount(0);
                                    }}
                                >
                                    ← Back
                                </button>
                                <div className="io-title">
                                    {mode === "withdraw"
                                        ? "Withdraw"
                                        : "Deposit"}
                                </div>
                                <div className="io-who">{username}</div>
                            </div>

                            <div className="readout">
                                <div className="row">
                                    <div className="label">
                                        {mode === "withdraw"
                                            ? "BANK BALANCE"
                                            : "CASH AVAILABLE"}
                                    </div>
                                    <div className="value">
                                        ${mode === "withdraw" ? bank : cash}
                                    </div>
                                </div>
                            </div>

                            <div className="readout amount">
                                <div className="label">
                                    AMOUNT TO{" "}
                                    {mode === "withdraw"
                                        ? "WITHDRAW"
                                        : "DEPOSIT"}
                                </div>
                                <div className="big">${amount}</div>
                            </div>

                            <div className="io-grid">
                                <div className="pad">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                        <button
                                            key={n}
                                            className="key"
                                            onClick={() => appendDigit(n)}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <button
                                        className="key wide"
                                        onClick={() => appendDigit(0)}
                                    >
                                        0
                                    </button>
                                    <button
                                        className="key warn"
                                        onClick={clearAmount}
                                    >
                                        Clear
                                    </button>
                                    <button
                                        className="key ok"
                                        disabled={!canEnter}
                                        onClick={onEnter}
                                    >
                                        Enter
                                    </button>
                                    <button
                                        className="key danger wide"
                                        onClick={() => {
                                            setMode("menu");
                                            setAmount(0);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="quick">
                                    {quicks.map((q, i) => {
                                        const disabled =
                                            (mode === "withdraw" && q > bank) ||
                                            (mode === "deposit" && q > cash);
                                        return (
                                            <button
                                                key={i}
                                                className={`btn quick-btn ${
                                                    disabled ? "disabled" : ""
                                                }`}
                                                disabled={disabled}
                                                onClick={() => setAmount(q)}
                                            >
                                                ${q}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="resize-handle" />
            </div>
        </div>
    );
};
