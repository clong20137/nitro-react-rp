import React, { FC, useEffect, useRef, useState, useCallback } from "react";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { InventoryStore } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore";
import { InventoryContext } from "../../api/contexts/inventory/InventoryContext";
import { UseInventoryItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UseInventoryItemComposer";
import { GetNitroInstance } from "../../api/nitro/GetNitroInstance"; // <- renderer size
import "./InventoryView.scss";

interface InventoryViewProps {
    onClose: () => void;
}

type DragPayload = { id: number; fromSlot: number };

export const InventoryView: FC<InventoryViewProps> = ({ onClose }) => {
    const [items, setItems] = useState<InventoryContext[]>([]);
    const winRef = useRef<HTMLDivElement>(null);

    // rAF throttle for dragging
    const rafRef = useRef<number | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const isDraggingRef = useRef(false);

    // load persisted position (with sane default)
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("inventoryPos");
            if (s) return JSON.parse(s);
        } catch {}
        return { x: Math.round(window.innerWidth * 0.1), y: 100 };
    });

    // --- helpers -----------------------------------------------------

    // stage-aware clamp (Nitro renderer size > window fallback)
    const clamp = useCallback((x: number, y: number) => {
        const nitro = GetNitroInstance?.();
        // Some builds expose .renderer (PIXI) with width/height, others use .stageSize
        const stageWidth =
            // @ts-ignore
            nitro?.renderer?.width ??
            // @ts-ignore
            nitro?.stageSize?.width ??
            window.innerWidth;

        const stageHeight =
            // @ts-ignore
            nitro?.renderer?.height ??
            // @ts-ignore
            nitro?.stageSize?.height ??
            window.innerHeight;

        const w = winRef.current?.offsetWidth ?? 420;
        const h = winRef.current?.offsetHeight ?? 360;

        const pad = 8; // breathing room from edges
        const maxX = Math.max(pad, stageWidth - w - pad);
        const maxY = Math.max(pad, stageHeight - h - pad);

        return {
            x: Math.min(Math.max(pad, Math.round(x))),
            y: Math.min(Math.max(pad, Math.round(y))),
            maxX,
            maxY,
        };
    }, []);

    const startDrag = (cx: number, cy: number) => {
        const rect = winRef.current?.getBoundingClientRect();
        const curX = rect?.left ?? position.x;
        const curY = rect?.top ?? position.y;
        dragRef.current = { dx: cx - curX, dy: cy - curY };
    };

    const moveDrag = (cx: number, cy: number) => {
        if (!dragRef.current) return;
        const nx = cx - dragRef.current.dx;
        const ny = cy - dragRef.current.dy;
        const { x, y, maxX, maxY } = clamp(nx, ny);

        // if your stage is smaller than the window, make sure we never “stick”
        const clamped = { x: Math.min(x, maxX), y: Math.min(y, maxY) };

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setPosition(clamped));
    };

    const stopDrag = () => {
        dragRef.current = null;
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    // persist position when it changes
    useEffect(() => {
        try {
            localStorage.setItem("inventoryPos", JSON.stringify(position));
        } catch {}
    }, [position]);

    // --- global listeners (created once) -----------------------------

    const onMouseMove = useCallback((e: MouseEvent) => {
        moveDrag(e.clientX, e.clientY);
    }, []);

    const onMouseUp = useCallback(() => {
        stopDrag();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    }, [onMouseMove]);

    const onTouchMove = useCallback((e: TouchEvent) => {
        // we actively drag; prevent the page from scrolling
        e.preventDefault();
        const t = e.touches[0];
        if (t) moveDrag(t.clientX, t.clientY);
    }, []);

    const onTouchEnd = useCallback(() => {
        stopDrag();
        window.removeEventListener("touchmove", onTouchMove as any);
        window.removeEventListener("touchend", onTouchEnd as any);
    }, [onTouchMove]);

    // header press starts the drag
    const onHeaderMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    const onHeaderTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        startDrag(t.clientX, t.clientY);
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
    };

    // --- data subscription -------------------------------------------

    useEffect(() => {
        const comm = GetCommunication();
        comm.connection.send(new RequestInventoryItemsComposer());
        setItems(InventoryStore.getItems());

        const unsub = InventoryStore.onUpdate((next) => setItems(next));

        return () => {
            unsub?.(); // if your store returns an unsubscribe
            InventoryStore.clearListeners?.();
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("touchmove", onTouchMove as any);
            window.removeEventListener("touchend", onTouchEnd as any);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

    // --- durability helpers ------------------------------------------

    const getDurabilityMax = (item: InventoryContext) => {
        const md = (item as any)?.max_durability;
        if (typeof md === "number") return md;
        const t = (item.item_type || "").toLowerCase();
        if (t === "potion") return 30;
        return 100;
    };

    const getDurabilityPercent = (item: InventoryContext) => {
        if (typeof item.durability !== "number") return 0;
        const max = getDurabilityMax(item);
        const pct = (item.durability / Math.max(1, max)) * 100;
        return Math.max(0, Math.min(100, pct));
    };

    const getDurabilityColor = (item: InventoryContext) => {
        const pct = getDurabilityPercent(item);
        if (pct > 66) return "#5bc236";
        if (pct > 33) return "#f4c542";
        return "#e74c3c";
    };

    // --- interactions -------------------------------------------------

    const handleItemClick = (item: InventoryContext) => {
        if (isDraggingRef.current) return;
        GetCommunication().connection.send(
            new UseInventoryItemComposer(item.id)
        );
    };

    const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
    const [dragInvalid, setDragInvalid] = useState(false);

    const onItemDragStart = (e: React.DragEvent, item: InventoryContext) => {
        isDraggingRef.current = true;
        const payload: DragPayload = { id: item.id, fromSlot: item.slot };
        e.dataTransfer.setData("application/x-inv", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";
        setDragOverSlot(null);
        setDragInvalid(false);
    };

    const onItemDragEnd = () =>
        setTimeout(() => (isDraggingRef.current = false), 0);

    const onSlotDrop = (e: React.DragEvent, _slotIndex: number) => {
        e.preventDefault();
        setDragOverSlot(null);
        setDragInvalid(false);
        const raw = e.dataTransfer.getData("application/x-inv");
        if (!raw) return;
        const { id } = JSON.parse(raw) as DragPayload;
        const moving = items.find((i) => i.id === id);
        if (!moving) return;

        // TODO: Replace with MoveInventoryItemComposer(fromSlot, toSlot) if supported.
        GetCommunication().connection.send(
            new UseInventoryItemComposer(moving.id)
        );
    };

    const labelFor = (slot: number) =>
        slot === 0
            ? "Weapon"
            : slot === 1
            ? "Shield"
            : slot === 2
            ? "Potion"
            : null;

    // --- render ------------------------------------------------------

    return (
        <div
            ref={winRef}
            className="inventory-module"
            style={{ position: "absolute", left: position.x, top: position.y }}
        >
            <div
                className="inventory-header"
                onMouseDown={onHeaderMouseDown}
                onTouchStart={onHeaderTouchStart}
            >
                Inventory
                <div className="close-button" onClick={onClose}>
                    ✖
                </div>
            </div>

            <div className="inventory-grid">
                {Array.from({ length: 12 }, (_, slotIndex) => {
                    const item = items.find((i) => i.slot === slotIndex);
                    const slotClass =
                        `inventory-slot ${
                            slotIndex === 0
                                ? "active-weapon"
                                : slotIndex === 1
                                ? "active-shield"
                                : slotIndex === 2
                                ? "active-potion"
                                : ""
                        } ${item?.rarity ? `rarity-${item.rarity}` : ""} ` +
                        (dragOverSlot === slotIndex
                            ? dragInvalid
                                ? "slot-invalid"
                                : "slot-over"
                            : "");

                    return (
                        <div
                            key={slotIndex}
                            className="slot-wrapper"
                            onDragEnter={(e) => {
                                e.preventDefault();
                                setDragOverSlot(slotIndex);
                                setDragInvalid(false);
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                setDragOverSlot(slotIndex);
                            }}
                            onDragLeave={() => {
                                if (dragOverSlot === slotIndex) {
                                    setDragOverSlot(null);
                                    setDragInvalid(false);
                                }
                            }}
                            onDrop={(e) => onSlotDrop(e, slotIndex)}
                        >
                            {slotIndex < 3 && (
                                <div className="slot-label">
                                    {labelFor(slotIndex)}
                                </div>
                            )}

                            <div className={slotClass}>
                                {item && (
                                    <div
                                        className="inventory-item-wrapper"
                                        draggable
                                        onDragStart={(e) =>
                                            onItemDragStart(e, item)
                                        }
                                        onDragEnd={onItemDragEnd}
                                        onClick={() => handleItemClick(item)}
                                        title={item.name}
                                    >
                                        <img
                                            src={item.icon_path}
                                            alt={item.name}
                                            draggable={false}
                                        />

                                        {typeof item.durability ===
                                            "number" && (
                                            <div className="durability-bar">
                                                <div
                                                    className="durability-fill"
                                                    style={{
                                                        width: `${getDurabilityPercent(
                                                            item
                                                        )}%`,
                                                        backgroundColor:
                                                            getDurabilityColor(
                                                                item
                                                            ),
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {item.quantity > 1 && (
                                            <div className="quantity-label">
                                                x{item.quantity}
                                            </div>
                                        )}

                                        <div className="item-tooltip">
                                            <strong>{item.name}</strong>
                                            <br />
                                            Type: {item.item_type}
                                            <br />
                                            {!!item.stats?.damage && (
                                                <>
                                                    Damage: {item.stats.damage}
                                                    <br />
                                                </>
                                            )}
                                            {!!item.stats?.healing && (
                                                <>
                                                    Heals: {item.stats.healing}
                                                    <br />
                                                </>
                                            )}
                                            {!!item.stats?.defense && (
                                                <>
                                                    Defense:{" "}
                                                    {item.stats.defense}
                                                    <br />
                                                </>
                                            )}
                                            {typeof item.durability ===
                                                "number" && (
                                                <>
                                                    Durability:{" "}
                                                    {item.durability}/
                                                    {getDurabilityMax(item)}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InventoryView;
