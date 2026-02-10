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

    weaponInvItemId: number; // inventory row id
    augmentInvItemId: number; // inventory row id
    optionalInvItemId: number; // inventory row id

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

type DragPayload = { kind: "inv"; invRowId: number; quantity: number };
const DRAG_MIME = "application/x-olympus-blueprint";

export const MythicalBlueprintView: FC<{ onClose?: () => void }> = ({
    onClose,
}) => {
    const [bp, setBp] = useState<BlueprintState>(EMPTY);
    const [invItems, setInvItems] = useState<InventoryContext[]>([]);

    const winRef = useRef<HTMLDivElement>(null);

    // animations
    const [isEntering, setIsEntering] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    // persisted position
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("blueprintPos");
            if (s) return JSON.parse(s);
        } catch {}
        return { x: Math.round(window.innerWidth * 0.18), y: 140 };
    });

    // window drag
    const rafRef = useRef<number | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const [headerGrabbing, setHeaderGrabbing] = useState(false);

    // drag validation (don’t rely on dataTransfer.getData during dragover)
    const draggingInvRowIdRef = useRef<number>(0);

    const clamp = useCallback((x: number, y: number) => {
        const nitro = GetNitroInstance?.() as any;

        const sw = nitro?.renderer?.width ?? window.innerWidth;
        const sh = nitro?.renderer?.height ?? window.innerHeight;

        const w = winRef.current?.offsetWidth ?? 740;
        const h = winRef.current?.offsetHeight ?? 420;

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

    // Transparent drag image
    const transparentImgRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.width = 1;
        img.height = 1;
        img.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        transparentImgRef.current = img;
    }, []);

    // Subscribe inventory (resolve invRowId -> icon/name)
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

    // Bridge listener (server re-sends MythicalBlueprintOpenComposer for updates)
    useEffect(() => {
        const onOpen = (e: any) => {
            const d = e?.detail ?? {};

            const next: BlueprintState = {
                isOpen: true,
                sessionId: Number(d.sessionId ?? 0),
                blueprintItemId: Number(d.blueprintItemId ?? 0),
                slotCount: Number(d.slotCount ?? 3),

                weaponInvItemId: Number(d.weaponInvItemId ?? 0),
                augmentInvItemId: Number(d.augmentInvItemId ?? 0),
                optionalInvItemId: Number(d.optionalInvItemId ?? 0),

                predictedUpgradeId: Number(d.predictedUpgradeId ?? 0),
                craftable: !!d.craftable,
            };

            setIsExiting(false);
            setIsEntering(true);
            setBp(next);

            // refresh inventory snapshot (helps slot lookup)
            GetCommunication().connection.send(
                new RequestInventoryItemsComposer()
            );
        };

        window.addEventListener("mythical_blueprint_open", onOpen as any);
        return () =>
            window.removeEventListener(
                "mythical_blueprint_open",
                onOpen as any
            );
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

    const close = () => {
        if (!bp.sessionId) {
            setIsExiting(true);
            return;
        }

        GetCommunication().connection.send(
            new MythicalBlueprintCloseComposer(bp.sessionId, bp.blueprintItemId)
        );

        setIsExiting(true);
    };

    const craft = () => {
        if (!bp.sessionId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintCraftComposer(bp.sessionId, bp.blueprintItemId)
        );
    };

    const removeFromSlot = (slotIndex: number) => {
        if (!bp.sessionId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintRemoveItemComposer(
                bp.sessionId,
                bp.blueprintItemId,
                slotIndex
            )
        );
    };

    const addToSlot = (
        slotIndex: number,
        invRowId: number,
        quantity: number = 1
    ) => {
        if (!bp.sessionId) return;

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

    // 🔥 ROBUST slot resolution: handle different inventory field names
    const resolveInventoryRow = useCallback(
        (rowId: number): InventoryContext | undefined => {
            if (!rowId) return undefined;

            // most likely: InventoryContext.id === inventory row id
            let it = invItems.find((i) => Number(i.id) === Number(rowId));
            if (it) return it;

            // fallbacks if your InventoryContext differs
            it = invItems.find(
                (i) => Number((i as any).inventoryRowId) === Number(rowId)
            );
            if (it) return it;

            it = invItems.find(
                (i) => Number((i as any).rowId) === Number(rowId)
            );
            if (it) return it;

            it = invItems.find(
                (i) => Number((i as any).inventory_row_id) === Number(rowId)
            );
            if (it) return it;

            return undefined;
        },
        [invItems]
    );

    const slotInvRowIds = useMemo(() => {
        return [bp.weaponInvItemId, bp.augmentInvItemId, bp.optionalInvItemId];
    }, [bp.weaponInvItemId, bp.augmentInvItemId, bp.optionalInvItemId]);

    const slotLabels = ["Weapon", "Augment", "Optional"];

    const canDropIntoSlot = useCallback(
        (slotIndex: number, inv: InventoryContext | undefined) => {
            const t = (inv?.item_type || "").toLowerCase();

            if (slotIndex === 0) return t === "weapon";
            if (slotIndex === 1) return t === "augment";
            return true;
        },
        []
    );

    const onInvDragStart = (
        e: React.DragEvent,
        invRowId: number,
        quantity: number
    ) => {
        draggingInvRowIdRef.current = Number(invRowId);

        const payload: DragPayload = {
            kind: "inv",
            invRowId: Number(invRowId),
            quantity: Number(quantity ?? 1),
        };

        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";

        if (transparentImgRef.current)
            e.dataTransfer.setDragImage(transparentImgRef.current, 0, 0);
    };

    const onInvDragEnd = () => {
        draggingInvRowIdRef.current = 0;
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

        const inv = resolveInventoryRow(parsed.invRowId);
        if (!canDropIntoSlot(slotIndex, inv)) return;

        // default: 1 from stack
        addToSlot(slotIndex, parsed.invRowId, 1);
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
                        aria-label="Close"
                        onClick={close}
                    />
                </div>
            </div>

            <div className="blueprint-body">
                <div className="blueprint-top">
                    <div className="blueprint-slots">
                        <div className="blueprint-side-title">Slots</div>

                        {/* tighter spacing row (CSS handles spacing; this markup is compact) */}
                        <div className="blueprint-slots-row">
                            {slotInvRowIds.map((invRowId, idx) => {
                                const inv = resolveInventoryRow(invRowId || 0);
                                const filled = Number(invRowId ?? 0) > 0;

                                const draggingInv = resolveInventoryRow(
                                    draggingInvRowIdRef.current
                                );
                                const dropAllowed = canDropIntoSlot(
                                    idx,
                                    draggingInv
                                );

                                return (
                                    <div
                                        key={`slot-${idx}`}
                                        className="blueprint-slot-wrapper"
                                    >
                                        <div className="blueprint-slot-label">
                                            {slotLabels[idx]}
                                        </div>

                                        <div
                                            className={`inventory-slot blueprint-slot ${
                                                filled ? "is-filled" : ""
                                            } ${
                                                dropAllowed ? "" : "is-disabled"
                                            }`}
                                            onDragOver={(e) => {
                                                // IMPORTANT: don’t read getData here (Chrome often returns empty during dragover)
                                                if (
                                                    !draggingInvRowIdRef.current
                                                )
                                                    return;

                                                const invDragging =
                                                    resolveInventoryRow(
                                                        draggingInvRowIdRef.current
                                                    );
                                                if (
                                                    !canDropIntoSlot(
                                                        idx,
                                                        invDragging
                                                    )
                                                )
                                                    return;

                                                e.preventDefault();
                                                e.dataTransfer.dropEffect =
                                                    "move";
                                            }}
                                            onDrop={(e) => onSlotDrop(e, idx)}
                                            title={inv?.name || ""}
                                        >
                                            {!filled && (
                                                <div className="slot-number centered">
                                                    {idx + 1}
                                                </div>
                                            )}

                                            {filled && (
                                                <div className="inventory-item-wrapper">
                                                    {!!inv?.icon_path ? (
                                                        <img
                                                            src={inv.icon_path}
                                                            alt={inv.name}
                                                            draggable={false}
                                                        />
                                                    ) : (
                                                        <div className="slot-fallback-id">
                                                            {invRowId}
                                                        </div>
                                                    )}

                                                    {(inv?.quantity ?? 0) >
                                                        1 && (
                                                        <div className="quantity-label">
                                                            x{inv?.quantity}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            className="blueprint-remove"
                                            disabled={!filled}
                                            onClick={() => removeFromSlot(idx)}
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

                    <div className="blueprint-actions">
                        <button
                            className="trade-btn trade-confirm"
                            disabled={!bp.craftable}
                            onClick={craft}
                        >
                            Craft
                        </button>

                        <button
                            className="trade-btn trade-cancel"
                            onClick={close}
                        >
                            Close
                        </button>

                        <div className="blueprint-session">
                            <div>
                                Session: <strong>{bp.sessionId}</strong>
                            </div>
                            <div>
                                Blueprint: <strong>{bp.blueprintItemId}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="blueprint-outcome">
                        <div className="blueprint-side-title">Outcome</div>
                        <div className="blueprint-outcome-box">
                            <div className="blueprint-outcome-row">
                                <span className="bp-k">Upgrade ID:</span>
                                <span className="bp-v">
                                    {bp.predictedUpgradeId}
                                </span>
                            </div>

                            <div
                                className={`blueprint-craftable ${
                                    bp.craftable ? "yes" : "no"
                                }`}
                            >
                                {bp.craftable ? "Craftable" : "Not craftable"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory: 1 row of 12 */}
                <div className="blueprint-inventory">
                    <div className="trade-inventory-title">
                        Your inventory (drag into the slots)
                    </div>

                    <div className="blueprint-inventory-row">
                        {Array.from({ length: 12 }, (_, slotIndex) => {
                            const it = invItems.find(
                                (i) => i.slot === slotIndex
                            );

                            return (
                                <div
                                    key={`inv-${slotIndex}`}
                                    className="slot-wrapper"
                                >
                                    <div
                                        className={`inventory-slot ${
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
                                                draggable
                                                onDragStart={(e) =>
                                                    onInvDragStart(
                                                        e,
                                                        Number(it.id),
                                                        Number(it.quantity ?? 1)
                                                    )
                                                }
                                                onDragEnd={onInvDragEnd}
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

                    <div className="blueprint-bottom-hint">
                        Slot 1 only accepts <strong>weapon</strong>. Slot 2 only
                        accepts <strong>augment</strong>.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MythicalBlueprintView;
