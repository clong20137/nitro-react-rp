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

// ✅ You said these already exist. If your names differ, change the imports.
import { TradeAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TradeAddItemComposer";
import { TradeRemoveItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TradeRemoveItemComposer";

// Inventory inside Trade
import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { InventoryStore } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore";

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

type InvItem = any; // InventoryContext-like shape from your InventoryStore

type DragPayload = { id: number; from?: "inv" | "trade"; slotIndex?: number };

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

    const [invItems, setInvItems] = useState<InvItem[]>([]);
    const [invFilter, setInvFilter] = useState("");
    const [invRefreshing, setInvRefreshing] = useState(false);

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

    // Transparent drag image to avoid native ghost jump
    const transparentImgRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.width = 1;
        img.height = 1;
        img.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        transparentImgRef.current = img;
    }, []);

    const clamp = useCallback((x: number, y: number) => {
        const nitro = GetNitroInstance?.() as any;
        const sw = nitro?.renderer?.width ?? window.innerWidth;
        const sh = nitro?.renderer?.height ?? window.innerHeight;

        const w = winRef.current?.offsetWidth ?? 760;
        const h = winRef.current?.offsetHeight ?? 430;

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

    // My userId
    const myUserId = useMemo(() => {
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
    const otherConfirmed = iAmA
        ? trade.bConfirmed
        : iAmB
        ? trade.aConfirmed
        : false;

    const mySlots = iAmA ? trade.aSlots : iAmB ? trade.bSlots : trade.aSlots;
    const otherSlots = iAmA ? trade.bSlots : iAmB ? trade.aSlots : trade.bSlots;

    // Inventory subscription
    useEffect(() => {
        if (!trade.isOpen) return;

        const comm = GetCommunication();
        setInvRefreshing(true);
        comm.connection.send(new RequestInventoryItemsComposer());

        setInvItems(InventoryStore.getItems?.() ?? []);
        const unsub = InventoryStore.onUpdate?.((next: any) => {
            setInvItems(next ?? []);
            setInvRefreshing(false);
        });

        const fallbackTimer = window.setTimeout(
            () => setInvRefreshing(false),
            1200
        );

        return () => {
            window.clearTimeout(fallbackTimer);
            unsub?.();
        };
    }, [trade.isOpen]);

    const refreshInv = () => {
        const comm = GetCommunication();
        setInvRefreshing(true);
        comm.connection.send(new RequestInventoryItemsComposer());
        window.setTimeout(() => setInvRefreshing(false), 1200);
    };

    // Bridge listeners
    useEffect(() => {
        const onOpen = (e: any) => {
            const d = e?.detail ?? {};

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

        const onCloseEvent = () => setIsExiting(true);

        const onResult = (e: any) => {
            // optional: show a toast later
            // console.log("[TradeView] trade_result", e?.detail);
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
        GetCommunication().connection.send(
            new TradeConfirmComposer(trade.sessionId)
        );
    };

    const sendCancel = () => {
        if (!trade.sessionId) return;
        GetCommunication().connection.send(
            new TradeCancelComposer(trade.sessionId)
        );
        // don’t force close locally; wait for server trade_close
    };

    // Drag from inventory -> trade slot
    const onInvDragStart = (e: React.DragEvent, item: InvItem) => {
        if (myConfirmed) return;
        const payload: DragPayload = { id: Number(item.id), from: "inv" };
        e.dataTransfer.setData("application/x-trade", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";

        if (transparentImgRef.current) {
            e.dataTransfer.setDragImage(transparentImgRef.current, 0, 0);
        }
    };

    const onTradeSlotDragOver = (e: React.DragEvent) => {
        if (myConfirmed) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const addToTradeSlot = (slotIndex: number, invRowId: number) => {
        if (!trade.sessionId) return;

        // quantity: for now send 1 (you can add a quantity picker later)
        const quantity = 1;

        GetCommunication().connection.send(
            new TradeAddItemComposer(
                trade.sessionId,
                invRowId,
                quantity,
                slotIndex
            )
        );
    };

    const onTradeSlotDrop = (e: React.DragEvent, slotIndex: number) => {
        if (myConfirmed) return;
        e.preventDefault();

        const raw = e.dataTransfer.getData("application/x-trade");
        if (!raw) return;

        let payload: DragPayload | null = null;
        try {
            payload = JSON.parse(raw);
        } catch {
            return;
        }

        if (!payload?.id) return;
        const invRowId = payload.id;

        // only allow dropping onto MY side slots
        addToTradeSlot(slotIndex, invRowId);
    };

    const removeFromTradeSlot = (slotIndex: number) => {
        if (myConfirmed) return;
        if (!trade.sessionId) return;
        GetCommunication().connection.send(
            new TradeRemoveItemComposer(trade.sessionId, slotIndex)
        );
    };

    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;

        if (isExiting) {
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

    const filteredInv = useMemo(() => {
        const q = invFilter.trim().toLowerCase();
        const list = Array.isArray(invItems) ? invItems : [];
        if (!q) return list;
        return list.filter((it: any) =>
            String(it?.name ?? "")
                .toLowerCase()
                .includes(q)
        );
    }, [invItems, invFilter]);

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
                <div className="trade-columns">
                    {/* LEFT: My offer + my inventory */}
                    <div className="trade-col">
                        <div className="trade-panel-title">
                            Your Offer{" "}
                            {myConfirmed ? (
                                <span className="badge ok">Confirmed</span>
                            ) : (
                                <span className="badge">Editing</span>
                            )}
                        </div>

                        <div
                            className={`trade-slots ${
                                myConfirmed ? "is-locked" : ""
                            }`}
                        >
                            {mySlots.map((slot, idx) => (
                                <div
                                    key={idx}
                                    className={`trade-slot ${
                                        slot?.hasItem ? "has-item" : ""
                                    } ${
                                        slot?.rarity
                                            ? `rarity-${slot.rarity}`
                                            : ""
                                    }`}
                                    onDragOver={onTradeSlotDragOver}
                                    onDrop={(e) => onTradeSlotDrop(e, idx)}
                                    onClick={() =>
                                        slot?.hasItem &&
                                        removeFromTradeSlot(idx)
                                    }
                                    title={
                                        slot?.hasItem
                                            ? "Click to remove"
                                            : "Drop item here"
                                    }
                                >
                                    {slot?.hasItem ? (
                                        <>
                                            <img
                                                className="slot-icon"
                                                src={slot.icon}
                                                alt={slot.name ?? "Item"}
                                                draggable={false}
                                            />
                                            <div className="slot-name">
                                                {slot.name}
                                            </div>
                                            {slot.quantity &&
                                                slot.quantity > 1 && (
                                                    <div className="slot-qty">
                                                        x{slot.quantity}
                                                    </div>
                                                )}
                                        </>
                                    ) : (
                                        <div className="slot-empty">+</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="trade-inventory">
                            <div className="trade-inv-header">
                                <div className="trade-inv-title">
                                    Your Inventory
                                </div>
                                <div className="trade-inv-actions">
                                    <input
                                        className="trade-inv-search"
                                        value={invFilter}
                                        onChange={(e) =>
                                            setInvFilter(e.target.value)
                                        }
                                        placeholder="Search..."
                                    />
                                    <button
                                        className="trade-inv-refresh"
                                        onClick={refreshInv}
                                        type="button"
                                    >
                                        {invRefreshing ? "..." : "↻"}
                                    </button>
                                </div>
                            </div>

                            <div className="trade-inv-grid">
                                {filteredInv.map((it: any) => (
                                    <div
                                        key={it.id}
                                        className={`trade-inv-item ${
                                            it?.rarity
                                                ? `rarity-${it.rarity}`
                                                : ""
                                        }`}
                                        draggable={!myConfirmed}
                                        onDragStart={(e) =>
                                            onInvDragStart(e, it)
                                        }
                                        title={it.name}
                                    >
                                        <img
                                            src={it.icon_path}
                                            alt={it.name}
                                            draggable={false}
                                        />
                                        {it.quantity > 1 && (
                                            <div className="qty">
                                                x{it.quantity}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {filteredInv.length === 0 && (
                                    <div className="trade-inv-empty">
                                        No items
                                    </div>
                                )}
                            </div>

                            <div className="trade-hint">
                                {myConfirmed
                                    ? "You confirmed — changes are locked."
                                    : "Drag items into the 6 offer boxes. Click an offered item to remove it."}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Other offer */}
                    <div className="trade-col">
                        <div className="trade-panel-title">
                            Their Offer{" "}
                            {otherConfirmed ? (
                                <span className="badge ok">Confirmed</span>
                            ) : (
                                <span className="badge">Waiting</span>
                            )}
                        </div>

                        <div className="trade-slots is-readonly">
                            {otherSlots.map((slot, idx) => (
                                <div
                                    key={idx}
                                    className={`trade-slot ${
                                        slot?.hasItem ? "has-item" : ""
                                    } ${
                                        slot?.rarity
                                            ? `rarity-${slot.rarity}`
                                            : ""
                                    }`}
                                    title={slot?.hasItem ? slot.name : ""}
                                >
                                    {slot?.hasItem ? (
                                        <>
                                            <img
                                                className="slot-icon"
                                                src={slot.icon}
                                                alt={slot.name ?? "Item"}
                                                draggable={false}
                                            />
                                            <div className="slot-name">
                                                {slot.name}
                                            </div>
                                            {slot.quantity &&
                                                slot.quantity > 1 && (
                                                    <div className="slot-qty">
                                                        x{slot.quantity}
                                                    </div>
                                                )}
                                        </>
                                    ) : (
                                        <div className="slot-empty">—</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="trade-controls">
                            <button
                                className="trade-btn trade-confirm"
                                disabled={myConfirmed}
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

                            <div className="trade-status">
                                <div>Session: {trade.sessionId}</div>
                                <div>
                                    A: {trade.usernameA}{" "}
                                    {trade.aConfirmed ? "✅" : "❌"} | B:{" "}
                                    {trade.usernameB}{" "}
                                    {trade.bConfirmed ? "✅" : "❌"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Optional footer */}
                <div className="trade-footer">
                    <div className="trade-footer-note">
                        Tip: both players must confirm. If someone edits an
                        item, confirmations reset server-side.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradeView;
