import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import "./StatsBar.scss";
import { SendMessageComposer } from "../../api";
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
    const lastWatchedIdRef = useRef<number>(0);

    const mergeUpdatefUpdate = (payload: OpponentStats) => {
        setStats((prev) => {
            if (!prev) return { ...payload };
            if (prev.userId !== payload.userId) return { ...payload };
            return { ...prev, ...payload };
        });
    };

    const sendWatch = (targetId: number) => {
        if (lastWatchedIdRef.current === targetId) return;
        lastWatchedIdRef.current = targetId;

        try {
            SendMessageComposer(new StartInspectComposer(targetId));
        } catch {}
    };

    useEffect(() => {
        const onStats = (e: Event) => {
            const payload = (e as CustomEvent<any>).detail as
                | OpponentStats
                | undefined;
            if (!payload || !payload.userId) return;

            // merge
            setStats((prev) => {
                if (!prev) return { ...payload };
                if (prev.userId !== payload.userId) return { ...payload };
                return { ...prev, ...payload };
            });

            sendWatch(payload.userId);
            setHiding(false);
        };

        const onClear = () => {
            setHiding(true);
            setTimeout(() => {
                setStats(null);
                setLocked(false);
                sendWatch(0);
            }, 180);
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
            sendWatch(0);
        };
    }, []);

    useEffect(() => {
        if (stats?.userId) sendWatch(stats.userId);
    }, [stats?.userId]);

    const percent = (v: number, m: number) =>
        m <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((v / m) * 100)));

    const figureUrl = useMemo(() => {
        if (!stats?.figure) return "";
        return `https://www.habbo.com/habbo-imaging/avatarimage?figure=${stats.figure}&direction=4&head_direction=4&gesture=sml`;
    }, [stats?.figure]);

    /** ONLY open profile when clicking the avatar image (not X/lock) */
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
        e.stopPropagation(); // ✅ prevents openProfile
        setHiding(true);
        setTimeout(() => {
            sendWatch(0);
            setStats(null);
            setLocked(false);
            window.dispatchEvent(new CustomEvent("user_inspect_clear"));
            onClose?.();
        }, 180);
    };

    const toggleLock = (e: React.MouseEvent) => {
        e.stopPropagation(); // ✅ prevents openProfile
        if (!stats) return;

        const next = !locked;
        setLocked(next);

        // target lock only — no profile open
        SendMessageComposer(
            new SetTargetComposer(next ? stats.userId : 0, next)
        );
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
                {/* ✅ LEFT: bars (now actually LEFT due to CSS fix below) */}
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
                            {/* ✅ use same class as self */}
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
                            className="aggression-fill"
                            style={{ width: `${aggressionPct}%` }}
                        />
                    </div>
                </div>

                {/* RIGHT: avatar + actions */}
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

                            {/* ✅ ONLY avatar click opens profile */}
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

                            {/* ✅ X no longer opens profile */}
                            <button
                                className="circle-close"
                                onClick={handleClose}
                            />

                            {/* ✅ Lock no longer opens profile */}
                            <button
                                className={`circle-lock ${
                                    locked ? "is-locked" : ""
                                }`}
                                onClick={toggleLock}
                                aria-label="Lock target"
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
