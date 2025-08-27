import React, { FC, useEffect, useRef, useState } from "react";
import "./MyProfileView.scss";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { UpgradeStatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UpgradeStatComposer";

/* --------------------------------- Types --------------------------------- */

interface StatsProps {
    kills: number;
    deaths: number;
    punches: number;
    damageGiven: number;
    damageReceived: number;
    strength: number;
    stamina: number;
    energy: number;
    hunger: number;
    xp: number;
    maxXP: number;
    level: number;
    points: number;
    defense: number;
    hungerLevel: number; // camelCase (kept to match your existing code)
    gathering: number;
    username: string;
    figure: string;

    /** Server may send either `healthlevel` or `healthLevel`. Support both. */
    healthlevel: number;
    healthLevel?: number;

    // NEW — all optional so older packets still compile
    gangName?: string;
    gangId?: number;
    gangIconKey?: string; // e.g. "ALW09"
    gangPrimaryColor?: string; // "#RRGGBB" or "RRGGBB"
    gangSecondaryColor?: string;
    motto?: string;
    jobTitle?: string;
    corporationName?: string;
    isOnline?: boolean;
    corporationIconUrl?: string; // tiny square icon if you have one
}

type UpgradeableStat =
    | "strength"
    | "stamina"
    | "defense"
    | "healthlevel"
    | "gathering";

interface MyProfileViewProps {
    onClose: () => void;
    stats: StatsProps;
    onUpgrade: (stat: UpgradeableStat) => void;

    // Optional presence injected by caller (fallback true)
    isOnline?: boolean;
}

/* ------------------------------- Component -------------------------------- */

export const MyProfileView: FC<MyProfileViewProps> = ({
    onClose,
    stats,
    onUpgrade,
    isOnline = true,
}) => {
    // Resolve healthlevel once, accepting either casing
    const resolvedHealthlevel =
        (stats.healthlevel ?? stats.healthLevel ?? 0) | 0;

    // window position (same behavior you had)
    const [position] = useState<{ x: number; y: number }>(() => {
        const stored = localStorage.getItem("profilePos");
        return stored ? JSON.parse(stored) : { x: 100, y: 100 };
    });

    const kdRatio =
        stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : "∞";

    const posRef = useRef(position);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    const [gangName, setGangName] = useState<string>(stats.gangName ?? "");
    const [gangId, setGangId] = useState<number | undefined>(stats.gangId);
    const [gangIconKey, setGangIconKey] = useState<string>(
        stats.gangIconKey ?? ""
    );
    const [primaryColor, setPrimaryColor] = useState<string>(
        stats.gangPrimaryColor?.startsWith("#")
            ? stats.gangPrimaryColor
            : stats.gangPrimaryColor
            ? `#${stats.gangPrimaryColor}`
            : "#000000"
    );
    const [secondaryColor, setSecondaryColor] = useState<string>(
        stats.gangSecondaryColor?.startsWith("#")
            ? stats.gangSecondaryColor
            : stats.gangSecondaryColor
            ? `#${stats.gangSecondaryColor}`
            : "#000000"
    );

    useEffect(() => {
        const onGangStatus = (ev: any) => {
            const d = ev.detail || {};
            if (typeof d.gangName === "string") setGangName(d.gangName);
            if (typeof d.gangId === "number") setGangId(d.gangId);

            const prim = d.primaryColor
                ? String(d.primaryColor).startsWith("#")
                    ? d.primaryColor
                    : `#${d.primaryColor}`
                : undefined;
            const sec = d.secondaryColor
                ? String(d.secondaryColor).startsWith("#")
                    ? d.secondaryColor
                    : `#${d.secondaryColor}`
                : undefined;
            if (prim) setPrimaryColor(prim);
            if (sec) setSecondaryColor(sec);

            const key = (d.iconKey ?? d.icon ?? "").toString().trim();
            if (key) setGangIconKey(key.toUpperCase());
        };

        window.addEventListener("gang_status_result", onGangStatus);
        return () =>
            window.removeEventListener("gang_status_result", onGangStatus);
    }, []);

    useEffect(() => {
        if (stats.gangName && !gangName) setGangName(stats.gangName);
    }, [stats.gangName]); // eslint-disable-line

    useEffect(() => {
        const handleGangStatus = (event: any) => {
            const d = event?.detail;
            if (!d) return;

            if (typeof d.gangName === "string") setGangName(d.gangName);
            if (typeof d.gangId === "number") setGangId(d.gangId);

            const norm = (hex?: string) =>
                !hex
                    ? "#000000"
                    : hex.startsWith("#")
                    ? hex.toUpperCase()
                    : `#${hex.toUpperCase()}`;

            setPrimaryColor(norm(d.primaryColor));
            setSecondaryColor(norm(d.secondaryColor));

            let key: string = (d.iconKey || d.icon || "").toString().trim();
            if (!key && typeof d.iconUrl === "string") {
                const m = d.iconUrl.match(/\/([A-Z0-9]+)\.(gif|png)$/i);
                if (m) key = m[1];
            }
            if (key) setGangIconKey(key.toUpperCase());
        };

        window.addEventListener("gang_status_result", handleGangStatus);
        return () =>
            window.removeEventListener("gang_status_result", handleGangStatus);
    }, []);

    // derive icon src from key, matching your gang settings
    const gangIconSrc = gangIconKey ? `/icons/badges/${gangIconKey}.gif` : "";

    /* ------------------------------ Drag handlers ------------------------------ */

    const startDrag = (e: React.MouseEvent) => {
        dragRef.current = {
            dx: e.clientX - posRef.current.x,
            dy: e.clientY - posRef.current.y,
        };
        window.addEventListener("mousemove", handleDrag);
        window.addEventListener("mouseup", stopDrag);
    };

    const handleDrag = (e: MouseEvent) => {
        if (!dragRef.current || !viewRef.current) return;
        const newPos = {
            x: e.clientX - dragRef.current.dx,
            y: e.clientY - dragRef.current.dy,
        };
        posRef.current = newPos;
        viewRef.current.style.left = `${newPos.x}px`;
        viewRef.current.style.top = `${newPos.y}px`;
    };

    const stopDrag = () => {
        dragRef.current = null;
        localStorage.setItem("profilePos", JSON.stringify(posRef.current));
        window.removeEventListener("mousemove", handleDrag);
        window.removeEventListener("mouseup", stopDrag);
    };

    /* ------------------------------ Upgrade action ----------------------------- */

    const handleUpgrade = (stat: UpgradeableStat) => {
        if (stats.points <= 0) return;

        const cap12 = [
            "strength",
            "stamina",
            "defense",
            "healthlevel",
            "gathering",
        ] as const;
        const currentVal =
            stat === "healthlevel"
                ? resolvedHealthlevel
                : (stats as any)[stat] ?? 0;

        if ((cap12 as readonly string[]).includes(stat) && currentVal >= 12)
            return;

        GetCommunication().connection.send(new UpgradeStatComposer(stat));
        onUpgrade(stat);
    };

    /* ----------------------------------- UI ----------------------------------- */

    // helper so our meters use the resolved healthlevel value
    const valueFor = (name: UpgradeableStat) =>
        name === "healthlevel"
            ? resolvedHealthlevel
            : (stats as any)[name] ?? 0;

    return (
        <div
            ref={viewRef}
            className="profile-container"
            style={{
                position: "absolute",
                left: posRef.current.x,
                top: posRef.current.y,
                zIndex: 9999,
            }}
        >
            <div className="profile-header" onMouseDown={startDrag}>
                <div className="title">Profile</div>
                <button className="close-button" onClick={onClose}>
                    ✖
                </button>
            </div>

            <div className="profile-body">
                {/* ------------------------------ LEFT COLUMN ------------------------------ */}
                <div className="profile-left">
                    <div className="avatar-section">
                        <div className="avatar-frame">
                            {/* avatar */}
                            <img
                                className="profile-avatar"
                                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${stats.figure}`}
                                alt="avatar"
                                draggable={false}
                            />

                            {/* online/offline badge (top-right) */}
                            <img
                                className="presence-badge"
                                src={
                                    isOnline
                                        ? "/icons/user_online.gif"
                                        : "/icons/user_offline.gif"
                                }
                                alt={isOnline ? "online" : "offline"}
                                draggable={false}
                            />

                            {/* gang icon (bottom-right, small) */}
                            {gangIconSrc && (
                                <img
                                    className="gang-badge"
                                    src={gangIconSrc}
                                    alt="gang"
                                    draggable={false}
                                />
                            )}
                        </div>

                        <div className="username">{stats.username}</div>
                        {!!stats.motto && (
                            <div className="motto">“{stats.motto}”</div>
                        )}
                    </div>

                    <div className="info-section">
                        {/* Job / Corporation */}
                        <div className="corp-card">
                            {stats.corporationIconUrl && (
                                <img
                                    src={stats.corporationIconUrl}
                                    alt="corp"
                                />
                            )}
                            <div className="corp-lines">
                                <div className="corp-title">
                                    {stats.jobTitle || "Unemployed"}
                                </div>
                                <div className="corp-sub">
                                    {stats.corporationName || "No corporation"}
                                </div>
                            </div>
                        </div>

                        {/* Working state (wire later if needed) */}
                        <div className="work-status red">Not working</div>

                        {/* Gang line */}
                        <div className="gang-line">
                            <div className="gang-color-split-box">
                                <div
                                    className="color-half left"
                                    style={{ backgroundColor: primaryColor }}
                                />
                                <div
                                    className="color-half right"
                                    style={{ backgroundColor: secondaryColor }}
                                />
                                {gangIconKey && (
                                    <img
                                        className="gang-icon"
                                        src={`/icons/badges/${gangIconKey}.gif`}
                                        alt="gang icon"
                                        draggable={false}
                                    />
                                )}
                            </div>
                            <span>{gangName || "No gang"}</span>
                            {typeof gangId === "number" && (
                                <span className="muted">(#${gangId})</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ------------------------------ RIGHT COLUMN ----------------------------- */}
                <div className="profile-right">
                    {/* Level / XP */}
                    <div className="level-xp">
                        <div>Level: {stats.level}</div>
                        <div className="xp-bar">
                            <div
                                className="xp-fill"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        (stats.xp / Math.max(1, stats.maxXP)) *
                                            100
                                    )}%`,
                                }}
                            />
                        </div>
                        <div className="xp-text">
                            {stats.xp} / {stats.maxXP} XP
                        </div>
                        <div className="points-left">
                            Points: {stats.points}
                        </div>
                    </div>

                    {/* Skills list */}
                    <div className="skills">
                        {(
                            [
                                "strength",
                                "stamina",
                                "defense",
                                "healthlevel",
                                "gathering",
                            ] as UpgradeableStat[]
                        ).map((stat) => {
                            const statValue = valueFor(stat);
                            return (
                                <div className="skill-row" key={stat}>
                                    <div className="skill-name">
                                        {stat.toUpperCase()}
                                    </div>

                                    <div className="skill-bar-wrapper">
                                        <div
                                            className="skill-bar-fill"
                                            style={{
                                                width: `${
                                                    (statValue / 12) * 100
                                                }%`,
                                            }}
                                        >
                                            <span className="skill-bar-text">
                                                {statValue}
                                            </span>
                                        </div>
                                    </div>

                                    {stats.points > 0 && (
                                        <button
                                            onClick={() => handleUpgrade(stat)}
                                            className="upgrade-btn"
                                        >
                                            +
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Totals / counters */}
                    <div className="stats-breakdown">
                        <div className="stat-badge">🔪 {stats.kills} Kills</div>
                        <div className="stat-badge">
                            💀 {stats.deaths} Deaths
                        </div>
                        <div className="stat-badge">
                            ⚔️ {stats.punches} Punches Thrown
                        </div>
                        <div className="stat-badge">
                            🔥 {stats.damageGiven} Damage Dealt
                        </div>
                        <div className="stat-badge">
                            🛡️ {stats.damageReceived} Damage Received
                        </div>
                        <div className="stat-badge">📊 {kdRatio} K/D Ratio</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyProfileView;
