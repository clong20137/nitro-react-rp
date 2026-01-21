import { FC, useEffect, useMemo, useState } from "react";
import "./UserInspectPopup.scss";

interface UserInspectPopupProps {}

type InspectEventDetail = { userId: number };

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

    const percent = (value: number, max: number) => {
        const m = Math.max(1, max || 1);
        const pct = Math.max(0, Math.min(100, Math.round((value / m) * 100)));
        return `${pct}%`;
    };

    const reset = () => {
        setVisible(false);
        setUserId(null);

        setUsername("");
        setHealth(0);
        setMaxHealth(100);
        setEnergy(0);
        setMaxEnergy(100);
        setHunger(0);
        setMaxHunger(100);
        setAggression(0);
    };

    const loadUserStats = async (id: number) => {
        try {
            const res = await fetch(`/api/user-stats/${id}`);
            if (!res.ok) return;

            const data = await res.json();
            setUsername(data.username ?? "Unknown");
            setHealth(data.current_health ?? 0);
            setMaxHealth(data.max_health ?? 100);
            setEnergy(data.energy ?? 0);
            setMaxEnergy(data.max_energy ?? 100);
            setHunger(data.hunger ?? 0);
            setMaxHunger(data.max_hunger ?? 100);
            setAggression(data.aggression ?? 0);
        } catch (err) {
            console.error("Error loading inspected user stats", err);
        }
    };

    useEffect(() => {
        // ✅ match your new system event
        const handleInspect = (e: Event) => {
            const detail = (e as CustomEvent<InspectEventDetail>)?.detail;
            const nextId = detail?.userId;

            if (!nextId || nextId <= 0) return;

            // ✅ always reopen on click (even if previously closed)
            setUserId(nextId);
            setVisible(true);
            loadUserStats(nextId);
        };

        // ✅ close event used by your overlay
        const handleClear = () => {
            reset();
        };

        window.addEventListener(
            "user_inspect_stats",
            handleInspect as EventListener
        );
        window.addEventListener(
            "open-opponent-stats",
            handleInspect as EventListener
        );
        window.addEventListener(
            "user_inspect_clear",
            handleClear as EventListener
        );

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                handleInspect as EventListener
            );
            window.removeEventListener(
                "open-opponent-stats",
                handleInspect as EventListener
            );
            window.removeEventListener(
                "user_inspect_clear",
                handleClear as EventListener
            );
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const avatarUrl = useMemo(() => {
        if (userId === null) return "";
        // If you have figure data elsewhere, swap this to habbo-imaging like your other overlay.
        return `/avatar/${userId}.png`;
    }, [userId]);

    if (!visible || userId === null) return null;

    return (
        <div className="user-inspect-popup">
            {/* Optional close button */}
            <button
                className="inspect-close"
                type="button"
                onClick={() => {
                    // ✅ keep everything consistent with the rest of your system
                    window.dispatchEvent(new CustomEvent("user_inspect_clear"));
                }}
                aria-label="Close"
            >
                ×
            </button>

            <div className="stats-avatar-wrapper">
                <div className="greek-circle">
                    <img className="avatar-head" src={avatarUrl} alt="Avatar" />
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
