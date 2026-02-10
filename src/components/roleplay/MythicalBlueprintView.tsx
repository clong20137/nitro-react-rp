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

import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { InventoryStore } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore";
import { InventoryContext } from "../../api/contexts/inventory/InventoryContext";

// ✅ Your new outgoing composers (client -> server)
import { MythicalBlueprintCloseComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCloseComposer";
import { MythicalBlueprintAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintAddItemComposer";
import { MythicalBlueprintRemoveItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintRemoveItemComposer";
import { MythicalBlueprintCraftComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCraftComposer";

import "./MythicalBlueprintView.scss";

type BlueprintState = {
    isOpen: boolean;

    sessionId: number;
    blueprintItemId: number;

    slotCount: number;

    weaponInvItemId: number;
    augmentInvItemId: number;
    optionalInvItemId: number;

    predictedUpgradeId: number;
    craftable: boolean;
};

type DragPayload = { kind: "inv"; invRowId: number; quantity: number };
const DRAG_MIME = "application/x-olympus-blueprint";

const EMPTY: BlueprintState = {
    isOpen: false,

    sessionId: 0,
    blueprintItemId: 0,

    slotCount: 3,

    weaponInvItemId: 0,
    augmentInvItemId: 0,
    optionalInvItemId: 0,

    predictedUpgradeId: 0,
    craftable: false,
};

const isType = (it: InventoryContext | undefined, t: string) =>
    (it?.item_type || "").toLowerCase() === t.toLowerCase();

const slotAccepts = (slotIndex: number, it: InventoryContext | undefined) => {
    if (slotIndex === 0) return isType(it, "weapon");
    if (slotIndex === 1) return isType(it, "augment");
    return true; // optional slot
};

export const MythicalBlueprintView: FC<{ onClose?: () => void }> = ({
    onClose,
}) => {
    const [bp, setBp] = useState<BlueprintState>(EMPTY);
    const [invItems, setInvItems] = useState<InventoryContext[]>([]);

    const winRef = useRef<HTMLDivElement>(null);

    // animations
    const [isEntering, setIsEntering] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    // persisted position (same as trade)
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("blueprintPos");
            if (s) return JSON.parse(s);
        } catch {}
        return { x: Math.round(window.innerWidth * 0.1), y: 120 };
    });

    // window drag (same pattern as trade)
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

    useEffect(() => {
        try {
            localStorage.setItem("blueprintPos", JSON.stringify(position));
        } catch {}
    }, [position]);

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

    // transparent drag image (same as trade/inventory)
    const transparentImgRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.width = 1;
        img.height = 1;
        img.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        transparentImgRef.current = img;
    }, []);

    // Inventory subscription
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

    // helpers
    const slots = useMemo(
        () => [bp.weaponInvItemId, bp.augmentInvItemId, bp.optionalInvItemId],
        [bp.weaponInvItemId, bp.augmentInvItemId, bp.optionalInvItemId]
    );

    const setSlot = (slotIndex: number, invRowId: number) => {
        setBp((prev) => {
            if (slotIndex === 0) return { ...prev, weaponInvItemId: invRowId };
            if (slotIndex === 1) return { ...prev, augmentInvItemId: invRowId };
            return { ...prev, optionalInvItemId: invRowId };
        });
    };

    const openFromBridge = (d: any) => {
        // IMPORTANT: do NOT auto-close here.
        setIsExiting(false);
        setIsEntering(true);

        setBp({
            isOpen: true,
            sessionId: Number(d?.sessionId ?? 0),
            blueprintItemId: Number(d?.blueprintItemId ?? 0),
            slotCount: Number(d?.slotCount ?? 3),

            weaponInvItemId: Number(d?.weaponInvItemId ?? 0),
            augmentInvItemId: Number(d?.augmentInvItemId ?? 0),
            optionalInvItemId: Number(d?.optionalInvItemId ?? 0),

            predictedUpgradeId: Number(d?.predictedUpgradeId ?? 0),
            craftable: !!d?.craftable,
        });

        // refresh inventory when blueprint opens (same as trade)
        GetCommunication().connection.send(new RequestInventoryItemsComposer());
    };

    const updateFromBridge = (d: any) => {
        setBp((prev) => ({
            ...prev,
            isOpen: true,
            sessionId: Number(d?.sessionId ?? prev.sessionId),
            blueprintItemId: Number(d?.blueprintItemId ?? prev.blueprintItemId),
            slotCount: Number(d?.slotCount ?? prev.slotCount),

            weaponInvItemId: Number(d?.weaponInvItemId ?? prev.weaponInvItemId),
            augmentInvItemId: Number(
                d?.augmentInvItemId ?? prev.augmentInvItemId
            ),
            optionalInvItemId: Number(
                d?.optionalInvItemId ?? prev.optionalInvItemId
            ),

            predictedUpgradeId: Number(
                d?.predictedUpgradeId ?? prev.predictedUpgradeId
            ),
            craftable:
                typeof d?.craftable === "boolean"
                    ? d.craftable
                    : prev.craftable,
        }));
    };

    // bridge listeners
    useEffect(() => {
        const onOpen = (e: any) => openFromBridge(e?.detail ?? {});
        const onUpdate = (e: any) => updateFromBridge(e?.detail ?? {});
        const onResult = (e: any) => updateFromBridge(e?.detail ?? {});
        const onCloseEvent = () => setIsExiting(true);

        window.addEventListener("mythical_blueprint_open", onOpen as any);
        window.addEventListener("mythical_blueprint_update", onUpdate as any);
        window.addEventListener("mythical_blueprint_result", onResult as any);
        window.addEventListener(
            "mythical_blueprint_close",
            onCloseEvent as any
        );

        return () => {
            window.removeEventListener(
                "mythical_blueprint_open",
                onOpen as any
            );
            window.removeEventListener(
                "mythical_blueprint_update",
                onUpdate as any
            );
            window.removeEventListener(
                "mythical_blueprint_result",
                onResult as any
            );
            window.removeEventListener(
                "mythical_blueprint_close",
                onCloseEvent as any
            );
        };
    }, []);

    // outgoing packets
    const sendClose = () => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintCloseComposer(bp.sessionId, bp.blueprintItemId)
        );
    };

    const sendCraft = () => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintCraftComposer(bp.sessionId, bp.blueprintItemId)
        );
        // wait for mythical_blueprint_result to update UI
    };

    const sendRemove = (slotIndex: number) => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintRemoveItemComposer(
                bp.sessionId,
                bp.blueprintItemId,
                slotIndex
            )
        );
    };

    const sendAdd = (
        slotIndex: number,
        invRowId: number,
        quantity: number = 1
    ) => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintAddItemComposer(
                bp.sessionId,
                bp.blueprintItemId,
                invRowId,
                quantity,
                slotIndex
            )
        );
    };

    // DnD from inventory -> blueprint slot
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

    const onSlotDrop = (e: React.DragEvent, slotIndex: number) => {
        e.preventDefault();

        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return;

        let parsed: DragPayload | null = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        if (!parsed || parsed.kind !== "inv") return;

        const it = invItems.find((i) => i.id === parsed!.invRowId);
        if (!slotAccepts(slotIndex, it)) return;

        // optimistic UI
        setSlot(slotIndex, parsed.invRowId);

        // server (consumes 1 augment on craft, not on add)
        sendAdd(slotIndex, parsed.invRowId, 1);
    };

    const handleClose = () => {
        if (isExiting) return;
        setIsExiting(true);
    };

    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;

        if (isExiting) {
            // send close AFTER animation starts (same style as your trade cancel fallback)
            sendClose();

            setBp(EMPTY);
            setIsExiting(false);
            onClose?.();
            return;
        }

        if (isEntering) setIsEntering(false);
    };

    const upgradeName = useMemo(() => {
        const id = bp.predictedUpgradeId;
        if (!id) return "—";
        if (id === 1) return "Panacea";
        if (id === 2) return "Poison";
        if (id === 3) return "Executioner";
        return `Upgrade #${id}`;
    }, [bp.predictedUpgradeId]);

    // Don’t render unless open or exiting animation
    if (!bp.isOpen && !isExiting) return null;

    return (
        <div
            ref={winRef}
            className={`mythical-blueprint-module ${
                isEntering ? "is-entering" : ""
            } ${isExiting ? "is-exiting" : ""}`}
            style={{ position: "absolute", left: position.x, top: position.y }}
            onAnimationEnd={handleAnimEnd}
            role="dialog"
            aria-label="Mythical Blueprint"
        >
            {/* header: exact same as trade/inventory */}
            <div
                className={`inventory-header ${
                    headerGrabbing ? "is-grabbing" : ""
                }`}
                onMouseDown={onHeaderMouseDown}
                aria-grabbed={headerGrabbing}
            >
                Mythical Blueprint
                <div className="inventory-header-buttons">
                    <button
                        type="button"
                        className="inventory-close"
                        aria-label="Close blueprint"
                        onClick={handleClose}
                    />
                </div>
            </div>

            <div className="trade-body">
                <div className="trade-offers">
                    {/* LEFT */}
                    <div className="trade-side">
                        <div className="trade-side-title">Slots</div>

                        <div className="trade-slots-grid">
                            {Array.from(
                                { length: bp.slotCount },
                                (_, slotIndex) => {
                                    const rowId = slots[slotIndex] || 0;
                                    const filled = rowId > 0;

                                    return (
                                        <div
                                            key={`bp-slot-${slotIndex}`}
                                            className="slot-wrapper"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect =
                                                    "move";
                                            }}
                                            onDrop={(e) =>
                                                onSlotDrop(e, slotIndex)
                                            }
                                        >
                                            <div className="inventory-slot">
                                                {!filled && (
                                                    <div className="slot-number centered">
                                                        {slotIndex === 0
                                                            ? "Weapon"
                                                            : slotIndex === 1
                                                            ? "Augment"
                                                            : "Optional"}
                                                    </div>
                                                )}

                                                {filled && (
                                                    <div className="inventory-item-wrapper">
                                                        {/* You can replace this with icon renderer later.
For now we show rowId just like debug */}
                                                        <div className="slot-number centered">
                                                            {rowId}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {filled && (
                                                <button
                                                    type="button"
                                                    className="bp-remove-mini"
                                                    onClick={() => {
                                                        setSlot(slotIndex, 0);
                                                        sendRemove(slotIndex);
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    );
                                }
                            )}
                        </div>

                        <div className="trade-inventory-hint">
                            Drag a <strong>Weapon</strong> +{" "}
                            <strong>Augment</strong> into slots.
                        </div>
                    </div>

                    {/* CENTER */}
                    <div className="trade-center">
                        <button
                            className="trade-btn trade-confirm"
                            disabled={!bp.craftable}
                            onClick={sendCraft}
                        >
                            Craft
                        </button>

                        <button
                            className="trade-btn trade-cancel"
                            onClick={handleClose}
                        >
                            Close
                        </button>

                        <div className="trade-status">
                            <div>Session: {bp.sessionId}</div>
                            <div>Blueprint: {bp.blueprintItemId}</div>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="trade-side">
                        <div className="trade-side-title">Outcome</div>

                        <div className="bp-outcome-panel">
                            <div className="bp-outcome-title">
                                {upgradeName}
                            </div>
                            <div className="bp-outcome-sub">
                                Upgrade ID: {bp.predictedUpgradeId || 0}
                            </div>

                            <div
                                className={`bp-outcome-badge ${
                                    bp.craftable ? "ok" : "bad"
                                }`}
                            >
                                {bp.craftable ? "Craftable" : "Not craftable"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory grid (same as trade) */}
                <div className="trade-inventory">
                    <div className="trade-inventory-title">
                        Your Inventory (drag into the slots)
                    </div>

                    <div className="inventory-grid trade-inventory-grid">
                        {Array.from({ length: 12 }, (_, slotIndex) => {
                            const it = invItems.find(
                                (i) => i.slot === slotIndex
                            );
                            const numberLabel =
                                slotIndex >= 3 ? String(slotIndex - 2) : null;

                            return (
                                <div
                                    key={`inv-${slotIndex}`}
                                    className="slot-wrapper"
                                >
                                    <div className="inventory-slot">
                                        {!it && numberLabel && (
                                            <div className="slot-number centered">
                                                {numberLabel}
                                            </div>
                                        )}

                                        {it && (
                                            <div
                                                className="inventory-item-wrapper"
                                                draggable
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

                    <div className="trade-inventory-hint">
                        Slot 1 only accepts <strong>weapon</strong>. Slot 2 only
                        accepts <strong>augment</strong>.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MythicalBlueprintView;
