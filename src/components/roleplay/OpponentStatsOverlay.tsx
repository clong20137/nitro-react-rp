import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./StatsBar.scss";

// If you already re‑export these from your api barrel, keep that import instead:
import { SendMessageComposer } from "../../api"; // <- or your path

import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";

type OpponentStatsPayload = {
    userId: number;
    username: string;
    figure: string;

    // main bars
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    maxHunger: number;

    // extra
    aggression?: number; // ms remaining (0..30000)
    xpPercent?: number; // 0..100
    level?: number; // integer
};

const pct = (v: number, m: number) =>
    m > 0 ? Math.max(0, Math.min(100, Math.round((v / m) * 100))) : 0;
const clamp01 = (p: number) => Math.max(0, Math.min(100, p));

/**
 * Opponent panel that sits to the right of your .stats-bar-container
 * Uses your CSS classes so it matches exactly.
 */
const OpponentStatsOverlay: React.FC = () => {
    const [op, setOp] = useState<OpponentStatsPayload | null>(null);
    const [lockedUserId, setLockedUserId] = useState<number | null>(null);

    // smooth state updates without spamming React when server floods updates
    const nextFrameRef = useRef<number | null>(null);
    const stagedRef = useRef<OpponentStatsPayload | null>(null);

    // polling while locked (very light, stops when unlocked / tab hidden)
    const pollTimerRef = useRef<number | null>(null);
    const startPolling = (userId: number) => {
        stopPolling();
        // quick but cheap: 600ms. Tune as you like (min 400ms to avoid spam)
        pollTimerRef.current = window.setInterval(() => {
            // If page hidden, skip (prevents wasted work when user tabs out)
            if (document.hidden) return;
            window.dispatchEvent(
                new CustomEvent("user_inspect_request", { detail: { userId } })
            );
        }, 600);
    };
    const stopPolling = () => {
        if (pollTimerRef.current !== null) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    // listen for data pushes
    useEffect(() => {
        const onStats = (e: Event) => {
            const ce = e as CustomEvent<
                OpponentStatsPayload | null | undefined
            >;
            const payload = ce.detail ?? null;
            // if server tries to send someone else while we’re locked, ignore
            if (lockedUserId && payload && payload.userId !== lockedUserId)
                return;

            // rAF batch
            stagedRef.current = payload;
            if (nextFrameRef.current == null) {
                nextFrameRef.current = requestAnimationFrame(() => {
                    nextFrameRef.current = null;
                    setOp(stagedRef.current ?? null);
                });
            }
        };

        const onClear = () => {
            // Don’t clear if locked; only close if explicitly asked via our button
            if (lockedUserId) return;
            setOp(null);
            stopPolling();
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
            stopPolling();
        };
    }, [lockedUserId]);

    // optional: if you broadcast this after the server accepts SetTarget, we’ll sync instantly
    useEffect(() => {
        const onLockChanged = (e: Event) => {
            const ce = e as CustomEvent<{ userId: number | null }>;
            const id = ce.detail?.userId ?? null;
            setLockedUserId(id);
            if (id) startPolling(id);
            else stopPolling();
        };
        window.addEventListener("target_lock_changed", onLockChanged);
        return () =>
            window.removeEventListener("target_lock_changed", onLockChanged);
    }, []);

    // anchor next to the main bar
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
        // lock if currently unlocked or different; unlock if same
        const next = lockedUserId === op.userId ? null : op.userId;
        setLockedUserId(next);

        try {
            if (
                typeof SendMessageComposer === "function" &&
                SetTargetComposer
            ) {
                SendMessageComposer(new SetTargetComposer(next ?? 0, true));
            }
        } catch {
            /* ignore if composer isn’t wired here */
        }

        // also echo to the UI (handy if server echoes later)
        window.dispatchEvent(
            new CustomEvent("target_lock_changed", { detail: { userId: next } })
        );

        if (next) startPolling(next);
        else stopPolling();
    };

    const onClose = () => {
        setLockedUserId(null);
        stopPolling();
        setOp(null);
        // let the rest of the app know we closed intentionally
        window.dispatchEvent(new CustomEvent("user_inspect_clear"));
        try {
            if (
                typeof SendMessageComposer === "function" &&
                SetTargetComposer
            ) {
                SendMessageComposer(new SetTargetComposer(0, false)); // unlock server‑side
            }
        } catch {}
    };

    return createPortal(
        <div className="opponent-anchor" aria-label="opponent-stats">
            <div className="stats-bar-container opponent">
                {/* LEFT: avatar + XP ring + level */}
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

                {/* RIGHT: bars */}
                <div className="stats-right">
                    {/* Health */}
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

                    {/* Energy */}
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

                    {/* Hunger */}
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

                    {/* Aggression */}
                    <div className="aggression-bar-wrapper">
                        <div
                            className="aggression-fill"
                            style={{ width: `${aggroPct}%` }}
                        />
                    </div>

                    {/* TARGET / UNLOCK */}
                    <div className="work-toggle-wrapper">
                        <button
                            className={`habbo-action-button ${
                                lockedUserId === op.userId ? "red" : ""
                            }`}
                            onClick={onTarget}
                            title={
                                lockedUserId === op.userId
                                    ? "Unlock target"
                                    : "Lock target"
                            }
                        >
                            {lockedUserId === op.userId ? "UNLOCK" : "TARGET"}
                        </button>
                    </div>
                </div>

                {/* Close (explicit only) */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: 4,
                        right: 6,
                        background: "transparent",
                        color: "#fff",
                        border: 0,
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                    title="Close opponent stats"
                    aria-label="Close opponent stats"
                >
                    ×
                </button>
            </div>
        </div>,
        anchorEl
    );

};

export default OpponentStatsOverlay;
