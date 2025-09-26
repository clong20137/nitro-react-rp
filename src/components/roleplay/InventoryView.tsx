import React, { FC, useEffect, useRef, useState, useCallback } from "react";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { InventoryStore } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore";
import { InventoryContext } from "../../api/contexts/inventory/InventoryContext";
import { UseInventoryItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UseInventoryItemComposer";
import { GetNitroInstance } from "../../api/nitro/GetNitroInstance";
import "./InventoryView.scss";

interface InventoryViewProps {
    onClose: () => void;
}

type DragPayload = { id: number; fromSlot: number };

const isType = (it: InventoryContext | undefined, t: string) =>
    (it?.item_type || "").toLowerCase() === t;

const slotAccepts = (slot: number, it: InventoryContext | undefined) => {
    if (slot === 0) return isType(it, "weapon");
    if (slot === 1) return isType(it, "shield");
    if (slot === 2) return isType(it, "potion");
    return true;
};

export const InventoryView: FC<InventoryViewProps> = ({ onClose }) => {
    const [items, setItems] = useState<InventoryContext[]>([]);
    const winRef = useRef<HTMLDivElement>(null);

    // animation mount/unmount
    const [isEntering, setIsEntering] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    // rAF throttle for dragging the window
    const rafRef = useRef<number | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const isDraggingRef = useRef(false);
    const [headerGrabbing, setHeaderGrabbing] = useState(false);

    // persisted position
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("inventoryPos");
            if (s) return JSON.parse(s);
        } catch {}
        return { x: Math.round(window.innerWidth * 0.1), y: 100 };
    });

    // stage-aware clamp
    const clamp = useCallback((x: number, y: number) => {
        const nitro = GetNitroInstance?.();
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

        const pad = 8;
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
        setHeaderGrabbing(true);
    };

    const moveDrag = (cx: number, cy: number) => {
        if (!dragRef.current) return;
        const nx = cx - dragRef.current.dx;
        const ny = cy - dragRef.current.dy;
        const { x, y, maxX, maxY } = clamp(nx, ny);
        const clamped = { x: Math.min(x, maxX), y: Math.min(y, maxY) };
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setPosition(clamped));
    };

    const stopDrag = () => {
        dragRef.current = null;
        setHeaderGrabbing(false);
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    useEffect(() => {
        try {
            localStorage.setItem("inventoryPos", JSON.stringify(position));
        } catch {}
    }, [position]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        moveDrag(e.clientX, e.clientY);
    }, []);
    const onMouseUp = useCallback(() => {
        stopDrag();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    }, [onMouseMove]);

    const onTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        if (t) moveDrag(t.clientX, t.clientY);
    }, []);
    const onTouchEnd = useCallback(() => {
        stopDrag();
        window.removeEventListener("touchmove", onTouchMove as any);
        window.removeEventListener("touchend", onTouchEnd as any);
    }, [onTouchMove]);

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

    // data subscription
    useEffect(() => {
        const comm = GetCommunication();
        comm.connection.send(new RequestInventoryItemsComposer());
        setItems(InventoryStore.getItems());
        const unsub = InventoryStore.onUpdate((next) => setItems(next));

        return () => {
            unsub?.();
            InventoryStore.clearListeners?.();
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("touchmove", onTouchMove as any);
            window.removeEventListener("touchend", onTouchEnd as any);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

    // durability helpers
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

    // interactions
    const handleItemClick = (item: InventoryContext) => {
        if (isDraggingRef.current) return;
        GetCommunication().connection.send(
            new UseInventoryItemComposer(item.id)
        );
    };

    const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
    const [dragInvalid, setDragInvalid] = useState(false);
    const [dragFromSlot, setDragFromSlot] = useState<number | null>(null);
    const [pulseSlot, setPulseSlot] = useState<number | null>(null);

    // Transparent drag image to avoid native “jump”
    const transparentImgRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.width = 1;
        img.height = 1;
        // 1x1 transparent PNG
        img.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        transparentImgRef.current = img;
    }, []);

    const onItemDragStart = (e: React.DragEvent, item: InventoryContext) => {
        isDraggingRef.current = true;
        setDragFromSlot(item.slot);
        const payload: DragPayload = { id: item.id, fromSlot: item.slot };
        e.dataTransfer.setData("application/x-inv", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";

        // Use transparent drag image so the browser ghost doesn’t shift left
        if (transparentImgRef.current) {
            e.dataTransfer.setDragImage(transparentImgRef.current, 0, 0);
        }

        setDragOverSlot(null);
        setDragInvalid(false);
    };
    const onItemDragEnd = () =>
        setTimeout(() => (isDraggingRef.current = false), 0);

    const applyLocalMove = (id: number, fromSlot: number, toSlot: number) => {
        setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, slot: toSlot } : it))
        );
        setDragOverSlot(null);
        setDragInvalid(false);
        setPulseSlot(toSlot);
        window.setTimeout(() => setPulseSlot(null), 260);

        window.dispatchEvent(
            new CustomEvent("move-inventory-item", {
                detail: { id, fromSlot, toSlot },
            })
        );
    };

    const syncEquipStateAfterDrop = (
        movingId: number,
        movingNewSlot: number,
        occupying?: { id: number; newSlot: number }
    ) => {
        const toggleEquip = (id: number, newSlot: number) => {
            GetCommunication().connection.send(
                new UseInventoryItemComposer(id)
            );
        };

        const movingEndsInEquip = movingNewSlot <= 2;
        const movingWasInEquip = (dragFromSlot ?? -1) <= 2;
        if (movingEndsInEquip !== movingWasInEquip)
            toggleEquip(movingId, movingNewSlot);

        if (occupying) toggleEquip(occupying.id, occupying.newSlot);
    };

    const onSlotDrop = (e: React.DragEvent, toSlot: number) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData("application/x-inv");
        setDragOverSlot(null);
        setDragInvalid(false);
        if (!raw) return;

        const { id, fromSlot } = JSON.parse(raw) as DragPayload;
        if (toSlot === fromSlot) return;

        const moving = items.find((i) => i.id === id);
        if (!moving) return;

        if (!slotAccepts(toSlot, moving)) {
            setDragInvalid(true);
            return;
        }

        const occupying = items.find((i) => i.slot === toSlot);

        if (occupying) {
            setItems((prev) =>
                prev.map((it) =>
                    it.id === moving.id
                        ? { ...it, slot: toSlot }
                        : it.id === occupying.id
                        ? { ...it, slot: fromSlot }
                        : it
                )
            );
            setPulseSlot(toSlot);
            window.setTimeout(() => setPulseSlot(null), 260);

            window.dispatchEvent(
                new CustomEvent("move-inventory-item", {
                    detail: { id, fromSlot, toSlot, swapWith: occupying.id },
                })
            );

            syncEquipStateAfterDrop(moving.id, toSlot, {
                id: occupying.id,
                newSlot: fromSlot,
            });
        } else {
            applyLocalMove(id, fromSlot, toSlot);
            syncEquipStateAfterDrop(moving.id, toSlot);
        }
    };

    const labelForTop = (slot: number) =>
        slot === 0
            ? "Weapon"
            : slot === 1
            ? "Shield"
            : slot === 2
            ? "Potion"
            : null;

    const bottomNumberFor = (slot: number) =>
        slot >= 3 ? String(slot - 2) : null;

    // Close with exit animation
    const handleClose = () => {
        if (isExiting) return;
        setIsExiting(true);
    };
    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;
        if (isExiting) onClose();
        if (isEntering) setIsEntering(false);
    };

    return (
        <div
            ref={winRef}
            className={`inventory-module ${isEntering ? "is-entering" : ""} ${
                isExiting ? "is-exiting" : ""
            }`}
            style={{ position: "absolute", left: position.x, top: position.y }}
            onAnimationEnd={handleAnimEnd}
            role="dialog"
            aria-label="Inventory"
        >
            <div
                className={`inventory-header ${
                    headerGrabbing ? "is-grabbing" : ""
                }`}
                onMouseDown={onHeaderMouseDown}
                onTouchStart={onHeaderTouchStart}
                aria-grabbed={headerGrabbing}
            >
                Inventory
                <button
                    type="button"
                    className="inventory-close"
                    aria-label="Close inventory"
                    onClick={handleClose}
                />
            </div>

            <div className="inventory-grid">
                {Array.from({ length: 12 }, (_, slotIndex) => {
                    const item = items.find((i) => i.slot === slotIndex);
                    const topLabel = labelForTop(slotIndex);
                    const numberLabel = bottomNumberFor(slotIndex);

                    const moving = items.find(
                        (i) => i.slot === (dragFromSlot ?? -999)
                    );
                    const over = dragOverSlot === slotIndex;
                    const validOver = slotAccepts(slotIndex, moving);

                    const cls =
                        `inventory-slot` +
                        (over
                            ? validOver
                                ? " slot-over"
                                : " slot-invalid"
                            : "") +
                        (item?.rarity ? ` rarity-${item.rarity}` : "") +
                        (topLabel ? ` active-${topLabel.toLowerCase()}` : "") +
                        (pulseSlot === slotIndex ? " slot-drop-pulse" : "");

                    return (
                        <div
                            key={slotIndex}
                            className="slot-wrapper"
                            onDragEnter={(e) => {
                                e.preventDefault();
                                setDragOverSlot(slotIndex);
                                setDragInvalid(!slotAccepts(slotIndex, moving));
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                const v = slotAccepts(slotIndex, moving);
                                e.dataTransfer.dropEffect = v ? "move" : "none";
                                setDragOverSlot(slotIndex);
                                setDragInvalid(!v);
                            }}
                            onDragLeave={() => {
                                if (dragOverSlot === slotIndex) {
                                    setDragOverSlot(null);
                                    setDragInvalid(false);
                                }
                            }}
                            onDrop={(e) => onSlotDrop(e, slotIndex)}
                        >
                            {topLabel && (
                                <div className="slot-label">{topLabel}</div>
                            )}

                            <div className={cls}>
                                {!item && numberLabel && (
                                    <div className="slot-number centered">
                                        {numberLabel}
                                    </div>
                                )}

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

                                        {item.quantity > 1 && (
                                            <div className="quantity-label">
                                                x{item.quantity}
                                            </div>
                                        )}

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

                                        {numberLabel && (
                                            <div className="slot-number filled-corner">
                                                {numberLabel}
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
