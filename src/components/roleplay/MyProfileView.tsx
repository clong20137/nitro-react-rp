import React, { FC, useRef, useState, useEffect } from "react";
import "./MyProfileView.scss";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { UpgradeStatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UpgradeStatComposer";

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
    hunger_level: number;
    gathering: number;
    username: string;
    figure: string;
    healthlevel: number;
    gangName?: string;
}

interface MyProfileViewProps {
    onClose: () => void;
    stats: StatsProps;
    onUpgrade: (stat: UpgradeableStat) => void;
}

type UpgradeableStat =
    | "strength"
    | "stamina"
    | "defense"
    | "healthlevel"
    | "gathering";

export const MyProfileView: FC<MyProfileViewProps> = ({
    onClose,
    stats,
    onUpgrade,
}) => {
    const [position] = useState<{ x: number; y: number }>(() => {
        const stored = localStorage.getItem("profilePos");
        return stored ? JSON.parse(stored) : { x: 100, y: 100 };
    });

    const kdRatio =
        stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : "∞";

    const posRef = useRef(position);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);
    const [xp, setXp] = useState<number>(0);
    const [maxXP, setMaxXP] = useState<number>(100);
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
    const handleUpgrade = (stat: UpgradeableStat) => {
        if (stats.points <= 0 || stats[stat] >= 12) return;

        // Send the packet to the server
        GetCommunication().connection.send(new UpgradeStatComposer(stat));
        console.log("Packet sent!!");

        // Let parent know (optional if server returns packet update)
        onUpgrade(stat);
    };
    const sendStatsUpgradePacket = (stat: string) => {
        //window.Nitro.send(new UpgradeStatComposer(stat)); // Replace with your actual packet
        GetCommunication().connection.send(new UpgradeStatComposer(stat));
    };
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
                <button className="close-btn" onClick={onClose}>
                    ✖
                </button>
            </div>

            <div className="profile-body">
                {/* Left Side */}
                <div className="profile-left">
                    <div className="avatar-section">
                        <img
                            className="profile-avatar"
                            src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${stats.figure}`}
                            alt="avatar"
                        />
                        <div className="username">{stats.username}</div>
                        <div className="status">Noob</div>
                    </div>

                    <div className="info-section">
                        <div>🧷 Not married</div>
                        <div className="job">Police Officer</div>
                        <div className="work-status red">Not working</div>
                        <div>🕒 90 weekly shifts</div>
                        <div>🧾 258 total shifts</div>
                        <div>{stats.gangName}</div>
                    </div>
                </div>

                {/* Right Side */}
                <div className="profile-right">
                    <div className="level-xp">
                        <div>Level: {stats.level}</div>
                        <div className="xp-bar">
                            <div
                                className="xp-fill"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        (stats.xp / stats.maxXP) * 100
                                    )}%`,
                                }}
                            />
                        </div>
                        <div className="xp-text">
                            {stats.xp} / {stats.maxXP} XP
                        </div>
                        <div className="points-left">
                            {stats.points} Point(s) left
                        </div>
                    </div>

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
                            // Dynamically get the right level key if it exists
                            const statValue =
                                stats[`${stat}`] ?? stats[stat];

                            return (
                                <div className="skill-row" key={stat}>
                                    <div className="skill-name">
                                        {stat.toUpperCase()}
                                    </div>

                                    {/* Progress bar */}
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

                                    {/* + Button */}
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
                    <div className="stats-breakdown">
                        <div className="stat-badge">🔪 {stats.kills} Kills</div>
                        <div className="stat-badge">💀 {stats.deaths} Deaths</div>
                        <div className="stat-badge">⚔️ {stats.punches} Punches Thrown</div>
                        <div className="stat-badge">🔥 {stats.damageGiven} Damage Dealt</div>
                        <div className="stat-badge">🛡️ {stats.damageReceived} Damage Received</div>
                        <div className="stat-badge">📊 {kdRatio} K/D Ratio</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
