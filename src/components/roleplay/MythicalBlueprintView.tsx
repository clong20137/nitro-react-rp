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

// ✅ Your outgoing composers (make sure these paths match your project)
import { MythicalBlueprintAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintAddItemComposer";
import { MythicalBlueprintRemoveItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintRemoveItemComposer";
import { MythicalBlueprintCraftComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCraftComposer";
import { MythicalBlueprintCloseComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCloseComposer";

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

type DragPayload =
    | { kind: "inv"; invRowId: number; quantity: number }
    | { kind: "slot"; slotIndex: number; invRowId: number };

const DRAG_MIME = "application/x-olympus-blueprint";

const isType = (it: InventoryContext | undefined, t: string) =>
    (it?.item_type || "").toLowerCase() === t;

const slotAccepts = (slot: number, it: InventoryContext | undefined) => {
    // slot 0 = weapon, slot 1 = augment, slot 2 = optional (anything)
    if (slot === 0) return isType(it, "weapon");
    if (slot === 1) return isType(it, "augment");
    return true;
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

    // persisted position (same idea as trade)
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("mythicalBlueprintPos");
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

    useEffect(() => {
        try {
            localStorage.setItem(
                "mythicalBlueprintPos",
                JSON.stringify(position)
            );
        } catch {}
    }, [position]);

    // Transparent drag image (prevents native "big preview")
    const transparentImgRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.width = 1;
        img.height = 1;
        img.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        transparentImgRef.current = img;
    }, []);

    // Inventory subscription (so blueprint window can show inventory)
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

    // Bridge listeners
    useEffect(() => {
        const onOpen = (e: any) => {
            const d = e?.detail ?? {};

            setIsExiting(false);
            setIsEntering(true);

            setBp({
                isOpen: true,
                sessionId: Number(d.sessionId ?? 0),
                blueprintItemId: Number(
                    d.blueprintItemId ?? d.blueprintItemId ?? 0
                ),

                slotCount: Number(d.slotCount ?? 3),

                weaponInvItemId: Number(d.weaponInvItemId ?? 0),
                augmentInvItemId: Number(d.augmentInvItemId ?? 0),
                optionalInvItemId: Number(d.optionalInvItemId ?? 0),

                predictedUpgradeId: Number(d.predictedUpgradeId ?? 0),
                craftable: !!d.craftable,
            });

            // refresh inventory on open
            GetCommunication().connection.send(
                new RequestInventoryItemsComposer()
            );
        };

        const onUpdate = (e: any) => {
            const d = e?.detail ?? {};

            setBp((prev) => ({
                ...prev,
                isOpen: true,
                sessionId: Number(d.sessionId ?? prev.sessionId),
                blueprintItemId: Number(
                    d.blueprintItemId ?? prev.blueprintItemId
                ),
                slotCount: Number(d.slotCount ?? prev.slotCount),

                weaponInvItemId: Number(
                    d.weaponInvItemId ?? prev.weaponInvItemId
                ),
                augmentInvItemId: Number(
                    d.augmentInvItemId ?? prev.augmentInvItemId
                ),
                optionalInvItemId: Number(
                    d.optionalInvItemId ?? prev.optionalInvItemId
                ),

                predictedUpgradeId: Number(
                    d.predictedUpgradeId ?? prev.predictedUpgradeId
                ),
                craftable:
                    typeof d.craftable === "boolean"
                        ? d.craftable
                        : prev.craftable,
            }));
        };

        const onClose = () => setIsExiting(true);

        const onResult = (e: any) => {
            const d = e?.detail ?? {};
            // if your server sends success -> close, otherwise keep open
            if (d?.success) setIsExiting(true);
        };

        window.addEventListener("mythical_blueprint_open", onOpen as any);
        window.addEventListener("mythical_blueprint_update", onUpdate as any);
        window.addEventListener("mythical_blueprint_close", onClose as any);
        window.addEventListener("mythical_blueprint_result", onResult as any);

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
                "mythical_blueprint_close",
                onClose as any
            );
            window.removeEventListener(
                "mythical_blueprint_result",
                onResult as any
            );
        };
    }, []);

    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;

        if (isExiting) {
            setBp(EMPTY);
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

    // ---------- helpers: map slot invRowId -> inventory item ----------
    const getInvByRowId = useCallback(
        (invRowId: number) => invItems.find((i) => i.id === invRowId),
        [invItems]
    );

    const slotRowIds = useMemo(() => {
        return [
            bp.weaponInvItemId || 0,
            bp.augmentInvItemId || 0,
            bp.optionalInvItemId || 0,
        ];
    }, [bp.weaponInvItemId, bp.augmentInvItemId, bp.optionalInvItemId]);

    // ---------- DnD ----------
    const onInvDragStart = (
        e: React.DragEvent,
        invRowId: number,
        quantity: number
    ) => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

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
        if (!bp.sessionId || !bp.blueprintItemId) return;

        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return;

        let parsed: DragPayload | null = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }
        if (!parsed || parsed.kind !== "inv") return;

        const inv = getInvByRowId(parsed.invRowId);
        if (!slotAccepts(slotIndex, inv)) return;

        // server expects: sessionId, blueprintItemId, inventoryRowId, quantity, slotIndex
        GetCommunication().connection.send(
            new MythicalBlueprintAddItemComposer(
                bp.sessionId,
                bp.blueprintItemId,
                parsed.invRowId,
                1,
                slotIndex
            )
        );
    };

    const removeFromSlot = (slotIndex: number) => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintRemoveItemComposer(
                bp.sessionId,
                bp.blueprintItemId,
                slotIndex
            )
        );
    };

    const doCraft = () => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintCraftComposer(bp.sessionId, bp.blueprintItemId)
        );
    };

    const doClose = () => {
        if (!bp.sessionId || !bp.blueprintItemId) {
            setIsExiting(true);
            return;
        }

        GetCommunication().connection.send(
            new MythicalBlueprintCloseComposer(bp.sessionId, bp.blueprintItemId)
        );

        // let server close via event, but fallback
        window.setTimeout(() => setIsExiting(true), 500);
    };

    // Don’t render unless open or exiting animation
    if (!bp.isOpen && !isExiting) return null;

    return (
        <div
            ref={winRef}
            className={`blueprint-module ${isEntering ? "is-entering" : ""} ${
                isExiting ? "is-exiting" : ""
            }`}
            style={{ position: "absolute", left: position.x, top: position.y }}
            onAnimationEnd={handleAnimEnd}
            role="dialog"
            aria-label="Mythical Blueprint"
        >
            {/* Header (same theme as trade/inventory) */}
            <div
                className={`blueprint-header inventory-header ${
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
                        aria-label="Close mythical blueprint"
                        onClick={doClose}
                    />
                </div>
            </div>

            <div className="blueprint-body">
                <div className="blueprint-top">
                    {/* Left: slots */}
                    <div className="blueprint-slots">
                        <div className="blueprint-section-title">Slots</div>

                        <div className="blueprint-slots-grid">
                            {Array.from({ length: 3 }, (_, slotIndex) => {
                                const invRowId = slotRowIds[slotIndex];
                                const it = invRowId
                                    ? getInvByRowId(invRowId)
                                    : undefined;

                                const label =
                                    slotIndex === 0
                                        ? "Weapon"
                                        : slotIndex === 1
                                        ? "Augment"
                                        : "Optional";

                                return (
                                    <div
                                        key={slotIndex}
                                        className="blueprint-slot-wrapper"
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = "move";
                                        }}
                                        onDrop={(e) => onSlotDrop(e, slotIndex)}
                                    >
                                        <div className="blueprint-slot-title">
                                            {label}
                                        </div>

                                        <div
                                            className={`inventory-slot blueprint-slot ${
                                                it?.rarity
                                                    ? `rarity-${it.rarity}`
                                                    : ""
                                            }`}
                                        >
                                            {!it && (
                                                <div className="slot-number centered">
                                                    {slotIndex + 1}
                                                </div>
                                            )}

                                            {it && (
                                                <div
                                                    className="inventory-item-wrapper"
                                                    title={it.name || ""}
                                                >
                                                    {!!it.icon_path && (
                                                        <img
                                                            src={it.icon_path}
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

                                        <button
                                            type="button"
                                            className="blueprint-remove"
                                            disabled={!invRowId}
                                            onClick={() =>
                                                removeFromSlot(slotIndex)
                                            }
                                        >
                                            Remove
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="blueprint-hint">
                            Drag a <strong>Weapon</strong> +{" "}
                            <strong>Augment</strong> into slots.
                        </div>
                    </div>

                    {/* Center: actions */}
                    <div className="blueprint-center">
                        <button
                            className="trade-btn trade-confirm blueprint-btn"
                            disabled={!bp.craftable}
                            onClick={doCraft}
                        >
                            Craft
                        </button>

                        <button
                            className="trade-btn trade-cancel blueprint-btn"
                            onClick={doClose}
                        >
                            Close
                        </button>

                        <div className="blueprint-status">
                            <div>Session: {bp.sessionId}</div>
                            <div>Blueprint: {bp.blueprintItemId}</div>
                        </div>
                    </div>

                    {/* Right: outcome */}
                    <div className="blueprint-outcome">
                        <div className="blueprint-section-title">Outcome</div>

                        <div className="blueprint-outcome-box">
                            <div className="blueprint-outcome-row">
                                <strong>Upgrade ID:</strong>{" "}
                                {bp.predictedUpgradeId}
                            </div>

                            <div
                                className={`blueprint-pill ${
                                    bp.craftable ? "ok" : "no"
                                }`}
                            >
                                {bp.craftable ? "Craftable" : "Not craftable"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory (1 row of 12) */}
                <div className="blueprint-inventory">
                    <div className="blueprint-inventory-title">
                        Your Inventory (drag into the slots)
                    </div>

                    <div className="blueprint-inventory-grid">
                        {Array.from({ length: 12 }, (_, slotIndex) => {
                            const it = invItems.find(
                                (i) => i.slot === slotIndex
                            );

                            return (
                                <div
                                    key={`inv-${slotIndex}`}
                                    className="slot-wrapper"
                                >
                                    <div className="inventory-slot">
                                        {!it && (
                                            <div className="slot-number centered">
                                                {slotIndex + 1}
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

                    <div className="blueprint-inventory-hint">
                        Slot 1 only accepts <strong>weapon</strong>. Slot 2 only
                        accepts <strong>augment</strong>.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MythicalBlueprintView;
