import { FC, useEffect, useState } from "react";
import "./StatsBar.scss";

interface OpponentStats {
    userId: number;
    username: string;
    figure: string;
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    maxHunger: number;
    aggression: number;
}

export const OpponentStatsBar: FC = () => {
    const [stats, setStats] = useState<OpponentStats | null>(null);

    useEffect(() => {
        const onInspect = (event: CustomEvent) => {
            setStats(event.detail);
        };

        window.addEventListener(
            "user_inspect_stats",
            onInspect as EventListener
        );

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                onInspect as EventListener
            );
        };
    }, []);

    if (!stats) return null;

    return (
        <div className="stats-bar opponent-stats-bar">
            <div className="stats-header">
                <span>{stats.username}</span>
                <button className="close-btn" onClick={() => setStats(null)}>
                    ✖
                </button>
            </div>

            <div className="stat-row">
                <span className="stat-label">Health</span>
                <div className="stat-bar health">
                    <div
                        className="fill"
                        style={{
                            width: `${(stats.health / stats.maxHealth) * 100}%`,
                        }}
                    />
                </div>
                <span className="stat-value">
                    {stats.health}/{stats.maxHealth}
                </span>
            </div>

            <div className="stat-row">
                <span className="stat-label">Energy</span>
                <div className="stat-bar energy">
                    <div
                        className="fill"
                        style={{
                            width: `${(stats.energy / stats.maxEnergy) * 100}%`,
                        }}
                    />
                </div>
                <span className="stat-value">
                    {stats.energy}/{stats.maxEnergy}
                </span>
            </div>

            <div className="stat-row">
                <span className="stat-label">Hunger</span>
                <div className="stat-bar hunger">
                    <div
                        className="fill"
                        style={{
                            width: `${(stats.hunger / stats.maxHunger) * 100}%`,
                        }}
                    />
                </div>
                <span className="stat-value">
                    {stats.hunger}/{stats.maxHunger}
                </span>
            </div>

            <div className="stat-row">
                <span className="stat-label">Aggression</span>
                <div className="stat-bar aggression">
                    <div
                        className="fill"
                        style={{ width: `${stats.aggression}%` }}
                    />
                </div>
                <span className="stat-value">{stats.aggression}s</span>
            </div>
        </div>
    );
};
