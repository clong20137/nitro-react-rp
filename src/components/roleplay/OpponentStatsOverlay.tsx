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
    aggression?: number;
    xpPercent?: number;
    level?: number;
};

const pct = (v: number, m: number) =>
    m > 0 ? Math.max(0, Math.min(100, Math.round((v / m) * 100))) : 0;
const clamp01 = (p: number) => Math.max(0, Math.min(100, p));

const OpponentStatsOverlay: React.FC = () => {
    const [op, setOp] = useState<OpponentStatsPayload | null>(null);
    const [lockedUserId, setLockedUserId] = useState<number | null>(null);

    const nextFrameRef = useRef<number | null>(null);
    const stagedRef = useRef<OpponentStatsPayload | null>(null);

    useEffect(() => {
        const onStats = (e: Event) => {
            const ce = e as CustomEvent<OpponentStatsPayload | null>;
            const payload = ce.detail ?? null;
            if (lockedUserId && payload && payload.userId !== lockedUserId)
                return;

            stagedRef.current = payload;
            if (nextFrameRef.current == null) {
                nextFrameRef.current = requestAnimationFrame(() => {
                    nextFrameRef.current = null;
                    setOp(stagedRef.current ?? null);
                });
            }
        };

        const onClear = () => {
            if (lockedUserId) return;
            setOp(null);
        };

        window.addEventListener("user_inspect_stats", onStats as EventListener);
        window.addEventListener("user_inspect_clear", onClear);

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                onStats as EventListener
            );
            window.removeEventListener("user_inspect_clear", onClear);
            if (nextFrameRef.current)
                cancelAnimationFrame(nextFrameRef.current);
        };
    }, [lockedUserId]);

    const anchorEl = useMemo<HTMLElement | null>(
        () => document.querySelector(".stats-bar-container"),
        [op]
    );

    if (!op || !anchorEl) return null;

    const healthPct = pct(op.health, op.maxHealth);
    const energyPct = pct(op.energy, op.maxEnergy);
    const hungerPct = pct(op.hunger, op.maxHunger);
    const aggroPct = clamp01(((op.aggression ?? 0) / 30000) * 100);
    const xpPct = clamp01(op.xpPercent ?? 0);

    const onTarget = () => {
        const next = lockedUserId === op.userId ? null : op.userId;
        setLockedUserId(next);
        try {
            SendMessageComposer(new SetTargetComposer(next ?? 0, true));
        } catch {}
        window.dispatchEvent(
            new CustomEvent("target_lock_changed", { detail: { userId: next } })
        );
    };

    const onClose = () => {
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
                {/* Close button */}
                <button onClick={onClose} className="close-button_right" title="Close">
                    x
                </button>

                {/* Lock/Unlock icon button */}
                <button
                    onClick={onTarget}
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
