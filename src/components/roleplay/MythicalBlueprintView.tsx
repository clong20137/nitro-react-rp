import React, { useEffect, useMemo, useState } from "react";
import "./MythicalBlueprintView.scss";

import { SendMessageComposer } from "../../api"; // adjust to your project helper

import { MythicalBlueprintRemoveItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintRemoveItemComposer";
import { MythicalBlueprintCraftComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCraftComposer";
import { MythicalBlueprintCloseComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCloseComposer";
import { MythicalBlueprintAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintAddItemComposer";

/**
 * Minimal inventory item shape used by this UI.
 * Replace with your real inventory store if you already have one.
 */
type InvItem = {
    id: number; // inventory_items.id (row id)
    name: string;
    iconUrl?: string;
    quantity: number;
};

type BlueprintPayload = {
    sessionId: number;
    blueprintItemId: number;
    weaponInvItemId: number;
    augmentInvItemId: number;
    optionalInvItemId: number;
    predictedUpgradeId: number;
    craftable: boolean;
};

export const MythicalBlueprintView: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const [sessionId, setSessionId] = useState(0);
    const [blueprintItemId, setBlueprintItemId] = useState(0);

    const [weaponInvItemId, setWeaponInvItemId] = useState(0);
    const [augmentInvItemId, setAugmentInvItemId] = useState(0);
    const [optionalInvItemId, setOptionalInvItemId] = useState(0);

    const [predictedUpgradeId, setPredictedUpgradeId] = useState(0);
    const [craftable, setCraftable] = useState(false);

    // demo inventory (replace with your real inventory source)
    const [inventory, setInventory] = useState<InvItem[]>([
        // Example rows
        // { id: 101, name: 'Iron Sword', quantity: 1, iconUrl: '/icons/items/sword.png' },
        // { id: 202, name: 'Panacea Augment', quantity: 3, iconUrl: '/icons/items/augment.png' }
    ]);

    const slots = useMemo(() => {
        return [weaponInvItemId, augmentInvItemId, optionalInvItemId];
    }, [weaponInvItemId, augmentInvItemId, optionalInvItemId]);

    const setSlotByIndex = (idx: number, value: number) => {
        if (idx === 0) setWeaponInvItemId(value);
        else if (idx === 1) setAugmentInvItemId(value);
        else if (idx === 2) setOptionalInvItemId(value);
    };

    const applyPayload = (d: BlueprintPayload) => {
        setIsOpen(true);
        setSessionId(d.sessionId);
        setBlueprintItemId(d.blueprintItemId);

        setWeaponInvItemId(d.weaponInvItemId || 0);
        setAugmentInvItemId(d.augmentInvItemId || 0);
        setOptionalInvItemId(d.optionalInvItemId || 0);

        setPredictedUpgradeId(d.predictedUpgradeId || 0);
        setCraftable(!!d.craftable);
    };

    // ------------------ bridge listeners ------------------
    useEffect(() => {
        const onOpen = (e: any) => {
            const d = e?.detail as BlueprintPayload;
            if (!d) return;

            console.log("[Blueprint] open", d);
            applyPayload(d);
        };

        const onUpdate = (e: any) => {
            const d = e?.detail as BlueprintPayload;
            if (!d) return;

            console.log("[Blueprint] update", d);
            applyPayload(d);
        };

        const onResult = (e: any) => {
            const d = e?.detail as BlueprintPayload;
            if (!d) return;

            console.log("[Blueprint] result", d);
            applyPayload(d);
        };

        window.addEventListener("mythical_blueprint_open", onOpen);
        window.addEventListener("mythical_blueprint_update", onUpdate);
        window.addEventListener("mythical_blueprint_result", onResult);

        return () => {
            window.removeEventListener("mythical_blueprint_open", onOpen);
            window.removeEventListener("mythical_blueprint_update", onUpdate);
            window.removeEventListener("mythical_blueprint_result", onResult);
        };
    }, []);

    // ------------------ outgoing packets ------------------
    const sendAddItem = (
        slotIndex: number,
        inventoryRowId: number,
        quantity: number
    ) => {
        if (!sessionId || !blueprintItemId) return;

        SendMessageComposer(
            new MythicalBlueprintAddItemComposer(
                sessionId,
                blueprintItemId,
                inventoryRowId,
                quantity,
                slotIndex
            )
        );
    };

    const sendRemoveItem = (slotIndex: number) => {
        if (!sessionId || !blueprintItemId) return;

        SendMessageComposer(
            new MythicalBlueprintRemoveItemComposer(
                sessionId,
                blueprintItemId,
                slotIndex
            )
        );
    };

    const sendCraft = () => {
        if (!sessionId || !blueprintItemId) return;

        SendMessageComposer(
            new MythicalBlueprintCraftComposer(sessionId, blueprintItemId)
        );
    };

    const sendClose = () => {
        if (!sessionId || !blueprintItemId) return;

        SendMessageComposer(
            new MythicalBlueprintCloseComposer(sessionId, blueprintItemId)
        );
    };

    const closeUI = () => {
        sendClose();

        setIsOpen(false);
        setSessionId(0);
        setBlueprintItemId(0);
        setWeaponInvItemId(0);
        setAugmentInvItemId(0);
        setOptionalInvItemId(0);
        setPredictedUpgradeId(0);
        setCraftable(false);
    };

    // Safety close if component unmounts while open
    useEffect(() => {
        return () => {
            if (sessionId && blueprintItemId) {
                try {
                    sendClose();
                } catch {}
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, blueprintItemId]);

    // ------------------ drag/drop ------------------
    const onDragStartInvItem = (e: React.DragEvent, item: InvItem) => {
        e.dataTransfer.setData("blueprint_inv_row_id", String(item.id));
        e.dataTransfer.setData("blueprint_inv_qty", String(item.quantity));
        e.dataTransfer.effectAllowed = "move";
    };

    const onDropSlot = (e: React.DragEvent, slotIndex: number) => {
        e.preventDefault();

        const rowIdStr = e.dataTransfer.getData("blueprint_inv_row_id");
        if (!rowIdStr) return;

        const qtyStr = e.dataTransfer.getData("blueprint_inv_qty");
        const rowId = parseInt(rowIdStr, 10) || 0;
        const qty = Math.max(1, parseInt(qtyStr, 10) || 1);

        if (!rowId) return;

        // Tell server (server will validate type/locks)
        sendAddItem(slotIndex, rowId, 1);

        // Optimistic local UI: show it in slot immediately (server will correct via update event)
        setSlotByIndex(slotIndex, rowId);
    };

    const allowDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const getInvItemById = (rowId: number) => {
        return inventory.find((i) => i.id === rowId) || null;
    };

    const outcomeName = useMemo(() => {
        if (!predictedUpgradeId) return "—";
        if (predictedUpgradeId === 1) return "Panacea Augment";
        if (predictedUpgradeId === 2) return "Poison Augment";
        if (predictedUpgradeId === 3) return "Executioner Augment";
        return "Unknown";
    }, [predictedUpgradeId]);

    if (!isOpen) return null;

    return (
        <div className="mythical-blueprint-view">
            <div className="mb-header">
                <div className="mb-title">Mythical Blueprint</div>
                <button className="mb-close" onClick={closeUI}>
                    X
                </button>
            </div>

            <div className="mb-body">
                <div className="mb-columns">
                    {/* LEFT - slots */}
                    <div className="mb-left">
                        <div className="mb-section-title">Crafting Slots</div>

                        <div className="mb-slots">
                            {[0, 1, 2].map((slotIndex) => {
                                const rowId = slots[slotIndex];
                                const item = rowId
                                    ? getInvItemById(rowId)
                                    : null;

                                const label =
                                    slotIndex === 0
                                        ? "Weapon"
                                        : slotIndex === 1
                                        ? "Augment"
                                        : "Optional";

                                return (
                                    <div
                                        className="mb-slot-row"
                                        key={slotIndex}
                                    >
                                        <div className="mb-slot-label">
                                            {label}
                                        </div>

                                        <div
                                            className={`mb-slot ${
                                                rowId ? "filled" : ""
                                            }`}
                                            onDragOver={allowDrop}
                                            onDrop={(e) =>
                                                onDropSlot(e, slotIndex)
                                            }
                                        >
                                            {!rowId && (
                                                <div className="mb-slot-empty">
                                                    Drop item here
                                                </div>
                                            )}

                                            {rowId && item && (
                                                <div className="mb-slot-item">
                                                    <div className="mb-slot-icon">
                                                        {item.iconUrl ? (
                                                            <img
                                                                src={
                                                                    item.iconUrl
                                                                }
                                                                alt=""
                                                            />
                                                        ) : (
                                                            <div className="mb-icon-fallback" />
                                                        )}
                                                    </div>

                                                    <div className="mb-slot-info">
                                                        <div className="mb-slot-name">
                                                            {item.name}
                                                        </div>
                                                        <div className="mb-slot-qty">
                                                            x{item.quantity}
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="mb-slot-remove"
                                                        onClick={() => {
                                                            sendRemoveItem(
                                                                slotIndex
                                                            );
                                                            setSlotByIndex(
                                                                slotIndex,
                                                                0
                                                            );
                                                        }}
                                                        title="Remove"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}

                                            {rowId && !item && (
                                                <div className="mb-slot-item">
                                                    <div className="mb-slot-info">
                                                        <div className="mb-slot-name">
                                                            Item #{rowId}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="mb-slot-remove"
                                                        onClick={() => {
                                                            sendRemoveItem(
                                                                slotIndex
                                                            );
                                                            setSlotByIndex(
                                                                slotIndex,
                                                                0
                                                            );
                                                        }}
                                                        title="Remove"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT - outcome */}
                    <div className="mb-right">
                        <div className="mb-section-title">Outcome</div>

                        <div className="mb-outcome">
                            <div className="mb-outcome-card">
                                <div className="mb-outcome-name">
                                    {outcomeName}
                                </div>
                                <div className="mb-outcome-sub">
                                    Upgrade ID: {predictedUpgradeId || 0}
                                </div>

                                <div
                                    className={`mb-outcome-status ${
                                        craftable ? "ok" : "bad"
                                    }`}
                                >
                                    {craftable
                                        ? "Ready to craft"
                                        : "Insert a weapon + augment"}
                                </div>
                            </div>

                            <button
                                className={`mb-craft-btn ${
                                    craftable ? "" : "disabled"
                                }`}
                                disabled={!craftable}
                                onClick={() => sendCraft()}
                            >
                                Craft Upgrade
                            </button>
                        </div>
                    </div>
                </div>

                {/* Inventory area (demo) */}
                <div className="mb-inventory">
                    <div className="mb-section-title">Inventory</div>

                    <div className="mb-inventory-grid">
                        {inventory.length <= 0 && (
                            <div className="mb-inventory-empty">
                                Your inventory list isn’t wired here yet.
                                <div className="mb-inventory-hint">
                                    Hook this grid to your real Inventory store
                                    and keep the drag payload as:
                                    <code>blueprint_inv_row_id</code>
                                </div>
                            </div>
                        )}

                        {inventory.map((it) => (
                            <div
                                key={it.id}
                                className="mb-inventory-item"
                                draggable={true}
                                onDragStart={(e) => onDragStartInvItem(e, it)}
                                title="Drag into a slot"
                            >
                                <div className="mb-inv-icon">
                                    {it.iconUrl ? (
                                        <img src={it.iconUrl} alt="" />
                                    ) : (
                                        <div className="mb-icon-fallback" />
                                    )}
                                </div>
                                <div className="mb-inv-name">{it.name}</div>
                                <div className="mb-inv-qty">x{it.quantity}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mb-footer">
                <div className="mb-footer-left">
                    Session: {sessionId} | Blueprint: {blueprintItemId}
                </div>
                <div className="mb-footer-right">
                    <button className="mb-footer-btn" onClick={closeUI}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
