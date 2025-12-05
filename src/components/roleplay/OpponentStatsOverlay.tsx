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

    const mergeUpdate = (payload: OpponentStats) => {
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

    // Listen for inspect update packets
    useEffect(() => {
        const onStats = (e: Event) => {
            const payload = (e as CustomEvent<any>).detail as
                | OpponentStats
                | undefined;
            if (!payload || !payload.userId) return;

            mergeUpdate(payload);
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

    /** 🔥 PATCHED: FULL opponent → MyProfileView payload */
    const openProfile = () => {
        if (!stats) return;

        window.dispatchEvent(
            new CustomEvent("open_profile_from_inspect", {
                detail: {
                    userId: stats.userId,

                    // identity
                    username: stats.username,
                    figure: stats.figure,
                    motto: stats.motto,

                    // xp / level
                    xp: stats.xp ?? 0,
                    maxXP: stats.maxXP ?? 1,
                    level: stats.level ?? 0,
                    points: stats.points ?? 0,

                    // core combat stats
                    strength: stats.strength ?? 0,
                    stamina: stats.stamina ?? 0,
                    defense: stats.defense ?? 0,
                    gathering: stats.gathering ?? 0,
                    healthlevel: stats.healthlevel ?? 0,

                    // fighting counters (canonical names)
                    punches: stats.punches ?? 0,
                    damageGiven: stats.damageGiven ?? 0,
                    damageReceived: stats.damageReceived ?? 0,
                    kills: stats.kills ?? 0,
                    deaths: stats.deaths ?? 0,

                    shiftsWorked: stats.shiftsWorked ?? 0,
                    arrests: stats.arrests ?? 0,

                    // employment
                    jobTitle: stats.jobTitle,
                    corporationName: stats.corporationName,
                    corporationIconUrl: stats.corporationIconUrl,

                    // gang visual data
                    gangId: stats.gangId,
                    gangName: stats.gangName,
                    gangIconKey: stats.gangIconKey,
                    gangPrimaryColor: stats.gangPrimaryColor,
                    gangSecondaryColor: stats.gangSecondaryColor,

                    // meta
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
    const aggressionPct = percent(stats.aggressionMs ?? 0, 45000);

    const handleClose = () => {
        setHiding(true);
        setTimeout(() => {
            sendWatch(0);
            setStats(null);
            setLocked(false);
            window.dispatchEvent(new CustomEvent("user_inspect_clear"));
        }, 180);
    };

    const toggleLock = () => {
        if (!stats) return;
        const next = !locked;
        setLocked(next);
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
                {/* LEFT: bars */}
                <div className="stats-right">
                    <div className="stat">
                        <div className="icons heart" />
                        <div className="bar">
                            <div
                                className="fill health"
                                style={{
                                    width: `${percent(
                                        stats.health,
                                        stats.maxHealth
                                    )}%`,
                                }}
                            />
                            <div className="bar-text">
                                {stats.health} / {stats.maxHealth}
                            </div>
                        </div>
                    </div>

                    <div className="stat">
                        <div className="icons bolt" />
                        <div className="bar">
                            <div
                                className="fill energy"
                                style={{
                                    width: `${percent(
                                        stats.energy,
                                        stats.maxEnergy
                                    )}%`,
                                }}
                            />
                            <div className="bar-text">
                                {stats.energy} / {stats.maxEnergy}
                            </div>
                        </div>
                    </div>

                    <div className="stat">
                        <div className="icons apple" />
                        <div className="bar">
                            <div
                                className="fill hunger"
                                style={{
                                    width: `${percent(
                                        stats.hunger,
                                        stats.maxHunger
                                    )}%`,
                                }}
                            />
                            <div className="bar-text">
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
                    <div className="greek-circle" onClick={openProfile}>
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
                            />

                            {stats.level ? (
                                <div className="level-badge">{stats.level}</div>
                            ) : null}

                            <button
                                className="circle-close"
                                onClick={handleClose}
                            />
                            <button
                                className={`circle-lock ${
                                    locked ? "is-locked" : ""
                                }`}
                                onClick={toggleLock}
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
