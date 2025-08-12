import { FC, useEffect, useState } from "react";
import "./ZeusStatsBar.scss";

const ZeusStatsBar: FC = () => {
    const [stats, setStats] = useState({ health: 0, maxHealth: 250 });
    

    useEffect(() => {
         let hasPlayed = false;
        const handleUpdate = (event: CustomEvent) => {
            const { health, maxHealth } = event.detail;
            setStats({ health, maxHealth });
               if (!hasPlayed) {
            hasPlayed = true;
            const audio = new Audio("/sounds/thunder.mp3");
            audio.volume = 0.7;
            audio.play().catch((err) => console.warn("Thunder sound error:", err));
        }
        };

        window.addEventListener(
            "zeus_stats_update",
            handleUpdate as EventListener
        );

        return () => {
            window.removeEventListener(
                "zeus_stats_update",
                handleUpdate as EventListener
            );
        };
    }, []);

    const percent = Math.round((stats.health / stats.maxHealth) * 100);

    return (
        <div className="zeus-health-bar-container">
            <div
                className="zeus-health-bar-fill"
                style={{ width: `${percent}%` }}
            />
            <div className="zeus-health-bar-text">
                ZEUS HEALTH: {stats.health} / {stats.maxHealth}
            </div>
        </div>
    );
};

export default ZeusStatsBar;
