import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./StatsBar.scss";
import { SendMessageComposer } from "../../api"; // same import you use elsewhere
import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";

export type OpponentStatsPayload = {
    userId: number;
    username: string;
    figure: string;
    level?: number;
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    maxHunger: number;
    aggression?: number; // ms 0..30000
};

// lightweight global lock so AvatarInfoWidget & this overlay agree
declare global {
    interface Window {
        __OPPONENT_LOCK_USER_ID__?: number | null;
    }
}

const pct = (v: number, m: number) => (m > 0 ? Math.round((v / m) * 100) : 0);

export const OpponentStatsOverlay: React.FC = () => {
    const [op, setOp] = useState<OpponentStatsPayload | null>(null);
    const [locked, setLocked] = useState<boolean>(false);

    // keep local "locked" in sync with global
    useEffect(() => {
        const onLock = (e: Event) => {
            const ce = e as CustomEvent<{ userId: number }>;
            setLocked(true);
            window.__OPPONENT_LOCK_USER_ID__ = ce.detail.userId;
        };
        const onUnlock = () => {
            setLocked(false);
            window.__OPPONENT_LOCK_USER_ID__ = null;
        };
        window.addEventListener("opponent_lock", onLock as EventListener);
        window.addEventListener("opponent_unlock", onUnlock);

        return () => {
            window.removeEventListener(
                "opponent_lock",
                onLock as EventListener
            );
            window.removeEventListener("opponent_unlock", onUnlock);
        };
    }, []);

    // strictly react to our explicit events
    useEffect(() => {
        const onInspect = (e: Event) => {
            const ce = e as CustomEvent<
                OpponentStatsPayload | null | undefined
            >;
            // if locked to someone else, ignore updates for others
            if (
                locked &&
                window.__OPPONENT_LOCK_USER_ID__ &&
                ce.detail &&
                ce.detail.userId !== window.__OPPONENT_LOCK_USER_ID__
            )
                return;
            setOp(ce.detail ?? null);
        };
        const onClear = () => {
            if (!locked) setOp(null);
        };

        window.addEventListener(
            "user_inspect_stats",
            onInspect as EventListener
        );
        window.addEventListener("user_inspect_stats_clear", onClear);

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                onInspect as EventListener
            );
            window.removeEventListener("user_inspect_stats_clear", onClear);
        };
    }, [locked]);

    // live refresh from the server for the currently selected/locked user
    useEffect(() => {
        const onRefresh = (e: Event) => {
            const ce = e as CustomEvent<
                Partial<OpponentStatsPayload> & { userId: number }
            >;
            if (!op) return;
            if (ce.detail.userId !== op.userId) return; // only update current target
            setOp((prev) =>
                prev
                    ? ({ ...prev, ...ce.detail } as OpponentStatsPayload)
                    : prev
            );
        };
        window.addEventListener(
            "user_inspect_stats_refresh",
            onRefresh as EventListener
        );
        return () =>
            window.removeEventListener(
                "user_inspect_stats_refresh",
                onRefresh as EventListener
            );
    }, [op]);

    // anchor to the main stats bar
    const anchorEl = useMemo<HTMLElement | null>(
        () => document.querySelector(".stats-bar-container"),
        [op]
    );
    if (!op || !anchorEl) return null;

    const healthPct = pct(op.health, op.maxHealth);
    const energyPct = pct(op.energy, op.maxEnergy);
    const hungerPct = pct(op.hunger, op.maxHunger);
    const aggroPct = Math.min(
        100,
        Math.max(0, ((op.aggression ?? 0) / 30000) * 100)
    );

    const handleToggleTarget = () => {
        if (!locked) {
            // send lock packet
            SendMessageComposer(new SetTargetComposer(op.userId, true));
            // broadcast lock locally
            window.dispatchEvent(
                new CustomEvent("opponent_lock", {
                    detail: { userId: op.userId },
                })
            );
        } else {
            SendMessageComposer(new SetTargetComposer(op.userId, false));
            window.dispatchEvent(new Event("opponent_unlock"));
        }
    };

    return createPortal(
        <div className="opponent-anchor" aria-label="opponent-stats">
            <div className="stats-bar-container opponent">
                {/* LEFT column (avatar + name/level) */}
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
                                    strokeDasharray="0, 100"
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

                    <div className="avatar-name-wrapper">
                        <div className="avatar-name">{op.username}</div>
                        {op.level !== undefined && (
                            <div className="avatar-level">
                                Level: {op.level}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT column (bars) */}
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

                    {/* Target / Unlock button */}
                    <div className="work-toggle-wrapper">
                        <button
                            className={`work-toggle-btn ${
                                locked ? "stop" : ""
                            }`}
                            onClick={handleToggleTarget}
                        >
                            {locked ? "UNLOCK" : "TARGET"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        anchorEl
    );
};

export default OpponentStatsOverlay;
