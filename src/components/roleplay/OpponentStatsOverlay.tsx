import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./StatsBar.scss";
import { SendMessageComposer } from "../../api";
import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";

type OpponentStatsPayload = {
    userId: number;
    username: string;
    figure: string;
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    maxHunger: number;
    aggression?: number; // ms (0..30000)
    xpPercent?: number; // 0..100
    level?: number;
};

const pct = (v: number, m: number) =>
    m > 0 ? Math.max(0, Math.min(100, Math.round((v / m) * 100))) : 0;
const clamp01 = (p: number) => Math.max(0, Math.min(100, p));

const OpponentStatsOverlay: React.FC = () => {
    /** The user the panel is following because you CLICKED them (not locked). */
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

    /** The user you locked onto (keyboard / button). Lock implies open. */
    const [lockedUserId, setLockedUserId] = useState<number | null>(null);

    /** Latest stats snapshot we’re rendering for the active target. */
    const [op, setOp] = useState<OpponentStatsPayload | null>(null);

    /** rAF coalescing for bursty stat events */
    const nextFrameRef = useRef<number | null>(null);
    const stagedRef = useRef<OpponentStatsPayload | null>(null);

    /** Which user should we show? Prefer lock; else selected; else none. */
    const activeUserId = lockedUserId ?? selectedUserId;

    /* --------- OPEN/CLOSE SOURCES ---------
We ignore hover entirely.
To open on click, dispatch:
window.dispatchEvent(new CustomEvent('rp_avatar_clicked', { detail: { userId } }));
To open via lock, dispatch (already done elsewhere in your code):
window.dispatchEvent(new CustomEvent('target_lock_changed', { detail: { userId } }));
-------------------------------------- */

    useEffect(() => {
        // Stats stream (fires often). We only accept if it matches the active target.
        const onStats = (e: Event) => {
            const ce = e as CustomEvent<OpponentStatsPayload | null>;
            const payload = ce.detail ?? null;

            if (!payload) return;
            if (activeUserId == null) return; // panel not open -> ignore
            if (payload.userId !== activeUserId) return; // not our target

            stagedRef.current = payload;
            if (nextFrameRef.current == null) {
                nextFrameRef.current = requestAnimationFrame(() => {
                    nextFrameRef.current = null;
                    setOp(stagedRef.current ?? null);
                });
            }
        };

        // Some legacy code may try to "clear on hover out" — ignore unless nothing is selected/locked.
        const onClear = () => {
            if (lockedUserId != null || selectedUserId != null) return; // keep open
            setOp(null);
        };

        // Click on an avatar -> open for that user (no lock)
        const onAvatarClicked = (e: Event) => {
            const { detail } = e as CustomEvent<{ userId?: number }>;
            const id = detail?.userId ?? null;
            if (id == null) return;
            setSelectedUserId(id);
            // if we were locked on someone else, keep the lock (lock wins). Otherwise open for this id.
        };

        // External lock/unlock event (e.g., hotkey, server ack, or our own button)
        const onLockChange = (e: Event) => {
            const { detail } = e as CustomEvent<{ userId: number | null }>;
            const id = detail?.userId ?? null;
            setLockedUserId(id);
            if (id != null) setSelectedUserId(id); // show same target
            if (id == null && selectedUserId == null) setOp(null); // fully close if nothing selected
        };

        window.addEventListener("user_inspect_stats", onStats as EventListener);
        window.addEventListener("user_inspect_clear", onClear);
        window.addEventListener("rp_avatar_clicked", onAvatarClicked);
        window.addEventListener("target_lock_changed", onLockChange);

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                onStats as EventListener
            );
            window.removeEventListener("user_inspect_clear", onClear);
            window.removeEventListener("rp_avatar_clicked", onAvatarClicked);
            window.removeEventListener("target_lock_changed", onLockChange);
            if (nextFrameRef.current)
                cancelAnimationFrame(nextFrameRef.current);
        };
    }, [activeUserId, lockedUserId, selectedUserId]);

    const anchorEl = useMemo<HTMLElement | null>(
        () => document.querySelector(".stats-bar-container"),
        [op, activeUserId]
    );

    // If not following anybody (no lock & no click), don’t render.
    if (activeUserId == null || !anchorEl || !op) return null;

    const healthPct = pct(op.health, op.maxHealth);
    const energyPct = pct(op.energy, op.maxEnergy);
    const hungerPct = pct(op.hunger, op.maxHunger);
    const aggroPct = clamp01(((op.aggression ?? 0) / 30000) * 100);
    const xpPct = clamp01(op.xpPercent ?? 0);

    const toggleLock = () => {
        const next = lockedUserId === op.userId ? null : op.userId;
        setLockedUserId(next);
        if (next == null && selectedUserId == null) setOp(null);
        try {
            SendMessageComposer(new SetTargetComposer(next ?? 0, !!next));
        } catch {}
        window.dispatchEvent(
            new CustomEvent("target_lock_changed", { detail: { userId: next } })
        );
    };

    const onClose = () => {
        setSelectedUserId(null);
        setLockedUserId(null);
        setOp(null);
        window.dispatchEvent(new CustomEvent("user_inspect_clear"));
        try {
            SendMessageComposer(new SetTargetComposer(0, false));
        } catch {}
    };

    return createPortal(
        <div className="opponent-anchor" aria-label="opponent-stats">
            <div className="stats-bar-container opponent">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="close-button_right"
                    title="Close"
                />

                {/* Lock / Unlock */}
                <button
                    onClick={toggleLock}
                    className={`target-btn ${
                        lockedUserId === op.userId ? "locked" : ""
                    }`}
                    title={
                        lockedUserId === op.userId
                            ? "Unlock Target"
                            : "Lock Target"
                    }
                />

                {/* LEFT: bars */}
                <div className="stats-right">
                    <div className="stat">
                        <div className="icons heart" />
                        <div className="bar">
                            <div
                                className="fill health"
                                style={{ width: `${healthPct}%` }}
                            />
                            <div className="bar-text">
                                {op.health} / {op.maxHealth}
                            </div>
                        </div>
                    </div>
                    <div className="stat">
                        <div className="icons bolt" />
                        <div className="bar">
                            <div
                                className="fill energy"
                                style={{ width: `${energyPct}%` }}
                            />
                            <div className="bar-text">
                                {op.energy} / {op.maxEnergy}
                            </div>
                        </div>
                    </div>
                    <div className="stat">
                        <div className="icons apple" />
                        <div className="bar">
                            <div
                                className="fill hunger"
                                style={{ width: `${hungerPct}%` }}
                            />
                            <div className="bar-text">
                                {op.hunger} / {op.maxHunger}
                            </div>
                        </div>
                    </div>
                    <div className="aggression-bar-wrapper">
                        <div
                            className="aggression-fill"
                            style={{ width: `${aggroPct}%` }}
                        />
                    </div>
                </div>

                {/* RIGHT: avatar */}
                <div className="stats-left">
                    <div className="greek-circle">
                        <div className="greek-xp-ring">
                            <svg className="xp-ring-svg" viewBox="0 0 36 36">
                                <path
                                    className="xp-ring-background"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="xp-ring-progress"
                                    strokeDasharray={`${xpPct}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                            <img
                                className="avatar-head"
                                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                                    op.figure || ""
                                )}&direction=2&head_direction=2&gesture=sml`}
                                alt={op.username}
                            />
                        </div>
                        <div className="level-badge">{op.level ?? ""}</div>
                    </div>
                    <div className="avatar-column">
                        <div className="avatar-name">{op.username}</div>
                        {op.level != null && (
                            <div className="avatar-level">
                                Level: {op.level}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        anchorEl
    );
};

export default OpponentStatsOverlay;
