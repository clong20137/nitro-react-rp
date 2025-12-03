import React, { FC, useEffect, useRef, useState, useMemo } from "react";
import "./MyProfileView.scss";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { UpgradeStatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UpgradeStatComposer";
import { ProfileAchievementsRequestComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ProfileAchievementsRequestComposer";
import { FriendlyTime } from "@nitrots/nitro-renderer";

// ⬇️ NEW imports
import {
    UserCurrentBadgesComposer,
    UserCurrentBadgesEvent,
    UserProfileEvent,
} from "@nitrots/nitro-renderer";
import { GetSessionDataManager, GetUserProfile } from "../../api";
import { useMessageEvent } from "../../hooks";
import { BadgesContainerView } from "../user-profile/views/BadgesContainerView";
// ⬆️ NEW imports

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
    hunger: number;

    strength: number;
    stamina: number;
    defense: number;
    gathering: number;

    /** Server can send either casing; we normalize */
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

    // NEW: allow badges coming from props if you want
    badges?: string[];
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

    // grouping + ordering from server
    groupKey: string;
    groupOrder: number;
    levelOrder: number;
}

interface MyProfileViewProps {
    onClose: () => void;
    stats: StatsProps;
    onUpgrade: (stat: UpgradeableStat) => void;
    isOnline?: boolean; // optional override
    achievements?: AchievementRow[]; // kept in props for future, but NOT used to overwrite state
}

/* ------------------------------- Component -------------------------------- */

export const MyProfileView: FC<MyProfileViewProps> = ({
    onClose,
    stats,
    onUpgrade,
    isOnline = stats.isOnline ?? true,
    achievements, // currently unused for state, but left for future
}) => {
    // ----- local optimistic state (drives the bars immediately) -----
    const [uiStats, setUiStats] = useState(() => ({
        strength: stats.strength ?? 0,
        stamina: stats.stamina ?? 0,
        defense: stats.defense ?? 0,
        gathering: stats.gathering ?? 0,
        healthlevel: Number.isFinite(stats.healthlevel as number)
            ? Number(stats.healthlevel)
            : Number(stats.healthLevel ?? 0),
        points: stats.points ?? 0,
        xp: stats.xp ?? 0,
        maxXP: stats.maxXP ?? 100,
        level: stats.level ?? 1,
    }));

    // 🔹 local achievements state (what the UI will render)
    const [achRows, setAchRows] = useState<AchievementRow[]>([]);

    // 🔹 which group is expanded (accordion: one at a time)
    const [openGroup, setOpenGroup] = useState<string | null>(null);

    // 🔹 NEW: badges state for current user
    const [badges, setBadges] = useState<string[]>(stats.badges ?? []);

    // 🔹 NEW: local meta for created / last login
    const [meta, setMeta] = useState<{
        createdAt?: string;
        lastLogin?: string;
    }>({
        createdAt: stats.createdAt,
        lastLogin: stats.lastLogin,
    });

    // 🔹 Listen for achievements from the parser bridge
    useEffect(() => {
        const onAchievements = (ev: any) => {
            const rows = ev.detail?.achievements || [];
            console.log("[Profile] achievements update (view):", rows);
            setAchRows(rows);
        };

        window.addEventListener("profile_achievements_update", onAchievements);

        return () =>
            window.removeEventListener(
                "profile_achievements_update",
                onAchievements
            );
    }, []);

    // when server/parent stats props change, reconcile into optimistic state
    useEffect(() => {
        setUiStats((s) => ({
            ...s,
            strength: stats.strength ?? s.strength,
            stamina: stats.stamina ?? s.stamina,
            defense: stats.defense ?? s.defense,
            gathering: stats.gathering ?? s.gathering,
            healthlevel: Number.isFinite(stats.healthlevel as number)
                ? Number(stats.healthlevel)
                : Number(stats.healthLevel ?? s.healthlevel),
            points: stats.points ?? s.points,
            xp: stats.xp ?? s.xp,
            maxXP: stats.maxXP ?? s.maxXP,
            level: stats.level ?? s.level,
        }));
    }, [
        stats.strength,
        stats.stamina,
        stats.defense,
        stats.gathering,
        stats.healthlevel,
        stats.healthLevel,
        stats.points,
        stats.xp,
        stats.maxXP,
        stats.level,
    ]);

    // keep small cache in sync for other overlays
    useEffect(() => {
        setRPStats({
            gathering: uiStats.gathering ?? 1,
            level: uiStats.level ?? 1,
        });
    }, [uiStats.gathering, uiStats.level]);

    // 🔹 NEW: on mount, request profile + badges for current user
    useEffect(() => {
        const userId = GetSessionDataManager().userId;

        if (!userId) return;

        // This will fire UserProfileEvent, which contains creation & last login
        GetUserProfile(userId);

        // This will fire UserCurrentBadgesEvent with the user's badges
        try {
            GetCommunication().connection.send(
                new UserCurrentBadgesComposer(userId)
            );
        } catch (e) {
            console.error("Failed to send UserCurrentBadgesComposer", e);
        }
    }, []);

    // 🔹 NEW: listen for UserProfileEvent to fill createdAt / lastLogin
    useMessageEvent<UserProfileEvent>(UserProfileEvent, (event) => {
        const parser = event.getParser();
        if (!parser) return;

        const myId = GetSessionDataManager().userId;
        if (parser.id !== myId) return;

        setMeta({
            createdAt: parser.registration ?? "Unknown",
            lastLogin:
                FriendlyTime.format(
                    parser.secondsSinceLastVisit ?? 0,
                    ".ago",
                    2
                ) ?? "Unknown",
        });
    });
    // 🔹 NEW: listen for UserCurrentBadgesEvent to update badges
    useMessageEvent<UserCurrentBadgesEvent>(UserCurrentBadgesEvent, (event) => {
        const parser = event.getParser();
        const myId = GetSessionDataManager().userId;

        if (!myId || parser.userId !== myId) return;

        setBadges(parser.badges || []);
    });

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

    const valueFor = (name: UpgradeableStat) =>
        name === "healthlevel"
            ? uiStats.healthlevel
            : (uiStats as any)[name] ?? 0;

    const handleUpgrade = (stat: UpgradeableStat) => {
        if (uiStats.points <= 0) return;

        const currentVal = valueFor(stat);
        const isCapped = currentVal >= 12; // healthlevel uses same 0..12 scale

        if (isCapped) return;

        // optimistic bump (instant bar/points update)
        setUiStats((s) => ({
            ...s,
            [stat]: currentVal + 1,
            points: Math.max(0, s.points - 1),
        }));

        // send packet + notify parent
        GetCommunication().connection.send(new UpgradeStatComposer(stat));
        onUpgrade(stat);
    };

    // helpers
    const pct = (n: number, d: number) =>
        d <= 0 ? 0 : Math.min(100, Math.max(0, (n / d) * 100));

    /* -------------------- Group achievements by type (UI) -------------------- */

    const groupedAchievements = useMemo<
        Record<string, { order: number; rows: AchievementRow[] }>
    >(() => {
        const groups: Record<
            string,
            { order: number; rows: AchievementRow[] }
        > = {};

        for (const row of achRows) {
            const key = row.groupKey || "other";

            if (!groups[key]) {
                groups[key] = {
                    order: row.groupOrder ?? 0,
                    rows: [],
                };
            }

            groups[key].rows.push(row);
        }

        // sort rows inside each group by levelOrder
        Object.values(groups).forEach((g) => {
            g.rows.sort((a, b) => (a.levelOrder ?? 0) - (b.levelOrder ?? 0));
        });

        return groups;
    }, [achRows]);

    const sortedGroupNames = useMemo<string[]>(
        () =>
            Object.entries(groupedAchievements)
                .sort(([, ga], [, gb]) => (ga.order ?? 0) - (gb.order ?? 0))
                .map(([key]) => key),
        [groupedAchievements]
    );

    // when achievements / groups update, auto-open the first group if none is open
    useEffect(() => {
        if (sortedGroupNames.length && !openGroup) {
            setOpenGroup(sortedGroupNames[0]);
        }
    }, [sortedGroupNames, openGroup]);

    const handleToggleGroup = (groupName: string) => {
        // accordion behavior: only one open at a time
        setOpenGroup((prev) => (prev === groupName ? null : groupName));
    };

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
                    onClick={() => {
                        setTab("achievements");

                        // request achievements from server
                        try {
                            GetCommunication().connection.send(
                                new ProfileAchievementsRequestComposer()
                            );
                        } catch (e) {
                            console.error(
                                "Failed to send ProfileAchievementsRequestComposer",
                                e
                            );
                        }
                    }}
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
                                    src={`https://imager.olympusrp.pw/?figure=${stats.figure}`}
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

                                    {/* 🔹 Badges UNDER avatar, max 5 */}
                                    {badges && badges.length > 0 && (
                                        <div className="badge-strip">
                                            <BadgesContainerView
                                                fullWidth
                                                center
                                                badges={badges.slice(0, 5)}
                                            />
                                        </div>
                                    )}
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
                                    <b>{meta.createdAt ?? "Unknown"}</b>
                                </div>
                                <div>
                                    Last login:{" "}
                                    <b>{meta.lastLogin ?? "Unknown"}</b>
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
                                        <div
                                            style={{
                                                fontWeight: 700,
                                            }}
                                        >
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
                            <div>Level: {uiStats.level}</div>
                            <div className="xp-bar">
                                <div
                                    className="xp-fill"
                                    style={{
                                        width: `${pct(
                                            uiStats.xp,
                                            Math.max(1, uiStats.maxXP)
                                        )}%`,
                                    }}
                                />
                            </div>
                            <div className="xp-text">
                                {uiStats.xp} / {uiStats.maxXP} XP
                            </div>
                            <div className="points-left">
                                Points: {uiStats.points}
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
                                        {uiStats.points > 0 && (
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
                            <div className="stat-card stat-card--kills">
                                <div className="stat-icon" />
                                <div className="stat-text">
                                    <div className="stat-label">Kills</div>
                                    <div className="stat-value">
                                        {stats.kills}
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-card--deaths">
                                <div className="stat-icon" />
                                <div className="stat-text">
                                    <div className="stat-label">Deaths</div>
                                    <div className="stat-value">
                                        {stats.deaths}
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-card--punches">
                                <div className="stat-icon" />
                                <div className="stat-text">
                                    <div className="stat-label">
                                        Punches Thrown
                                    </div>
                                    <div className="stat-value">
                                        {stats.punches}
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-card--dmg-dealt">
                                <div className="stat-icon" />
                                <div className="stat-text">
                                    <div className="stat-label">
                                        Damage Dealt
                                    </div>
                                    <div className="stat-value">
                                        {stats.damageGiven}
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-card--dmg-taken">
                                <div className="stat-icon" />
                                <div className="stat-text">
                                    <div className="stat-label">
                                        Damage Received
                                    </div>
                                    <div className="stat-value">
                                        {stats.damageReceived}
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-card--kdr">
                                <div className="stat-icon" />
                                <div className="stat-text">
                                    <div className="stat-label">K/D Ratio</div>
                                    <div className="stat-value">
                                        {stats.deaths > 0
                                            ? (
                                                  stats.kills / stats.deaths
                                              ).toFixed(2)
                                            : "∞"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* --------------------------- ACHIEVEMENTS TAB --------------------------- */
                <div className="tab-content">
                    <div className="achievements-panel">
                        {achRows.length === 0 ? (
                            <div className="achievements-empty">
                                No achievements to show yet.
                            </div>
                        ) : (
                            <div className="achievements-list">
                                {sortedGroupNames.map((groupName) => {
                                    const group =
                                        groupedAchievements[groupName];
                                    if (!group) return null;

                                    const isOpen = openGroup === groupName;

                                    // Pretty display name for the group
                                    const prettyName =
                                        groupName === "kills"
                                            ? "Kills"
                                            : groupName === "deaths"
                                            ? "Deaths"
                                            : groupName === "punches"
                                            ? "Punches Thrown"
                                            : groupName === "damage"
                                            ? "Damage"
                                            : groupName === "gathering"
                                            ? "Gathering"
                                            : groupName === "pizza"
                                            ? "Pizzas Sold"
                                            : groupName === "mining"
                                            ? "Mining"
                                            : groupName
                                                  .charAt(0)
                                                  .toUpperCase() +
                                              groupName.slice(1);

                                    return (
                                        <div
                                            className={`ach-group ${
                                                isOpen ? "open" : "collapsed"
                                            }`}
                                            key={groupName}
                                        >
                                            <button
                                                className="ach-group-header"
                                                onClick={() =>
                                                    handleToggleGroup(groupName)
                                                }
                                            >
                                                <span className="ach-group-title">
                                                    {prettyName}
                                                </span>
                                                <span className="ach-group-arrow">
                                                    {isOpen ? "▲" : "▼"}
                                                </span>
                                            </button>

                                            {isOpen && (
                                                <div className="ach-group-grid">
                                                    {group.rows.map((a) => (
                                                        <div
                                                            className="ach-row"
                                                            key={a.id}
                                                        >
                                                            <img
                                                                className="ach-icon"
                                                                src={a.badgeUrl}
                                                                alt={a.name}
                                                                draggable={
                                                                    false
                                                                }
                                                            />

                                                            {/* title + reward */}
                                                            <div className="ach-line">
                                                                <div className="ach-title">
                                                                    {a.name}
                                                                </div>
                                                                <div className="ach-reward">
                                                                    +
                                                                    {a.xpReward}{" "}
                                                                    XP
                                                                </div>
                                                            </div>

                                                            {/* optional description */}
                                                            {a.description && (
                                                                <div className="ach-text">
                                                                    {
                                                                        a.description
                                                                    }
                                                                </div>
                                                            )}

                                                            {/* progress */}
                                                            <div className="ach-progress">
                                                                <div className="ach-bar">
                                                                    <div
                                                                        className="ach-fill"
                                                                        style={{
                                                                            width: `${
                                                                                a.target >
                                                                                0
                                                                                    ? Math.min(
                                                                                          100,
                                                                                          (a.current /
                                                                                              a.target) *
                                                                                              100
                                                                                      )
                                                                                    : 0
                                                                            }%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="ach-text">
                                                                    {a.current}/
                                                                    {a.target}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyProfileView;
