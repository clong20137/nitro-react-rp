import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import "./StatsBar.scss";
import { SendMessageComposer, GetSessionDataManager } from "../../api";
import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";
import { StartInspectComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartInspectComposer";

/** THIS MUST MATCH SERVER FIELD NAMES EXACTLY */
type OpponentStats = {
    userId: number;
    username: string;
    figure: string;

    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    maxHunger: number;

    aggressionMs?: number;

    // xp / stats
    xp?: number;
    maxXP?: number;
    level?: number;
    points?: number;

    strength?: number;
    stamina?: number;
    defense?: number;
    gathering?: number;
    healthlevel?: number;

    // FIGHTING (canonical names!)
    punches?: number;
    damageGiven?: number;
    damageReceived?: number;
    kills?: number;
    deaths?: number;

    shiftsWorked?: number;
    arrests?: number;

    // employment
    jobTitle?: string;
    corporationName?: string;
    corporationIconUrl?: string;

    // gang
    gangId?: number;
    gangName?: string;
    gangIconKey?: string;
    gangPrimaryColor?: string;
    gangSecondaryColor?: string;

    // meta
    motto?: string;
    createdAt?: string;
    lastLogin?: string;
    lastSeenAgo?: string;
    isOnline?: boolean;
};

type Props = { onClose: () => void };

export const OpponentStatsOverlay: FC<Props> = ({ onClose }) => {
    const [stats, setStats] = useState<OpponentStats | null>(null);
    const [locked, setLocked] = useState(false);
    const [hiding, setHiding] = useState(false);

    const myUserId = GetSessionDataManager().userId;

    // prevents re-sending StartInspect for same user unless we reset it
    const lastWatchedIdRef = useRef<number>(0);

    // latest values inside event listeners
    const lockedRef = useRef<boolean>(false);
    const lockedUserIdRef = useRef<number>(0);
    const currentStatsUserIdRef = useRef<number>(0);

    // polling timer
    const pollTimerRef = useRef<number | null>(null);

    useEffect(() => {
        lockedRef.current = locked;
        lockedUserIdRef.current = locked
            ? stats?.userId ?? lockedUserIdRef.current
            : 0;
    }, [locked, stats?.userId]);

    useEffect(() => {
        currentStatsUserIdRef.current = stats?.userId ?? 0;
    }, [stats?.userId]);

    const sendWatch = (targetId: number) => {
        if (targetId === 0) {
            lastWatchedIdRef.current = 0;
            return;
        }

        if (lastWatchedIdRef.current === targetId) return;
        lastWatchedIdRef.current = targetId;

        try {
            SendMessageComposer(new StartInspectComposer(targetId));
        } catch {}
    };

    const forceWatch = (targetId: number) => {
        if (targetId <= 0) return;
        try {
            SendMessageComposer(new StartInspectComposer(targetId));
        } catch {}
    };

    const stopPolling = () => {
        if (pollTimerRef.current !== null) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const startPolling = (targetId: number) => {
        stopPolling();
        if (targetId <= 0) return;

        pollTimerRef.current = window.setInterval(() => {
            const id = lockedRef.current
                ? lockedUserIdRef.current
                : currentStatsUserIdRef.current;

            if (id > 0) forceWatch(id);
        }, 600);
    };

    const clearOverlay = (alsoClearTarget: boolean) => {
        setHiding(true);

        lastWatchedIdRef.current = 0;

        stopPolling();

        if (alsoClearTarget) {
            try {
                SendMessageComposer(new SetTargetComposer(0, false));
            } catch {}
        }

        setTimeout(() => {
            sendWatch(0);
            setStats(null);
            setLocked(false);
            setHiding(false);
        }, 180);
    };

    useEffect(() => {
        const onStats = (e: Event) => {
            const payload = (e as CustomEvent<any>).detail as
                | OpponentStats
                | undefined;
            if (!payload || !payload.userId) return;

            // ✅ CRITICAL FIX:
            // Never allow your own stats to populate the opponent overlay.
            // (This is the bug you’re seeing when combat packets reuse the same event name.)
            if (payload.userId === myUserId) {
                // If you're locked on someone else, ignore self updates too.
                return;
            }

            // ✅ If locked, do NOT allow a different user to override the overlay
            if (lockedRef.current) {
                const lockedId =
                    lockedUserIdRef.current || currentStatsUserIdRef.current;
                if (lockedId > 0 && payload.userId !== lockedId) return;
            }

            setStats((prev) => {
                if (!prev) return { ...payload };
                if (prev.userId !== payload.userId)
                    return { aggressionMs: 0, ...payload };
                return {
                    ...prev,
                    ...payload,
                    aggressionMs:
                        payload.aggressionMs ?? prev.aggressionMs ?? 0,
                };
            });

            // ensure we're watching the current opponent (idempotent)
            sendWatch(payload.userId);

            startPolling(payload.userId);

            setHiding(false);
        };

        const onClear = () => {
            if (lockedRef.current) return;
            clearOverlay(false);
        };

        window.addEventListener("user_inspect_stats", onStats as EventListener);
        window.addEventListener(
            "opponent_stats_update",
            onStats as EventListener
        );
        window.addEventListener(
            "open-opponent-stats",
            onStats as EventListener
        );
        window.addEventListener("user_inspect_clear", onClear as EventListener);

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                onStats as EventListener
            );
            window.removeEventListener(
                "opponent_stats_update",
                onStats as EventListener
            );
            window.removeEventListener(
                "open-opponent-stats",
                onStats as EventListener
            );
            window.removeEventListener(
                "user_inspect_clear",
                onClear as EventListener
            );

            stopPolling();
            sendWatch(0);
        };
        // myUserId is stable per session; if you hot-swap sessions, add it here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (stats?.userId) {
            sendWatch(stats.userId);
            startPolling(stats.userId);
        }
        if (!stats?.userId) stopPolling();
    }, [stats?.userId]);

    const percent = (v: number, m: number) =>
        m <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((v / m) * 100)));

    const figureUrl = useMemo(() => {
        if (!stats?.figure) return "";
        return `https://imager.olympusrp.pw/?figure=${stats.figure}&direction=4&head_direction=4&gesture=sml`;
    }, [stats?.figure]);

    const openProfile = () => {
        if (!stats) return;

        window.dispatchEvent(
            new CustomEvent("open_profile_from_inspect", {
                detail: {
                    userId: stats.userId,
                    username: stats.username,
                    figure: stats.figure,
                    motto: stats.motto,

                    xp: stats.xp ?? 0,
                    maxXP: stats.maxXP ?? 1,
                    level: stats.level ?? 0,
                    points: stats.points ?? 0,

                    strength: stats.strength ?? 0,
                    stamina: stats.stamina ?? 0,
                    defense: stats.defense ?? 0,
                    gathering: stats.gathering ?? 0,
                    healthlevel: stats.healthlevel ?? 0,

                    punches: stats.punches ?? 0,
                    damageGiven: stats.damageGiven ?? 0,
                    damageReceived: stats.damageReceived ?? 0,
                    kills: stats.kills ?? 0,
                    deaths: stats.deaths ?? 0,

                    shiftsWorked: stats.shiftsWorked ?? 0,
                    arrests: stats.arrests ?? 0,

                    jobTitle: stats.jobTitle,
                    corporationName: stats.corporationName,
                    corporationIconUrl: stats.corporationIconUrl,

                    gangId: stats.gangId,
                    gangName: stats.gangName,
                    gangIconKey: stats.gangIconKey,
                    gangPrimaryColor: stats.gangPrimaryColor,
                    gangSecondaryColor: stats.gangSecondaryColor,

                    createdAt: stats.createdAt,
                    lastLogin: stats.lastLogin,
                    lastSeenAgo: stats.lastSeenAgo,
                    isOnline: stats.isOnline ?? true,
                },
            })
        );
    };

    if (!stats) return null;

    const xpPct = percent(stats.xp ?? 0, stats.maxXP ?? 1);
    const aggressionPct = percent(stats.aggressionMs ?? 0, 45_000);

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();

        const wasLocked = lockedRef.current;

        try {
            window.dispatchEvent(new CustomEvent("user_inspect_clear"));
        } catch {}

        clearOverlay(wasLocked);
        onClose?.();
    };

    const toggleLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!stats) return;

        const next = !locked;
        setLocked(next);

        lockedUserIdRef.current = next ? stats.userId : 0;

        try {
            SendMessageComposer(
                new SetTargetComposer(next ? stats.userId : 0, next)
            );
        } catch {}

        startPolling(stats.userId);
    };

    const gangSquareStyle = stats.gangPrimaryColor
        ? {
              background: stats.gangSecondaryColor
                  ? `linear-gradient(90deg, ${stats.gangPrimaryColor} 50%, ${stats.gangSecondaryColor} 50%)`
                  : stats.gangPrimaryColor,
          }
        : undefined;

    return (
        <div className="opponent-anchor">
            <div
                className={`stats-bar-container opponent ${
                    hiding ? "fade-out" : "fade-in"
                }`}
            >
                <div className="stats-right">
                    <div className="stat">
                        <div className="icons heart" />
                        <div className="bar health-bar">
                            <div
                                className="fill health"
                                style={{
                                    width: `${percent(
                                        stats.health,
                                        stats.maxHealth
                                    )}%`,
                                }}
                            />
                            <div className="bar-value">
                                {stats.health} / {stats.maxHealth}
                            </div>
                        </div>
                    </div>

                    <div className="stat">
                        <div className="icons bolt" />
                        <div className="bar energy-bar">
                            <div
                                className="fill energy"
                                style={{
                                    width: `${percent(
                                        stats.energy,
                                        stats.maxEnergy
                                    )}%`,
                                }}
                            />
                            <div className="bar-value">
                                {stats.energy} / {stats.maxEnergy}
                            </div>
                        </div>
                    </div>

                    <div className="stat">
                        <div className="icons apple" />
                        <div className="bar hunger-bar">
                            <div
                                className="fill hunger"
                                style={{
                                    width: `${percent(
                                        stats.hunger,
                                        stats.maxHunger
                                    )}%`,
                                }}
                            />
                            <div className="bar-value">
                                {stats.hunger} / {stats.maxHunger}
                            </div>
                        </div>
                    </div>

                    <div className="aggression-bar-wrapper">
                        <div
                            className="aggression-fill opponent-aggression"
                            style={{ width: `${aggressionPct}%` }}
                        />
                    </div>
                </div>

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
                                src={figureUrl}
                                alt={stats.username}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openProfile();
                                }}
                            />

                            {stats.level ? (
                                <div className="level-badge">{stats.level}</div>
                            ) : null}

                            <button
                                className="circle-close"
                                onClick={handleClose}
                            />

                            <div
                                className={`circle-lock ${
                                    locked ? "is-locked" : ""
                                }`}
                                role="button"
                                tabIndex={0}
                                aria-label="Lock target"
                                onClick={toggleLock}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        toggleLock({
                                            stopPropagation() {},
                                        } as any);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="avatar-name opponent-name">
                        {stats.username}
                        {stats.gangPrimaryColor && (
                            <span
                                className="gang-square"
                                style={gangSquareStyle}
                                title={stats.gangName}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
