import "./MythicalBlueprintView.scss";

import { SendMessageComposer } from "../../api"; // adjust to your project helper

import React, { useEffect, useMemo, useState } from "react";
import "./MythicalBlueprintView.scss";

import { MythicalBlueprintRemoveItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintRemoveItemComposer";
import { MythicalBlueprintCraftComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCraftComposer";
import { MythicalBlueprintCloseComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintCloseComposer";
import { MythicalBlueprintAddItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MythicalBlueprintAddItemComposer";

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

    const slots = useMemo(() => {
        return [weaponInvItemId, augmentInvItemId, optionalInvItemId];
    }, [weaponInvItemId, augmentInvItemId, optionalInvItemId]);

    const setSlotByIndex = (idx: number, value: number) => {
        if (idx === 0) setWeaponInvItemId(value);
        else if (idx === 1) setAugmentInvItemId(value);
        else if (idx === 2) setOptionalInvItemId(value);
    };

    const applyPayload = (d: BlueprintPayload) => {
        console.log("[Blueprint] open/apply", d);

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
            applyPayload(d);
        };

        const onUpdate = (e: any) => {
            const d = e?.detail as BlueprintPayload;
            if (!d) return;
            applyPayload(d);
        };

        const onResult = (e: any) => {
            const d = e?.detail as BlueprintPayload;
            if (!d) return;
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

    const allowDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const onDropSlot = (e: React.DragEvent, slotIndex: number) => {
        e.preventDefault();

        const rowIdStr = e.dataTransfer.getData("blueprint_inv_row_id");
        if (!rowIdStr) return;

        const rowId = parseInt(rowIdStr, 10) || 0;
        if (!rowId) return;

        // server validates
        sendAddItem(slotIndex, rowId, 1);

        // optimistic UI
        setSlotByIndex(slotIndex, rowId);
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
                    <div className="mb-left">
                        <div className="mb-section-title">Crafting Slots</div>

                        <div className="mb-slots">
                            {[0, 1, 2].map((slotIndex) => {
                                const rowId = slots[slotIndex];

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

                                            {!!rowId && (
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
                                onClick={sendCraft}
                            >
                                Craft Upgrade
                            </button>
                        </div>
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
