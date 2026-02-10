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
import { TradeAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TradeAddItemComposer";

import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { InventoryStore } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore";
import { InventoryContext } from "../../api/contexts/inventory/InventoryContext";

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

type DragPayload =
    | { kind: "inv"; invRowId: number; quantity: number }
    | { kind: "trade"; slotIndex: number; invRowId: number };

const DRAG_MIME = "application/x-olympus-trade";

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

    const [invItems, setInvItems] = useState<InventoryContext[]>([]);

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

        const w = winRef.current?.offsetWidth ?? 740;
        const h = winRef.current?.offsetHeight ?? 520;

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

    // Who am I?
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

    const mySideSlots = iAmA
        ? trade.aSlots
        : iAmB
        ? trade.bSlots
        : trade.aSlots;
    const otherSideSlots = iAmA
        ? trade.bSlots
        : iAmB
        ? trade.aSlots
        : trade.bSlots;

    const otherName = iAmA
        ? trade.usernameB
        : iAmB
        ? trade.usernameA
        : trade.usernameB;
    const myName = iAmA
        ? trade.usernameA
        : iAmB
        ? trade.usernameB
        : trade.usernameA;

    // transparent drag image
    const transparentImgRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.width = 1;
        img.height = 1;
        img.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        transparentImgRef.current = img;
    }, []);

    // Inventory subscription (so Trade window can show inventory)
    useEffect(() => {
        const comm = GetCommunication();
        comm.connection.send(new RequestInventoryItemsComposer());

        setInvItems(InventoryStore.getItems());
        const unsub = InventoryStore.onUpdate((next) => setInvItems(next));

        return () => {
            unsub?.();
            InventoryStore.clearListeners?.();
        };
    }, []);

    // bridge listeners
    const cancelTimeoutRef = useRef<number | null>(null);

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

            // refresh inventory when trade opens
            GetCommunication().connection.send(
                new RequestInventoryItemsComposer()
            );
        };

        const onUpdate = (e: any) => {
            const d = e?.detail ?? {};

            setTrade((prev) => {
                const next = {
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
                };

                // ✅ Close once both confirmed (requested)
                if (next.aConfirmed && next.bConfirmed) {
                    setIsExiting(true);
                }

                return next;
            });
        };

        const onCloseEvent = () => {
            if (cancelTimeoutRef.current) {
                window.clearTimeout(cancelTimeoutRef.current);
                cancelTimeoutRef.current = null;
            }
            setIsExiting(true);
        };

        const onResult = (e: any) => {
            // If server sends result -> also close
            const d = e?.detail ?? {};
            if (d?.success) setIsExiting(true);
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
        if (myConfirmed) return;

        GetCommunication().connection.send(
            new TradeConfirmComposer(trade.sessionId)
        );
        // Wait for trade_update / trade_close
    };

    const sendCancel = () => {
        if (!trade.sessionId) return;

        GetCommunication().connection.send(
            new TradeCancelComposer(trade.sessionId)
        );

        // ✅ Do not instantly close (prevents “closed but still in trade”)
        // Fallback if server doesn't respond:
        if (cancelTimeoutRef.current)
            window.clearTimeout(cancelTimeoutRef.current);
        cancelTimeoutRef.current = window.setTimeout(() => {
            setIsExiting(true);
            cancelTimeoutRef.current = null;
        }, 900);
    };

    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;

        if (isExiting) {
            setTrade({
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

    // Trade DnD
    const offerItemToSlot = (
        slotIndex: number,
        invRowId: number,
        quantity: number = 1
    ) => {
        if (!trade.sessionId) return;
        if (myConfirmed) return; // cannot change once confirmed

        GetCommunication().connection.send(
            new TradeAddItemComposer(
                trade.sessionId,
                invRowId,
                quantity,
                slotIndex
            )
        );
    };

    const onInvDragStart = (
        e: React.DragEvent,
        invRowId: number,
        quantity: number
    ) => {
        const payload: DragPayload = {
            kind: "inv",
            invRowId,
            quantity: Number(quantity ?? 1),
        };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";

        if (transparentImgRef.current)
            e.dataTransfer.setDragImage(transparentImgRef.current, 0, 0);
    };

    const onTradeSlotDrop = (e: React.DragEvent, slotIndex: number) => {
        e.preventDefault();
        if (myConfirmed) return;

        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return;

        let parsed: DragPayload | null = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        if (!parsed) return;

        if (parsed.kind === "inv") {
            // Default: offer 1 from stack
            offerItemToSlot(slotIndex, parsed.invRowId, 1);

            // If you want drag = full stack instead, swap to:
            // offerItemToSlot(slotIndex, parsed.invRowId, parsed.quantity);
        }
    };

    // render helpers
    const slotClass = (it: TradeSlot, disabled: boolean) => {
        const base =
            "inventory-slot trade-slot" +
            (it?.rarity ? ` rarity-${String(it.rarity).toLowerCase()}` : "");

        return disabled ? `${base} is-disabled` : base;
    };

    const invSlotNumberFor = (slot: number) =>
        slot >= 3 ? String(slot - 2) : null;

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
            {/* ✅ Header copied from InventoryView styling */}
            <div
                className={`trade-header inventory-header ${
                    headerGrabbing ? "is-grabbing" : ""
                }`}
                onMouseDown={onHeaderMouseDown}
                aria-grabbed={headerGrabbing}
            >
                Trading: {trade.usernameA} - {trade.usernameB}
                <div className="inventory-header-buttons">
                    <button
                        type="button"
                        className="inventory-close"
                        aria-label="Close trade"
                        onClick={sendCancel}
                    />
                </div>
            </div>

            <div className="trade-body">
                {/* Offers */}
                <div className="trade-offers">
                    <div className="trade-side">
                        <div className="trade-side-title">
                            {myName} {myConfirmed ? "✅" : "❌"}
                        </div>

                        <div
                            className={`trade-slots-grid ${
                                myConfirmed ? "side-confirmed" : ""
                            }`}
                        >
                            {mySideSlots.map((it, idx) => (
                                <div
                                    key={`my-${idx}`}
                                    className="slot-wrapper"
                                    onDragOver={(e) => {
                                        if (myConfirmed) return;
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";
                                    }}
                                    onDrop={(e) => onTradeSlotDrop(e, idx)}
                                >
                                    <div className={slotClass(it, myConfirmed)}>
                                        {it?.hasItem && (
                                            <div
                                                className="inventory-item-wrapper"
                                                title={it.name || ""}
                                            >
                                                {!!it.icon && (
                                                    <img
                                                        src={it.icon}
                                                        alt={it.name || ""}
                                                        draggable={false}
                                                    />
                                                )}
                                                {(it.quantity ?? 0) > 1 && (
                                                    <div className="quantity-label">
                                                        x{it.quantity}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {myConfirmed && (
                            <div className="trade-side-lock">
                                Confirmed and locked!
                            </div>
                        )}
                    </div>

                    <div className="trade-center">
                        <button
                            className="trade-btn trade-confirm"
                            disabled={
                                myConfirmed ||
                                (trade.aConfirmed && trade.bConfirmed)
                            }
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

                    <div className="trade-side">
                        <div className="trade-side-title">
                            {otherName} {otherConfirmed ? "✅" : "❌"}
                        </div>

                        <div
                            className={`trade-slots-grid ${
                                otherConfirmed ? "side-confirmed" : ""
                            }`}
                        >
                            {otherSideSlots.map((it, idx) => (
                                <div
                                    key={`other-${idx}`}
                                    className="slot-wrapper"
                                >
                                    <div
                                        className={slotClass(
                                            it,
                                            true /* other side always non-droppable */
                                        )}
                                    >
                                        {it?.hasItem && (
                                            <div
                                                className="inventory-item-wrapper"
                                                title={it.name || ""}
                                            >
                                                {!!it.icon && (
                                                    <img
                                                        src={it.icon}
                                                        alt={it.name || ""}
                                                        draggable={false}
                                                    />
                                                )}
                                                {(it.quantity ?? 0) > 1 && (
                                                    <div className="quantity-label">
                                                        x{it.quantity}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {otherConfirmed && (
                            <div className="trade-side-lock">
                                Confirmed — locked
                            </div>
                        )}
                    </div>
                </div>

                {/* My Inventory (same slot size/style as InventoryView) */}
                <div className="trade-inventory">
                    <div className="trade-inventory-title">
                        Your Inventory (drag into your trade slots)
                    </div>

                    <div className="inventory-grid trade-inventory-grid">
                        {Array.from({ length: 12 }, (_, slotIndex) => {
                            const it = invItems.find(
                                (i) => i.slot === slotIndex
                            );
                            const numberLabel = invSlotNumberFor(slotIndex);

                            return (
                                <div
                                    key={`inv-${slotIndex}`}
                                    className="slot-wrapper"
                                >
                                    <div
                                        className={`inventory-slot ${
                                            myConfirmed ? "is-disabled" : ""
                                        }`}
                                    >
                                        {!it && numberLabel && (
                                            <div className="slot-number centered">
                                                {numberLabel}
                                            </div>
                                        )}

                                        {it && (
                                            <div
                                                className="inventory-item-wrapper"
                                                draggable={!myConfirmed}
                                                onDragStart={(e) =>
                                                    onInvDragStart(
                                                        e,
                                                        it.id,
                                                        Number(it.quantity ?? 1)
                                                    )
                                                }
                                                title={it.name}
                                            >
                                                <img
                                                    src={it.icon_path}
                                                    alt={it.name}
                                                    draggable={false}
                                                />
                                                {it.quantity > 1 && (
                                                    <div className="quantity-label">
                                                        x{it.quantity}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {myConfirmed && (
                        <div className="trade-inventory-hint">
                            You have confirmed your trade, the trade is now
                            locked.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TradeView;
