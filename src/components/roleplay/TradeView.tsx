import React, {
    FC,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { GetNitroInstance } from "../../api/nitro/GetNitroInstance";

import { TradeConfirmComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TradeConfirmComposer";
import { TradeCancelComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TradeCancelComposer";

import "./TradeView.scss";

type TradeSlot = {
    hasItem: boolean;
    inventoryRowId?: number;
    itemId?: number;
    name?: string;
    icon?: string;
    rarity?: string;
    type?: string;
    quantity?: number;
    durability?: number;
    maxDurability?: number;
};

type TradeState = {
    isOpen: boolean;
    sessionId: number;
    userAId: number;
    userBId: number;
    usernameA: string;
    usernameB: string;
    aConfirmed: boolean;
    bConfirmed: boolean;
    aSlots: TradeSlot[];
    bSlots: TradeSlot[];
};

const EMPTY_SLOTS: TradeSlot[] = Array.from({ length: 6 }, () => ({
    hasItem: false,
}));

export const TradeView: FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [trade, setTrade] = useState<TradeState>({
        isOpen: false,
        sessionId: 0,
        userAId: 0,
        userBId: 0,
        usernameA: "",
        usernameB: "",
        aConfirmed: false,
        bConfirmed: false,
        aSlots: EMPTY_SLOTS,
        bSlots: EMPTY_SLOTS,
    });

    const winRef = useRef<HTMLDivElement>(null);

    // animations
    const [isEntering, setIsEntering] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    // persisted position
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("tradePos");
            if (s) return JSON.parse(s);
        } catch {}
        return { x: Math.round(window.innerWidth * 0.18), y: 120 };
    });

    // window drag
    const rafRef = useRef<number | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const [headerGrabbing, setHeaderGrabbing] = useState(false);

    const clamp = useCallback((x: number, y: number) => {
        const nitro = GetNitroInstance?.() as any;

        const sw = nitro?.renderer?.width ?? window.innerWidth;
        const sh = nitro?.renderer?.height ?? window.innerHeight;

        const w = winRef.current?.offsetWidth ?? 520;
        const h = winRef.current?.offsetHeight ?? 340;

        const pad = 8;
        const maxX = Math.max(pad, sw - w - pad);
        const maxY = Math.max(pad, sh - h - pad);

        return {
            x: Math.min(Math.max(pad, Math.round(x)), maxX),
            y: Math.min(Math.max(pad, Math.round(y)), maxY),
        };
    }, []);

    const startDrag = (cx: number, cy: number) => {
        const rect = winRef.current?.getBoundingClientRect();
        const curX = rect?.left ?? position.x;
        const curY = rect?.top ?? position.y;

        dragRef.current = { dx: cx - curX, dy: cy - curY };
        setHeaderGrabbing(true);
    };

    const moveDrag = (cx: number, cy: number) => {
        if (!dragRef.current) return;

        const nx = cx - dragRef.current.dx;
        const ny = cy - dragRef.current.dy;
        const next = clamp(nx, ny);

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setPosition(next));
    };

    const stopDrag = () => {
        dragRef.current = null;
        setHeaderGrabbing(false);

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    // persist position
    useEffect(() => {
        try {
            localStorage.setItem("tradePos", JSON.stringify(position));
        } catch {}
    }, [position]);

    // Helper: figure out if I'm A or B.
    // If you have a better local user id getter in your client, wire it here.
    const myUserId = useMemo(() => {
        // Try Nitro session userId if available, otherwise 0 (will still work visually)
        const nitro = GetNitroInstance?.() as any;
        return nitro?.sessionDataManager?.userId ?? 0;
    }, []);

    const iAmA =
        myUserId > 0 && trade.userAId > 0 && myUserId === trade.userAId;
    const iAmB =
        myUserId > 0 && trade.userBId > 0 && myUserId === trade.userBId;

    const myConfirmed = iAmA
        ? trade.aConfirmed
        : iAmB
        ? trade.bConfirmed
        : false;

    // bridge listeners
    useEffect(() => {
        const onOpen = (e: any) => {
            const d = e?.detail ?? {};
            console.log("[TradeView] trade_open", d);

            setIsExiting(false);
            setIsEntering(true);

            setTrade({
                isOpen: true,
                sessionId: Number(d.sessionId ?? 0),
                userAId: Number(d.userAId ?? 0),
                userBId: Number(d.userBId ?? 0),
                usernameA: String(d.usernameA ?? ""),
                usernameB: String(d.usernameB ?? ""),
                aConfirmed: !!d.aConfirmed,
                bConfirmed: !!d.bConfirmed,
                aSlots: (d.aSlots ?? EMPTY_SLOTS) as TradeSlot[],
                bSlots: (d.bSlots ?? EMPTY_SLOTS) as TradeSlot[],
            });
        };

        const onUpdate = (e: any) => {
            const d = e?.detail ?? {};
            // console.log("[TradeView] trade_update", d);

            setTrade((prev) => ({
                ...prev,
                ...d,
                aSlots: d.aSlots ?? prev.aSlots,
                bSlots: d.bSlots ?? prev.bSlots,
                aConfirmed:
                    typeof d.aConfirmed === "boolean"
                        ? d.aConfirmed
                        : prev.aConfirmed,
                bConfirmed:
                    typeof d.bConfirmed === "boolean"
                        ? d.bConfirmed
                        : prev.bConfirmed,
            }));
        };

        const onCloseEvent = (e: any) => {
            console.log("[TradeView] trade_close", e?.detail);
            setIsExiting(true);
        };

        // Optional: if you bridge trade_result, you can show it / log it
        const onResult = (e: any) => {
            console.log("[TradeView] trade_result", e?.detail);
        };

        window.addEventListener("trade_open", onOpen as any);
        window.addEventListener("trade_update", onUpdate as any);
        window.addEventListener("trade_close", onCloseEvent as any);
        window.addEventListener("trade_result", onResult as any);

        return () => {
            window.removeEventListener("trade_open", onOpen as any);
            window.removeEventListener("trade_update", onUpdate as any);
            window.removeEventListener("trade_close", onCloseEvent as any);
            window.removeEventListener("trade_result", onResult as any);
        };
    }, []);

    const sendConfirm = () => {
        if (!trade.sessionId) return;

        console.log("[TradeView] Sending TradeConfirm", trade.sessionId);
        GetCommunication().connection.send(
            new TradeConfirmComposer(trade.sessionId)
        );
        // ✅ Do NOT close. Wait for server to update confirmations / finalize / close.
    };

    const sendCancel = () => {
        if (!trade.sessionId) return;

        console.log("[TradeView] Sending TradeCancel", trade.sessionId);
        GetCommunication().connection.send(
            new TradeCancelComposer(trade.sessionId)
        );

        // ✅ IMPORTANT:
        // Do NOT close locally. Wait for server TradeClose -> bridge 'trade_close'
        // Otherwise you'll "fake close" and still be in TradeManager.userToSession.
    };

    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;

        if (isExiting) {
            // Fully reset state after closing so we don’t keep stale sessionId / confirmed flags
            setTrade((prev) => ({
                ...prev,
                isOpen: false,
                sessionId: 0,
                userAId: 0,
                userBId: 0,
                usernameA: "",
                usernameB: "",
                aConfirmed: false,
                bConfirmed: false,
                aSlots: EMPTY_SLOTS,
                bSlots: EMPTY_SLOTS,
            }));

            setIsExiting(false);
            onClose?.();
            return;
        }

        if (isEntering) setIsEntering(false);
    };

    const onHeaderMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);

        const onMove = (ev: MouseEvent) => moveDrag(ev.clientX, ev.clientY);
        const onUp = () => {
            stopDrag();
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // Don’t render unless open or exiting animation
    if (!trade.isOpen && !isExiting) return null;

    return (
        <div
            ref={winRef}
            className={`trade-module ${isEntering ? "is-entering" : ""} ${
                isExiting ? "is-exiting" : ""
            }`}
            style={{ position: "absolute", left: position.x, top: position.y }}
            onAnimationEnd={handleAnimEnd}
            role="dialog"
            aria-label="Trade"
        >
            <div
                className={`trade-header ${
                    headerGrabbing ? "is-grabbing" : ""
                }`}
                onMouseDown={onHeaderMouseDown}
                aria-grabbed={headerGrabbing}
            >
                Trade: {trade.usernameA} ↔ {trade.usernameB}
                <div className="trade-header-buttons">
                    <button
                        type="button"
                        className="trade-close"
                        aria-label="Close trade"
                        onClick={sendCancel}
                    />
                </div>
            </div>

            <div className="trade-body">
                <div className="trade-center">
                    <button
                        className="trade-btn trade-confirm"
                        disabled={myConfirmed} // ✅ correct side now
                        onClick={sendConfirm}
                    >
                        {myConfirmed ? "Confirmed" : "Confirm"}
                    </button>

                    <button
                        className="trade-btn trade-cancel"
                        onClick={sendCancel}
                    >
                        Cancel
                    </button>

                    {/* Optional: small status line for debugging */}
                    <div className="trade-status">
                        <div>Session: {trade.sessionId}</div>
                        <div>
                            A: {trade.usernameA}{" "}
                            {trade.aConfirmed ? "✅" : "❌"} | B:{" "}
                            {trade.usernameB} {trade.bConfirmed ? "✅" : "❌"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradeView;
