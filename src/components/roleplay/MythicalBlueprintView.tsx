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

// ✅ Your blueprint outgoing composers (make sure these exist in your client)
import { MythicalBlueprintCloseComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCloseComposer";
import { MythicalBlueprintAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintAddItemComposer";
import { MythicalBlueprintRemoveItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintRemoveItemComposer";
import { MythicalBlueprintCraftComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCraftComposer";

import "./MythicalBlueprintView.scss";

type BlueprintState = {
    isOpen: boolean;
    sessionId: number;
    blueprintItemId: number;

    // left slots (inventory row ids)
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
    weaponInvItemId: 0,
    augmentInvItemId: 0,
    optionalInvItemId: 0,
    predictedUpgradeId: 0,
    craftable: false,
};

type DragPayload = { kind: "inv"; invRowId: number; quantity: number };
const DRAG_MIME = "application/x-olympus-blueprint";

export const MythicalBlueprintView: FC = () => {
    const [bp, setBp] = useState<BlueprintState>(EMPTY);
    const [invItems, setInvItems] = useState<InventoryContext[]>([]);

    const winRef = useRef<HTMLDivElement>(null);

    // animations
    const [isEntering, setIsEntering] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    // persisted position (same style as Trade)
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const s = localStorage.getItem("blueprintPos");
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

    // Transparent drag image (same as Trade)
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

    // ✅ helper: find an inventory item by inventory row id (this fixes “icon not showing”)
    const invByRowId = useCallback(
        (invRowId: number) => {
            if (!invRowId) return undefined;
            return invItems.find((i) => i.id === invRowId);
        },
        [invItems]
    );

    // bridge listeners (events dispatched by your bridges)
    useEffect(() => {
        const onOpen = (e: any) => {
            const d = e?.detail ?? {};

            setIsExiting(false);
            setIsEntering(true);

            setBp({
                isOpen: true,
                sessionId: Number(d.sessionId ?? 0),
                blueprintItemId: Number(d.blueprintItemId ?? 0),
                weaponInvItemId: Number(d.weaponInvItemId ?? 0),
                augmentInvItemId: Number(d.augmentInvItemId ?? 0),
                optionalInvItemId: Number(d.optionalInvItemId ?? 0),
                predictedUpgradeId: Number(d.predictedUpgradeId ?? 0),
                craftable: !!d.craftable,
            });

            GetCommunication().connection.send(
                new RequestInventoryItemsComposer()
            );
            console.log("[Blueprint] open", d);
        };

        const onUpdate = (e: any) => {
            const d = e?.detail ?? {};
            setBp((prev) => ({
                ...prev,
                sessionId: Number(d.sessionId ?? prev.sessionId),
                blueprintItemId: Number(
                    d.blueprintItemId ?? prev.blueprintItemId
                ),
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

        const onResult = (e: any) => {
            const d = e?.detail ?? {};
            // if you want, show toast here
            if (d?.success) setIsExiting(true);
        };

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

    const handleAnimEnd: React.AnimationEventHandler<HTMLDivElement> = (e) => {
        if (e.currentTarget !== winRef.current) return;

        if (isExiting) {
            setBp(EMPTY);
            setIsExiting(false);
            return;
        }

        if (isEntering) setIsEntering(false);
    };

    const sendClose = () => {
        if (!bp.sessionId || !bp.blueprintItemId) {
            setIsExiting(true);
            return;
        }

        GetCommunication().connection.send(
            new MythicalBlueprintCloseComposer(bp.sessionId, bp.blueprintItemId)
        );

        setIsExiting(true);
    };

    const sendCraft = () => {
        if (!bp.sessionId || !bp.blueprintItemId) return;
        if (!bp.craftable) return;

        GetCommunication().connection.send(
            new MythicalBlueprintCraftComposer(bp.sessionId, bp.blueprintItemId)
        );
    };

    const sendRemoveSlot = (slotIndex: number) => {
        if (!bp.sessionId || !bp.blueprintItemId) return;

        GetCommunication().connection.send(
            new MythicalBlueprintRemoveItemComposer(
                bp.sessionId,
                bp.blueprintItemId,
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

        if (!parsed) return;
        if (parsed.kind !== "inv") return;

        // trade-style: place 1 from stack
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

    // slot rendering
    const slotLabel = (idx: number) => {
        if (idx === 0) return "Weapon";
        if (idx === 1) return "Augment";
        return "Optional";
    };

    const slotInvId = (idx: number) => {
        if (idx === 0) return bp.weaponInvItemId;
        if (idx === 1) return bp.augmentInvItemId;
        return bp.optionalInvItemId;
    };

    // If not open, render nothing (same as Trade)
    if (!bp.isOpen && !isExiting) return null;

    // 12-slot inventory layout (one row)
    const invSlots = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

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
                        onClick={sendClose}
                    />
                </div>
            </div>

            <div className="blueprint-body">
                <div className="blueprint-top">
                    {/* Left slots */}
                    <div className="blueprint-slots">
                        <div className="blueprint-side-title">Slots</div>

                        <div className="blueprint-slots-row">
                            {[0, 1, 2].map((slotIndex) => {
                                const invId = slotInvId(slotIndex);
                                const invItem = invByRowId(invId);

                                return (
                                    <div
                                        key={`slot-${slotIndex}`}
                                        className="blueprint-slot-wrap"
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = "move";
                                        }}
                                        onDrop={(e) => onSlotDrop(e, slotIndex)}
                                    >
                                        <div className="blueprint-slot-title">
                                            {slotLabel(slotIndex)}
                                        </div>

                                        <div
                                            className={`inventory-slot blueprint-slot`}
                                        >
                                            {!invId && (
                                                <div className="slot-number centered">
                                                    {slotIndex + 1}
                                                </div>
                                            )}

                                            {!!invId && invItem && (
                                                <div
                                                    className="inventory-item-wrapper"
                                                    title={invItem.name}
                                                >
                                                    {!!invItem.icon_path && (
                                                        <img
                                                            src={
                                                                invItem.icon_path
                                                            }
                                                            alt={invItem.name}
                                                            draggable={false}
                                                        />
                                                    )}

                                                    {(invItem.quantity ?? 0) >
                                                        1 && (
                                                        <div className="quantity-label">
                                                            x{invItem.quantity}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ✅ If server says slot is filled but item not found locally yet */}
                                            {!!invId && !invItem && (
                                                <div className="slot-number centered">
                                                    {invId}
                                                </div>
                                            )}
                                        </div>

                                        {invId > 0 && (
                                            <button
                                                className="blueprint-remove-btn"
                                                type="button"
                                                onClick={() =>
                                                    sendRemoveSlot(slotIndex)
                                                }
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="blueprint-hint">
                            Drag a Weapon + Augment into slots.
                        </div>
                    </div>

                    {/* Center actions */}
                    <div className="blueprint-center">
                        <button
                            className="trade-btn trade-confirm"
                            disabled={!bp.craftable}
                            onClick={sendCraft}
                        >
                            Craft
                        </button>

                        <button
                            className="trade-btn trade-cancel"
                            onClick={sendClose}
                        >
                            Close
                        </button>

                        <div className="blueprint-session">
                            <div>Session: {bp.sessionId}</div>
                            <div>Blueprint: {bp.blueprintItemId}</div>
                        </div>
                    </div>

                    {/* Outcome */}
                    <div className="blueprint-outcome">
                        <div className="blueprint-side-title">Outcome</div>

                        <div className="blueprint-outcome-box">
                            <div className="blueprint-outcome-line">
                                Upgrade ID:{" "}
                                <strong>{bp.predictedUpgradeId}</strong>
                            </div>

                            <div
                                className={`blueprint-outcome-badge ${
                                    bp.craftable ? "ok" : "no"
                                }`}
                            >
                                {bp.craftable ? "Craftable" : "Not craftable"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory - ✅ 1 row of 12 slots */}
                <div className="blueprint-inventory">
                    <div className="blueprint-inventory-title">
                        Your Inventory (drag into the slots)
                    </div>

                    <div className="inventory-grid blueprint-inventory-grid">
                        {invSlots.map((slotIndex) => {
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

                    <div className="blueprint-footnote">
                        Slot 1 only accepts weapon. Slot 2 only accepts augment.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MythicalBlueprintView;
