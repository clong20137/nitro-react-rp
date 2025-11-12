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

    // helpers
    const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
    const nz = (n: any) => (Number.isFinite(n) ? Number(n) : 0);

    // ----- EVENT SYNC -----
    useEffect(() => {
        const apply = (d: ATMPayload | undefined) => {
            if (!d) return;
            if (typeof d.username === "string") setUsername(d.username);
            if (typeof d.bank === "number") setBank(Math.max(0, nz(d.bank)));
            if (typeof d.cash === "number") setCash(Math.max(0, nz(d.cash)));
        };

        // Open -> set & show
        const onOpen = (e: Event) => {
            apply((e as CustomEvent<ATMPayload>).detail);
            setAmount(0);
            setMode("menu");
            setVisible(true);
        };

        // Live ATM updates (e.g., after server confirms a txn or on login fanout)
        const onATMUpdate = (e: Event) =>
            apply((e as CustomEvent<ATMPayload>).detail);

        // Global stats fanout (make sure your bridge fires these from UserStatsEvent)
        const onStats = (e: Event) =>
            apply((e as CustomEvent<ATMPayload>).detail);
        const onStatsUpdate = (e: Event) =>
            apply((e as CustomEvent<ATMPayload>).detail);

        window.addEventListener("atm_open", onOpen as EventListener);
        window.addEventListener("atm_update", onATMUpdate as EventListener);
        window.addEventListener("user_stats", onStats as EventListener);
        window.addEventListener(
            "user_stats_update",
            onStatsUpdate as EventListener
        );

        return () => {
            window.removeEventListener("atm_open", onOpen as EventListener);
            window.removeEventListener(
                "atm_update",
                onATMUpdate as EventListener
            );
            window.removeEventListener("user_stats", onStats as EventListener);
            window.removeEventListener(
                "user_stats_update",
                onStatsUpdate as EventListener
            );
        };
    }, []);

    // Close on Esc
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setVisible(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // ----- DRAG -----
    const onHeaderDown = (ev: React.MouseEvent) => {
        if (!dragRef.current) return;
        dragging.current.active = true;
        dragging.current.offX = ev.clientX - pos.x;
        dragging.current.offY = ev.clientY - pos.y;
        (ev.currentTarget as HTMLElement).style.cursor = "grabbing";
        window.addEventListener("mousemove", onHeaderMove);
        window.addEventListener("mouseup", onHeaderUp);
    };

    const onHeaderMove = (ev: MouseEvent) => {
        if (!dragging.current.active || !dragRef.current) return;
        const root = dragRef.current;
        const x = clamp(
            ev.clientX - dragging.current.offX,
            0,
            window.innerWidth - root.offsetWidth
        );
        const y = clamp(
            ev.clientY - dragging.current.offY,
            0,
            window.innerHeight - root.offsetHeight
        );
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

    // ----- UI actions -----
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
            // optimistic (will auto-correct on next user_stats/atm_update)
            setBank((b) => Math.max(0, b - amount));
            setCash((c) => Math.max(0, c + amount));
        } else if (mode === "deposit") {
            SendMessageComposer(new ATMDepositComposer(amount));
            // optimistic (will auto-correct on next user_stats/atm_update)
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
                className={`atm-view wanted-skin enter-br ${
                    mode !== "menu" ? "is-io" : "is-menu"
                }`}
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
