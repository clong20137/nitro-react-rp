import { FC, useEffect, useMemo, useRef, useState } from "react";
import "./StatsBar.scss";
import { SendMessageComposer } from "../../api";
import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";
import { StartInspectComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartInspectComposer";

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
    aggression?: number; // 0–100
    level?: number;
};

type Props = { onClose: () => void };

export const OpponentStatsOverlay: FC<Props> = ({ onClose }) => {
    const [stats, setStats] = useState<OpponentStats | null>(null);
    const lastWatchedIdRef = useRef<number | 0>(0);

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

    useEffect(() => {
        const onStats = (e: Event) => {
            const payload = (e as CustomEvent<OpponentStats>).detail;
            if (!payload?.userId) return;
            mergeUpdate(payload);
            sendWatch(payload.userId);
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

        const onClear = () => {
            setStats(null);
            sendWatch(0);
        };
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
        // face LEFT (toward the bar)
        return `https://www.habbo.com/habbo-imaging/avatarimage?figure=${stats.figure}&direction=4&head_direction=4&gesture=sml`;
    }, [stats?.figure]);

    if (!stats) return null;

    const handleClose = () => {
        sendWatch(0);
        window.dispatchEvent(new CustomEvent("user_inspect_clear"));
        onClose?.();
    };

    return (
        <div className="opponent-anchor">
            <div className="stats-bar-container opponent">
                {/* Bars column */}
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
                            <div className="bar-text">{`${stats.health} / ${stats.maxHealth}`}</div>
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
                            <div className="bar-text">{`${stats.energy} / ${stats.maxEnergy}`}</div>
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
                            <div className="bar-text">{`${stats.hunger / 1} / ${
                                stats.maxHunger
                            }`}</div>
                        </div>
                    </div>

                    <div className="aggression-bar-wrapper">
                        <div
                            className="aggression-fill"
                            style={{
                                width: `${Math.max(
                                    0,
                                    Math.min(100, stats.aggression ?? 0)
                                )}%`,
                            }}
                        />
                    </div>
                </div>

                {/* Avatar column on the RIGHT, clickable to open profile */}
                <div className="avatar-column" style={{ marginLeft: 10 }}>
                    <div
                        className="greek-circle"
                        title={`${stats.username}${
                            stats.level ? ` — Lv ${stats.level}` : ""
                        }`}
                        onClick={() => {
                            // Tell StatsBar to open a Profile using this payload
                            window.dispatchEvent(
                                new CustomEvent("open_profile_from_inspect", {
                                    detail: {
                                        username: stats.username,
                                        figure: stats.figure,
                                        level: stats.level ?? 0,

                                        // Defaults (can be enriched later by a server packet)
                                        kills: 0,
                                        deaths: 0,
                                        punches: 0,
                                        damageGiven: 0,
                                        damageReceived: 0,
                                        strength: 0,
                                        stamina: 0,
                                        defense: 0,
                                        healthlevel: 0,
                                        hungerLevel: 0,
                                        gathering: 0,
                                        xp: 0,
                                        maxXP: 1,
                                        points: 0,

                                        gangName: undefined,
                                        gangId: undefined,
                                        gangIconKey: undefined,
                                        gangPrimaryColor: undefined,
                                        gangSecondaryColor: undefined,
                                        motto: undefined,
                                        jobTitle: undefined,
                                        corporationName: undefined,
                                        corporationIconUrl: undefined,
                                        isOnline: true,
                                    },
                                })
                            );
                        }}
                        style={{ cursor: "pointer" }}
                    >
                        <img
                            className="avatar-head"
                            src={figureUrl}
                            alt={stats.username}
                        />
                        {stats.level ? (
                            <div className="level-badge">{stats.level}</div>
                        ) : null}
                    </div>
                    <div
                        className="avatar-name"
                        style={{ maxWidth: 110, textAlign: "center" }}
                    >
                        {stats.username}
                    </div>
                </div>

                {/* Close + lock */}
                <button
                    className="close-button_right"
                    onClick={handleClose}
                    aria-label="Close opponent"
                />
                <TargetLock userId={stats.userId} />
            </div>
        </div>
    );
};

const TargetLock: FC<{ userId: number }> = ({ userId }) => {
    const [locked, setLocked] = useState(false);

    useEffect(() => setLocked(false), [userId]);

    const toggle = () => {
        const next = !locked;
        setLocked(next);
        try {
            SendMessageComposer(new SetTargetComposer(next ? userId : 0, next));
        } catch {}
        window.dispatchEvent(
            new CustomEvent(
                next ? "opponent_target_set" : "opponent_target_clear",
                {
                    detail: { userId },
                }
            )
        );
    };

    return (
        <button
            className={`target-btn ${locked ? "locked" : ""}`}
            aria-label={locked ? "Unlock target" : "Lock target"}
            onClick={toggle}
            title={locked ? "Unlock target" : "Lock target"}
        />
    );
};
