import { FC, useEffect, useState } from "react";
import "./UserInspectPopup.scss";

interface UserInspectPopupProps {}

export const UserInspectPopup: FC<UserInspectPopupProps> = () => {
    const [visible, setVisible] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [username, setUsername] = useState("");
    const [health, setHealth] = useState(0);
    const [maxHealth, setMaxHealth] = useState(100);
    const [energy, setEnergy] = useState(0);
    const [maxEnergy, setMaxEnergy] = useState(100);
    const [hunger, setHunger] = useState(0);
    const [maxHunger, setMaxHunger] = useState(100);
    const [aggression, setAggression] = useState(0);

    const percent = (value: number, max: number) =>
        `${Math.round((value / max) * 100)}%`;

    useEffect(() => {
        const handleInspect = (e: CustomEvent<{ userId: number }>) => {
            const { userId } = e.detail;
            setUserId(userId);
            loadUserStats(userId);
            setVisible(true);
        };

        window.addEventListener("inspect-user", handleInspect as EventListener);

        return () =>
            window.removeEventListener(
                "inspect-user",
                handleInspect as EventListener
            );
    }, []);

    const loadUserStats = async (id: number) => {
        try {
            const res = await fetch(`/api/user-stats/${id}`);
            if (res.ok) {
                const data = await res.json();
                setUsername(data.username ?? "Unknown");
                setHealth(data.current_health ?? 0);
                setMaxHealth(data.max_health ?? 100);
                setEnergy(data.energy ?? 0);
                setMaxEnergy(data.max_energy ?? 100);
                setHunger(data.hunger ?? 0);
                setMaxHunger(data.max_hunger ?? 100);
                setAggression(data.aggression ?? 0);
            }
        } catch (err) {
            console.error("Error loading inspected user stats", err);
        }
    };

    if (!visible || userId === null) return null;

    return (
        <div className="user-inspect-popup">
            <div className="stats-avatar-wrapper">
                <div className="greek-circle">
                    <img
                        className="avatar-head"
                        src={`/avatar/${userId}.png`}
                        alt="Avatar"
                    />
                </div>
                <div className="avatar-name">{username}</div>
            </div>
            <div className="stat">
                <div className="icons heart" />
                <div className="bar">
                    <div
                        className="fill health"
                        style={{ width: percent(health, maxHealth) }}
                    />
                    <div className="bar-text">
                        {health} / {maxHealth}
                    </div>
                </div>
            </div>
            <div className="stat">
                <div className="icons bolt" />
                <div className="bar">
                    <div
                        className="fill energy"
                        style={{ width: percent(energy, maxEnergy) }}
                    />
                    <div className="bar-text">
                        {energy} / {maxEnergy}
                    </div>
                </div>
            </div>
            <div className="stat">
                <div className="icons apple" />
                <div className="bar">
                    <div
                        className="fill hunger"
                        style={{ width: percent(hunger, maxHunger) }}
                    />
                    <div className="bar-text">
                        {hunger} / {maxHunger}
                    </div>
                </div>
            </div>
            <div className="stat aggression">
                <div className="bar">
                    <div
                        className="fill aggression"
                        style={{ width: percent(aggression, 100) }}
                    />
                </div>
            </div>
        </div>
    );
};

export default UserInspectPopup;
