import React, { FC, useEffect, useRef, useState } from "react";
import "./MyProfileView.scss";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { UpgradeStatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UpgradeStatComposer";
import { setRPStats } from "./rpStatsCache";

/* --------------------------------- Types --------------------------------- */

interface RelationshipCounts {
    love?: number;
    like?: number;
    hate?: number;
}

interface StatsProps {
    kills: number;
    deaths: number;
    punches: number;
    damageGiven: number;
    damageReceived: number;
    energy: number;
    hunger:number;

    strength: number;
    stamina: number;
    defense: number;
    gathering: number;

    /** Server can send either casing; we normalize below */
    healthlevel?: number;
    healthLevel?: number;

    xp: number;
    maxXP: number;
    level: number;
    points: number;

    username: string;
    figure: string;
    motto?: string;

    // Employment/corp
    jobTitle?: string;
    corporationName?: string;
    corporationIconUrl?: string;

    // Presence
    isOnline?: boolean;

    // Gang visuals
    gangName?: string;
    gangId?: number;
    gangIconKey?: string;
    gangPrimaryColor?: string; // "FF0000" or "#FF0000"
    gangSecondaryColor?: string; // "00FF00" or "#00FF00"

    // Extras for left column
    createdAt?: string; // e.g., "10-11-2025"
    lastLogin?: string; // e.g., "3 minutes ago"
    relationships?: RelationshipCounts;
}

type UpgradeableStat =
    | "strength"
    | "stamina"
    | "defense"
    | "healthlevel"
    | "gathering";

export interface AchievementRow {
    id: number;
    key: string;
    name: string;
    current: number;
    target: number;
    xpReward: number;
    badgeUrl: string;
    description?: string;
}

interface MyProfileViewProps {
    onClose: () => void;
    stats: StatsProps;
    onUpgrade: (stat: UpgradeableStat) => void;
    isOnline?: boolean; // optional override
    achievements?: AchievementRow[];
}

/* ------------------------------- Component -------------------------------- */

export const MyProfileView: FC<MyProfileViewProps> = ({
    onClose,
    stats,
    onUpgrade,
    isOnline = stats.isOnline ?? true,
    achievements = [],
}) => {
    // normalize health level (read either casing)
    const resolvedHealthlevel: number = Number.isFinite(
        stats.healthlevel as number
    )
        ? Number(stats.healthlevel)
        : Number(stats.healthLevel ?? 0);

    // initial window position (persisted)
    const [position] = useState<{ x: number; y: number }>(() => {
        const stored = localStorage.getItem("profilePos");
        return stored ? JSON.parse(stored) : { x: 100, y: 100 };
    });

    const kdRatio =
        stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : "∞";

    const posRef = useRef(position);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    // tabs
    const [tab, setTab] = useState<"general" | "achievements">("general");

    // gang visual state (updates live from gang_status_result)
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

    // keep small cache in sync for other overlays
    useEffect(() => {
        setRPStats({
            gathering: stats.gathering ?? 1,
            level: stats.level ?? 1,
        });
    }, [stats.gathering, stats.level]);

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

        const capped = [
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

        if ((capped as readonly string[]).includes(stat) && currentVal >= 12)
            return;

        GetCommunication().connection.send(new UpgradeStatComposer(stat));
        onUpgrade(stat);
    };

    // helper readers
    const valueFor = (name: UpgradeableStat) =>
        name === "healthlevel"
            ? resolvedHealthlevel
            : (stats as any)[name] ?? 0;

    const pct = (n: number, d: number) =>
        d <= 0 ? 0 : Math.min(100, Math.max(0, (n / d) * 100));

    /* ----------------------------------- UI ----------------------------------- */

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
                <div className="title">User Profile</div>
                <button
                    className="close-button"
                    onClick={onClose}
                    aria-label="Close"
                />
            </div>

            {/* Tabs (Navigator look) */}
            <div className="profile-tabs">
                <button
                    className={`tab-btn ${tab === "general" ? "active" : ""}`}
                    onClick={() => setTab("general")}
                >
                    General
                </button>
                <button
                    className={`tab-btn ${
                        tab === "achievements" ? "active" : ""
                    }`}
                    onClick={() => setTab("achievements")}
                >
                    Achievements
                </button>
            </div>

            {tab === "general" ? (
                <div className="profile-body">
                    {/* LEFT COLUMN */}
                    <div className="profile-left">
                        <div className="avatar-section">
                            <div className="avatar-frame">
                                <img
                                    className="profile-avatar"
                                    src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${stats.figure}`}
                                    alt="avatar"
                                    draggable={false}
                                />
                                <div className="avatar-meta">
                                    <div className="username">
                                        {stats.username}
                                    </div>

                                    <div
                                        className={`online-pill ${
                                            isOnline ? "on" : "off"
                                        }`}
                                    >
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 999,
                                                background: isOnline
                                                    ? "#22c55e"
                                                    : "#ef4444",
                                                display: "inline-block",
                                            }}
                                        />
                                        {isOnline ? "Online" : "Offline"}
                                    </div>

                                    {!!stats.motto && (
                                        <div className="motto">
                                            “{stats.motto}”
                                        </div>
                                    )}

                                    {/* Gang pill (split color box + icon + name) */}
                                    <div
                                        className="gang-pill"
                                        style={{ marginTop: 2 }}
                                    >
                                        <span className="gang-color-split">
                                            <span
                                                className="half left"
                                                style={{
                                                    backgroundColor:
                                                        primaryColor,
                                                }}
                                            />
                                            <span
                                                className="half right"
                                                style={{
                                                    backgroundColor:
                                                        secondaryColor,
                                                }}
                                            />
                                        </span>
                                        {gangIconSrc && (
                                            <img
                                                className="gang-icon"
                                                src={gangIconSrc}
                                                alt="gang"
                                                draggable={false}
                                            />
                                        )}
                                        <span>{gangName || "No gang"}</span>
                                        {typeof gangId === "number" && (
                                            <span style={{ opacity: 0.6 }}>
                                                (#{gangId})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* left-side cards stack */}
                        <div className="info-section">
                            {/* Account */}
                            <div className="info-card">
                                <h5>Account</h5>
                                <div>
                                    Created:{" "}
                                    <b>{stats.createdAt ?? "Unknown"}</b>
                                </div>
                                <div>
                                    Last login:{" "}
                                    <b>{stats.lastLogin ?? "Unknown"}</b>
                                </div>
                            </div>

                            {/* Relationship Status */}
                            <div className="info-card">
                                <h5>Relationship Status</h5>
                                <div className="rel-grid">
                                    <div className="rel-row">
                                        <span className="label">❤ Love</span>
                                        <span>
                                            <b>
                                                {stats.relationships?.love ?? 0}
                                            </b>{" "}
                                            <span className="cta">
                                                Add friends
                                            </span>
                                        </span>
                                    </div>
                                    <div className="rel-row">
                                        <span className="label">🙂 Like</span>
                                        <span>
                                            <b>
                                                {stats.relationships?.like ?? 0}
                                            </b>{" "}
                                            <span className="cta">
                                                Add friends
                                            </span>
                                        </span>
                                    </div>
                                    <div className="rel-row">
                                        <span className="label">☹ Hate</span>
                                        <span>
                                            <b>
                                                {stats.relationships?.hate ?? 0}
                                            </b>{" "}
                                            <span className="cta">
                                                Add friends
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Employment */}
                            <div className="info-card">
                                <h5>Employment</h5>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    {stats.corporationIconUrl && (
                                        <img
                                            src={stats.corporationIconUrl}
                                            alt="corp"
                                            width={22}
                                            height={22}
                                        />
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 700 }}>
                                            {stats.jobTitle || "Unemployed"}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                opacity: 0.7,
                                            }}
                                        >
                                            {stats.corporationName ||
                                                "No corporation"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
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
                                            (stats.xp /
                                                Math.max(1, stats.maxXP)) *
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

                        {/* Skills */}
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
                                                onClick={() =>
                                                    handleUpgrade(stat)
                                                }
                                                className="upgrade-btn"
                                            >
                                                +
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Totals */}
                        <div className="stats-breakdown">
                            <div className="stat-badge">
                                🔪 {stats.kills} Kills
                            </div>
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
                            <div className="stat-badge">
                                📊 {kdRatio} K/D Ratio
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* --------------------------- ACHIEVEMENTS TAB --------------------------- */
                <div className="tab-content">
                    <div className="achievements-panel">
                        {achievements.length === 0 ? (
                            <div className="achievements-empty">
                                No achievements to show yet.
                            </div>
                        ) : (
                            <div className="achievements-list">
                                {achievements.map((a) => (
                                    <div className="ach-row" key={a.id}>
                                        <img
                                            className="ach-icon"
                                            src={a.badgeUrl}
                                            alt={a.name}
                                            draggable={false}
                                        />
                                        {/* title + reward */}
                                        <div className="ach-line">
                                            <div className="ach-title">
                                                {a.name}
                                            </div>
                                            <div className="ach-reward">
                                                +{a.xpReward} XP
                                            </div>
                                        </div>

                                        {/* optional description */}
                                        {a.description && (
                                            <div className="ach-text">
                                                {a.description}
                                            </div>
                                        )}

                                        {/* progress */}
                                        <div className="ach-progress">
                                            <div className="ach-bar">
                                                <div
                                                    className="ach-fill"
                                                    style={{
                                                        width: `${pct(
                                                            a.current,
                                                            a.target
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                            <div className="ach-text">
                                                {a.current}/{a.target}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyProfileView;
