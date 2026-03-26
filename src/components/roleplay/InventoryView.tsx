import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { InventoryStore } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore";
import { InventoryContext } from "../../api/contexts/inventory/InventoryContext";
import { UseInventoryItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UseInventoryItemComposer";
import { MoveInventoryItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MoveInventoryItemComposer";
import { DeleteInventoryItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteInventoryItemComposer";
import { GetNitroInstance } from "../../api/nitro/GetNitroInstance";
import "./InventoryView.scss";

interface InventoryViewProps {
    onClose: () => void;
}

type DragPayload = { id: number; fromSlot: number };

type DragPreviewState = {
    item: InventoryContext;
    x: number;
    y: number;
} | null;

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
    const closeTimerRef = useRef<number | null>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const rafRef = useRef<number | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const isDraggingRef = useRef(false);
    const [headerGrabbing, setHeaderGrabbing] = useState(false);

    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("inventoryPos");
            if (s) return JSON.parse(s);
        } catch {}
        return { x: Math.round(window.innerWidth * 0.1), y: 100 };
    });

    const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
    const [dragInvalid, setDragInvalid] = useState(false);
    const [dragFromSlot, setDragFromSlot] = useState<number | null>(null);
    const [pulseSlot, setPulseSlot] = useState<number | null>(null);
    const [deleteHover, setDeleteHover] = useState(false);
    const [dragPreview, setDragPreview] = useState<DragPreviewState>(null);

    const [confirmDelete, setConfirmDelete] = useState<{
        invRowId: number;
        amount: number;
        name?: string;
    } | null>(null);

    const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

    const clamp = useCallback((x: number, y: number) => {
        const nitro = GetNitroInstance?.();
        const stageWidth = nitro?.renderer?.width ?? window.innerWidth;
        const stageHeight = nitro?.renderer?.height ?? window.innerHeight;
        const w = winRef.current?.offsetWidth ?? 420;
        const h = winRef.current?.offsetHeight ?? 360;
        const pad = 8;
        const maxX = Math.max(pad, stageWidth - w - pad);
        const maxY = Math.max(pad, stageHeight - h - pad);

        return {
            x: Math.min(Math.max(pad, Math.round(x)), maxX),
            y: Math.min(Math.max(pad, Math.round(y)), maxY),
        };
    }, []);

    const startDrag = (cx: number, cy: number) => {
        if (isClosing) return;

        const rect = winRef.current?.getBoundingClientRect();
        const curX = rect?.left ?? position.x;
        const curY = rect?.top ?? position.y;
        dragRef.current = { dx: cx - curX, dy: cy - curY };
        setHeaderGrabbing(true);
    };

    const moveDrag = (cx: number, cy: number) => {
        if (!dragRef.current || isClosing) return;

        const nx = cx - dragRef.current.dx;
        const ny = cy - dragRef.current.dy;
        const clamped = clamp(nx, ny);

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

    const updateDragPreviewPosition = useCallback((clientX: number, clientY: number) => {
        if (clientX <= 0 && clientY <= 0) return;

        setDragPreview((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                x: clientX,
                y: clientY,
            };
        });
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsOpen(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("inventoryPos", JSON.stringify(position));
        } catch {}
    }, [position]);

    useEffect(() => {
        const handleWindowDragOver = (e: DragEvent) => {
            updateDragPreviewPosition(e.clientX, e.clientY);
        };

        const handleWindowDragEnd = () => {
            isDraggingRef.current = false;
            setDragPreview(null);
            setDragOverSlot(null);
            setDragInvalid(false);
            setDragFromSlot(null);
            setDeleteHover(false);
        };

        window.addEventListener("dragover", handleWindowDragOver);
        window.addEventListener("dragend", handleWindowDragEnd);
        window.addEventListener("drop", handleWindowDragEnd);

        return () => {
            window.removeEventListener("dragover", handleWindowDragOver);
            window.removeEventListener("dragend", handleWindowDragEnd);
            window.removeEventListener("drop", handleWindowDragEnd);
        };
    }, [updateDragPreviewPosition]);

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
        window.removeEventListener("touchmove", onTouchMove as EventListener);
        window.removeEventListener("touchend", onTouchEnd as EventListener);
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

    const isWeaponOrShieldType = (item?: InventoryContext) =>
        !!item && ["weapon", "shield"].includes((item.item_type || "").toLowerCase());

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
            window.removeEventListener("touchmove", onTouchMove as EventListener);
            window.removeEventListener("touchend", onTouchEnd as EventListener);

            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
        };
    }, [onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

    const getDurabilityMax = (item: InventoryContext) => {
        if (!isWeaponOrShieldType(item)) return 0;
        const md = (item as any)?.max_durability;
        if (typeof md === "number") return md;
        return 100;
    };

    const getDurabilityPercent = (item: InventoryContext) => {
        if (!isWeaponOrShieldType(item)) return 0;
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

    const handleItemClick = (item: InventoryContext) => {
        if (isDraggingRef.current || isClosing) return;
        GetCommunication().connection.send(new UseInventoryItemComposer(item.id));
    };

    const markDeleting = (invRowId: number) => {
        setDeletingIds((prev) => {
            const next = new Set(prev);
            next.add(invRowId);
            return next;
        });

        window.setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== invRowId));
            setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(invRowId);
                return next;
            });
        }, 180);
    };

    const confirmDeleteYes = () => {
        if (!confirmDelete) return;

        const { invRowId, amount } = confirmDelete;
        const item = items.find((i) => i.id === invRowId);

        if (!item) {
            setConfirmDelete(null);
            setDeleteHover(false);
            return;
        }

        if (item.quantity > amount) {
            setItems((prev) =>
                prev.map((it) => (it.id === invRowId ? { ...it, quantity: it.quantity - amount } : it)),
            );
        } else {
            markDeleting(invRowId);
        }

        GetCommunication().connection.send(new DeleteInventoryItemComposer(invRowId, amount));
        setConfirmDelete(null);
        setDeleteHover(false);
    };

    const confirmDeleteNo = () => {
        setConfirmDelete(null);
        setDeleteHover(false);
    };

    const onItemDragStart = (e: React.DragEvent, item: InventoryContext) => {
        if (isClosing) return;

        isDraggingRef.current = true;
        setDragFromSlot(item.slot);
        setDragPreview({ item, x: e.clientX, y: e.clientY });

        const payload: DragPayload = { id: item.id, fromSlot: item.slot };
        e.dataTransfer.setData("application/x-inv", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";

        const transparentPixel = document.createElement("img");
        transparentPixel.src =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        e.dataTransfer.setDragImage(transparentPixel, 0, 0);

        setDragOverSlot(null);
        setDragInvalid(false);
        setDeleteHover(false);
    };

    const onItemDrag = (e: React.DragEvent) => {
        updateDragPreviewPosition(e.clientX, e.clientY);
    };

    const onItemDragEnd = () => {
        window.setTimeout(() => {
            isDraggingRef.current = false;
            setDragPreview(null);
            setDragOverSlot(null);
            setDragInvalid(false);
            setDragFromSlot(null);
            setDeleteHover(false);
        }, 0);
    };

    const triggerSlotPulse = (slot: number) => {
        setPulseSlot(slot);
        window.setTimeout(() => setPulseSlot(null), 340);
    };

    const applyLocalMove = (id: number, fromSlot: number, toSlot: number) => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, slot: toSlot } : it)));
        setDragOverSlot(null);
        setDragInvalid(false);
        triggerSlotPulse(toSlot);

        window.dispatchEvent(
            new CustomEvent("move-inventory-item", {
                detail: { id, fromSlot, toSlot },
            }),
        );
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

        if (toSlot === 2 && (moving.item_type || "").toLowerCase() === "potion" && moving.quantity > 1) {
            GetCommunication().connection.send(new MoveInventoryItemComposer(id, fromSlot, toSlot));
            triggerSlotPulse(toSlot);
            return;
        }

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
                          : it,
                ),
            );

            triggerSlotPulse(toSlot);
            GetCommunication().connection.send(new MoveInventoryItemComposer(id, fromSlot, toSlot));
            return;
        }

        applyLocalMove(id, fromSlot, toSlot);
        GetCommunication().connection.send(new MoveInventoryItemComposer(id, fromSlot, toSlot));
    };

    const onDeleteDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDeleteHover(false);

        const raw = e.dataTransfer.getData("application/x-inv");
        if (!raw) return;

        const parsed = JSON.parse(raw) as DragPayload;
        const invRowId = parsed?.id;
        if (!invRowId) return;

        const item = items.find((i) => i.id === invRowId);
        if (!item) return;

        setConfirmDelete({ invRowId, amount: 1, name: item.name });
    };

    const labelForTop = (slot: number) =>
        slot === 0 ? "Weapon" : slot === 1 ? "Shield" : slot === 2 ? "Potion" : null;

    const bottomNumberFor = (slot: number) => (slot >= 3 ? String(slot - 2) : null);

    const handleClose = () => {
        if (isClosing) return;
        stopDrag();
        setIsOpen(false);
        setIsClosing(true);
        closeTimerRef.current = window.setTimeout(() => onClose(), 190);
    };

    const confirmTitle = useMemo(() => {
        if (!confirmDelete) return "";
        return confirmDelete.name ? `Delete ${confirmDelete.name}?` : "Delete item?";
    }, [confirmDelete]);

    return (
        <>
            <div
                ref={winRef}
                className={`inventory-module ${isOpen ? "is-open" : ""} ${isClosing ? "is-closing" : ""}`}
                style={{ position: "absolute", left: position.x, top: position.y }}
                role="dialog"
                aria-label="Inventory"
            >
                <div
                    className={`inventory-header ${headerGrabbing ? "is-grabbing" : ""}`}
                    onMouseDown={onHeaderMouseDown}
                    onTouchStart={onHeaderTouchStart}
                    aria-grabbed={headerGrabbing}
                >
                    Inventory
                    <div className="inventory-header-buttons">
                        <button
                            type="button"
                            className={`inventory-delete ${deleteHover ? "is-hover" : ""}`}
                            aria-label="Delete item"
                            title="Delete item"
                            onDragEnter={(e) => {
                                e.preventDefault();
                                setDeleteHover(true);
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                setDeleteHover(true);
                            }}
                            onDragLeave={() => setDeleteHover(false)}
                            onDrop={onDeleteDrop}
                        >
                            <img src="/icons/box.png" alt="" draggable={false} />
                        </button>

                        <button
                            type="button"
                            className="inventory-close"
                            aria-label="Close inventory"
                            onClick={handleClose}
                        />
                    </div>
                </div>

                <div className="inventory-grid">
                    {Array.from({ length: 12 }, (_, slotIndex) => {
                        const item = items.find((i) => i.slot === slotIndex);
                        const topLabel = labelForTop(slotIndex);
                        const numberLabel = bottomNumberFor(slotIndex);
                        const moving = items.find((i) => i.slot === (dragFromSlot ?? -999));
                        const over = dragOverSlot === slotIndex;
                        const validOver = slotAccepts(slotIndex, moving);

                        const cls =
                            `inventory-slot` +
                            (over ? (validOver ? " slot-over" : " slot-invalid") : "") +
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
                                    const valid = slotAccepts(slotIndex, moving);
                                    e.dataTransfer.dropEffect = valid ? "move" : "none";
                                    setDragOverSlot(slotIndex);
                                    setDragInvalid(!valid);
                                }}
                                onDragLeave={() => {
                                    if (dragOverSlot === slotIndex) {
                                        setDragOverSlot(null);
                                        setDragInvalid(false);
                                    }
                                }}
                                onDrop={(e) => onSlotDrop(e, slotIndex)}
                            >
                                {topLabel && <div className="slot-label">{topLabel}</div>}

                                <div className={cls} data-invalid={dragInvalid && over ? "true" : "false"}>
                                    {!item && numberLabel && <div className="slot-number centered">{numberLabel}</div>}

                                    {item && (
                                        <div
                                            className={`inventory-item-wrapper ${deletingIds.has(item.id) ? "is-deleting" : ""}`}
                                            draggable
                                            onDragStart={(e) => onItemDragStart(e, item)}
                                            onDrag={onItemDrag}
                                            onDragEnd={onItemDragEnd}
                                            onClick={() => handleItemClick(item)}
                                        >
                                            <img src={item.icon_path} alt={item.name} draggable={false} />

                                            {item.quantity > 1 && <div className="quantity-label">x{item.quantity}</div>}

                                            {isWeaponOrShieldType(item) && typeof item.durability === "number" && (
                                                <div className="durability-bar">
                                                    <div
                                                        className="durability-fill"
                                                        style={{
                                                            width: `${getDurabilityPercent(item)}%`,
                                                            backgroundColor: getDurabilityColor(item),
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {numberLabel && <div className="slot-number filled-corner">{numberLabel}</div>}

                                            <div className="item-tooltip" role="tooltip">
                                                {item.name}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {confirmDelete && (
                    <div className="inventory-delete-confirm-backdrop">
                        <div className="inventory-delete-confirm" role="dialog" aria-label="Delete confirmation">
                            <div className="confirm-text">
                                <strong>{confirmTitle}</strong>
                                <span>Delete {confirmDelete.amount} from this slot?</span>
                            </div>

                            <div className="confirm-actions">
                                <button className="btn-cancel" onClick={confirmDeleteNo}>
                                    Cancel
                                </button>
                                <button className="btn-delete" onClick={confirmDeleteYes}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {dragPreview && (
                <div
                    className="inventory-drag-preview"
                    style={{
                        left: dragPreview.x,
                        top: dragPreview.y,
                    }}
                >
                    <img src={dragPreview.item.icon_path} alt={dragPreview.item.name} draggable={false} />
                </div>
            )}
        </>
    );
};

export default InventoryView;
