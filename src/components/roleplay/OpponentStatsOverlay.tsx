import { FC, useEffect, useMemo, useRef, useState } from "react";
import "./StatsBar.scss";
import { SendMessageComposer } from "../../api";
import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";
// NEW: start/stop inspect (watch without locking)
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
    aggression?: number; // 0–100 (percent)
    level?: number;
};

type Props = { onClose: () => void };

export const OpponentStatsOverlay: FC<Props> = ({ onClose }) => {
    const [stats, setStats] = useState<OpponentStats | null>(null);

    // keep last userId we told the server we're watching (to avoid dup sends)
    const lastWatchedIdRef = useRef<number | 0>(0);

    // merge helper to always trigger re-render
    const mergeUpdate = (payload: OpponentStats) => {
        setStats((prev) => {
            if (!prev) return { ...payload };
            if (prev.userId !== payload.userId) return { ...payload };
            return { ...prev, ...payload };
        });
    };

    // send watch/unwatch safely
    const sendWatch = (targetId: number) => {
        if (lastWatchedIdRef.current === targetId) return;
        lastWatchedIdRef.current = targetId;
        try {
            SendMessageComposer(new StartInspectComposer(targetId));
        } catch {}
    };

    // primary listeners: any of these should both update UI AND start watching
    useEffect(() => {
        const onStats = (e: Event) => {
            const payload = (e as CustomEvent<OpponentStats>).detail;
            if (!payload?.userId) return;
            mergeUpdate(payload);
            sendWatch(payload.userId); // ensure we’re subscribed server-side
        };

        // From your bridge
        window.addEventListener("user_inspect_stats", onStats as EventListener);
        window.addEventListener(
            "opponent_stats_update",
            onStats as EventListener
        );

        // Also honor the bridge’s “open-opponent-stats” bootstrap event
        window.addEventListener(
            "open-opponent-stats",
            onStats as EventListener
        );

        // Clear handler: hides UI and stops watching
        const onClear = () => {
            setStats(null);
            sendWatch(0); // unsubscribe
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

            // safety: unwatch on unmount
            sendWatch(0);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // if some other UI path sets stats first, ensure we begin watching that userId
    useEffect(() => {
        if (stats?.userId) sendWatch(stats.userId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stats?.userId]);

    const percent = (v: number, m: number) =>
        m <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((v / m) * 100)));

    const figureUrl = useMemo(() => {
        if (!stats?.figure) return "";
        // Face LEFT (toward your bar)
        return `https://www.habbo.com/habbo-imaging/avatarimage?figure=${stats.figure}&direction=4&head_direction=4&gesture=sml`;
    }, [stats?.figure]);

    if (!stats) return null;

    const handleClose = () => {
        // stop watching server-side, then bubble up
        sendWatch(0);
        window.dispatchEvent(new CustomEvent("user_inspect_clear"));
        onClose?.();
    };

    return (
        <div className="opponent-anchor">
            <div className="stats-bar-container opponent">
                {/* Bars column FIRST, avatar column LAST -> avatar sits on RIGHT */}
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

                {/* Avatar column on the RIGHT, facing LEFT */}
                <div className="avatar-column" style={{ marginLeft: 10 }}>
                    <div
                        className="greek-circle"
                        title={`${stats.username}${
                            stats.level ? ` — Lv ${stats.level}` : ""
                        }`}
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

                {/* Close + lock buttons sit just to the right edge */}
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

    useEffect(() => setLocked(false), [userId]); // reset when switching target

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
