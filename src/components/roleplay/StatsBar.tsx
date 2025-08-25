import { FC, useEffect, useState } from "react";
import { GetSessionDataManager } from "../../api";
import "./StatsBar.scss";
import { XPGainPopup } from "./XPGainPopup";
import { MyProfileView } from "./MyProfileView";
import { setDefaultResultOrder } from "dns";
import {
    AvatarImage,
    SetTargetedOfferStateComposer,
} from "@nitrots/nitro-renderer";
import { StartWorkComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartWorkComposer";
import { SendMessageComposer } from "../../api";
import { CallPoliceComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CallPoliceComposer";
import { PassiveModeComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PassiveModeComposer";
import { UpdateWorkStatusEvent } from "@nitrots/nitro-renderer/src/nitro/communication/messages/incoming/roleplay/UpdateWorkStatusEvent";
import { Nitro } from "@nitrots/nitro-renderer";
import { NitroEvent } from "@nitrots/nitro-renderer";


export const StatsBar: FC = () => {
    const [OpponentStats, setOpponentStats] = useState< | null>(
        null
    );

    // End //
    
    const [health, setHealth] = useState<number>(0);
    const [maxHealth, setMaxHealth] = useState<number>(100);
    const [passive, setPassive] = useState(false);

    const [energy, setEnergy] = useState<number>(0);
    const [maxEnergy, setMaxEnergy] = useState<number>(100);

    const [hunger, setHunger] = useState<number>(0);
    const [maxHunger, setMaxHunger] = useState<number>(100);

    const [aggression, setAggression] = useState<number>(0);
    const [strength, setStrength] = useState<number>(0);
    const [stamina, setStaminaLevel] = useState<number>(0);
    const [hunger_level, setHungerLevel] = useState<number>(0);
    const [gathering, setGatheringLevel] = useState<number>(0);
    const figure = GetSessionDataManager().figure;
    const username = GetSessionDataManager().userName;
    const [isAggressive, setAggressive] = useState<boolean>(false);
    const [gangName, setGangName] = useState<string>();

    const [showCallPoliceInput, setShowCallPoliceInput] = useState(false);
    const [callPoliceMessage, setCallPoliceMessage] = useState("");

    const aggressionSeconds = aggression / 1000;
    const aggressionPercent = Math.min((aggressionSeconds / 30) * 100, 100);
    const [isWorking, setIsWorking] = useState(false);
    const [xp, setXp] = useState<number>(0);
    const [maxXP, setMaxXP] = useState<number>(100);
    const [level, setLevel] = useState<number>(0);
    const [points, setPoints] = useState<number>(0);
    const [defense, setDefense] = useState<number>(0);
    const [punches_thrown, setPunchesThrown] = useState<number>(0);
    const [punches_landed, setPunchesLanded] = useState<number>(0);
    const [damage_inflicted, setDamageInflicted] = useState<number>(0);
    const [damage_received, setDamageReceived] = useState<number>(0);
    const [shifts_worked, setShiftsWorked] = useState<number>(0);
    const [kills, setKills] = useState<number>(0);
    const [deaths, setDeaths] = useState<number>(0);
    const [arrests, setArrests] = useState<number>(0);
    const [lastXp, setLastXp] = useState(xp);
    const [xpGained, setXpGained] = useState<number | null>(null);
    const [showXPTooltip, setShowXPTooltip] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [healthlevel, setHealthLevel] = useState<number>(0);
    const [cooldown, setCooldown] = useState(0);
    const [showCallInput, setShowCallInput] = useState(false);
    const [callMessage, setCallMessage] = useState("");

    const handleCloseOpponentStats = () => {
        setOpponentStats(null); // or however you're hiding it
    };

    const togglePassive = () => {
        setPassive((prev) => {
            const newState = !prev;
            SendMessageComposer(new PassiveModeComposer(newState));
            return newState;
        });
    };

    useEffect(() => {
        if (xp > lastXp) {
            setXpGained(xp - lastXp);
            setTimeout(() => setXpGained(null), 1500);
        }
        setLastXp(xp);
    }, [xp]);

    const [working, setWorking] = useState(false);

    const toggleWork = () => {
        SendMessageComposer(new StartWorkComposer(!working));
        setWorking(!working);
    };

    useEffect(() => {
        const handleStatsUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{
                health: number;
                maxHealth: number;
                energy: number;
                maxEnergy: number;
                hunger: number;
                maxHunger: number;
                aggression: number;
                xp: number;
                maxXP: number;
                strength: number;
                level: number;
                points: number;
                stamina: number;
                defense: number;
                hunger_level: number;
                gathering: number;
                punches_thrown: number;
                punches_landed: number;
                damage_inflicted: number;
                damage_received: number;
                shifts_worked: number;
                kills: number;
                deaths: number;
                arrests: number;
                healthlevel: number;
                isAggressive: boolean;
                working: boolean;
                gangName: string;
            }>;

            const stats = customEvent.detail;

            console.log("[📥] Stats received in listener:", stats);

            setHealth(stats.health);
            setMaxHealth(stats.maxHealth);

            setEnergy(stats.energy);
            setMaxEnergy(stats.maxEnergy);

            setHunger(stats.hunger);
            setMaxHunger(stats.maxHunger);

            setAggression(stats.aggression);
            setXp(stats.xp);
            setMaxXP(stats.maxXP);
            setStrength(stats.strength);
            setLevel(stats.level);
            setPoints(stats.points);
            setDefense(stats.defense);
            setStaminaLevel(stats.stamina);
            setHungerLevel(stats.hunger_level);
            setGatheringLevel(stats.gathering);
            setPunchesThrown(stats.punches_thrown);
            setPunchesLanded(stats.punches_landed);
            setDamageInflicted(stats.damage_inflicted);
            setDamageReceived(stats.damage_received);
            setShiftsWorked(stats.shifts_worked);
            setKills(stats.kills);
            setDeaths(stats.deaths);
            setArrests(stats.arrests);
            setHealthLevel(stats.healthlevel);
            setAggressive(stats.isAggressive);
            setWorking(stats.working);
            setGangName(stats.gangName);
        };
        window.addEventListener("user_stats_update", handleStatsUpdate);
        return () =>
            window.removeEventListener("user_stats_update", handleStatsUpdate);
    }, []);


    useEffect(() => {
        const handler = (e: CustomEvent) => {
            const isWorking = e.detail?.isWorking;
            setIsWorking(isWorking); // update your button label
        };

        window.addEventListener("work_status_update", handler as EventListener);

        return () =>
            window.removeEventListener(
                "work_status_update",
                handler as EventListener
            );
    }, []);
    const percent = (value: number, max: number) => {
        if (max === 0) return 0;
        return Math.round((value / max) * 100);
    };

    useEffect(() => {
        const handleOpponentStatsUpdate = (event: CustomEvent) => {
            const data = event.detail;
            setOpponentStats(data);
        };

        window.addEventListener(
            "user_inspect_stats",
            handleOpponentStatsUpdate as EventListener
        );

        return () => {
            window.removeEventListener(
                "user_inspect_stats",
                handleOpponentStatsUpdate as EventListener
            );
        };
    }, []);
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);
    const triggerPoliceCall = () => {
        if (cooldown > 0 || !callMessage.trim()) return;

        const username = GetSessionDataManager().userName;
        const avatar = GetSessionDataManager().figure;

        // Send packet to server
        SendMessageComposer(
            new CallPoliceComposer(username, avatar, callMessage.trim())
        );

        // Optional: Optimistically update local feed (if desired)
        // addLiveFeedMessage({ id: Date.now(), username, figure: avatar, text: '[911] ' + callMessage, isPoliceCall: true });

        setCallMessage("");
        setShowCallInput(false);
        setCooldown(30);
    };
    return (
        <div className="stats-bar-container">
            <div className="stats-left">
                <div
                    className="xp-bar-container"
                    style={{ position: "relative" }}
                >
                    <div
                        className="xp-bar-fill"
                        style={{ width: `${(xp / maxXP) * 100}%` }}
                    />
                    {xpGained && <XPGainPopup amount={xpGained} />}
                </div>
                <div className="greek-circle">
                    <div className="greek-xp-ring">
                        <svg className="xp-ring-svg" viewBox="0 0 36 36">
                            <path
                                className="xp-ring-background"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className="xp-ring-progress"
                                strokeDasharray={`${percent(xp, maxXP)}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>

                        <div
                            className="avatar-tooltip-wrapper"
                            onClick={() => {
                                console.log("Avatar clicked");
                                setShowProfile((prev) => !prev);
                            }}
                            onMouseEnter={() => setShowXPTooltip(true)}
                            onMouseLeave={() => setShowXPTooltip(false)}
                        >
                            <img
                                className="avatar-head"
                                src={`http://www.habbo.com/habbo-imaging/avatarimage?figure=${figure}&direction=2&head_direction=2&gesture=sml`}
                                alt="Avatar"
                            />
                            {showXPTooltip && (
                                <div className="xp-tooltip">
                                    XP: {xp} / {maxXP}
                                </div>
                            )}
                        </div>

                        <div className="level-badge">5</div>
                    </div>
                </div>
                <div className="avatar-name-wrapper">
                    <div className="avatar-name">{username}</div>
                    <div className="avatar-level">Level: {level}</div>
                </div>
            </div>

            <div className="stats-right">
                <div className="stat">
                    <div className="icons heart" />
                    <div className="bar">
                        <div
                            className="fill health"
                            style={{ width: `${percent(health, maxHealth)}%` }}
                        />
                        <div className="bar-text">{`${health} / ${maxHealth}`}</div>
                    </div>
                </div>

                <div className="stat">
                    <div className="icons bolt" />
                    <div className="bar">
                        <div
                            className="fill energy"
                            style={{ width: `${percent(energy, maxEnergy)}%` }}
                        />
                        <div className="bar-text">{`${energy} / ${maxEnergy}`}</div>
                    </div>
                </div>

                <div className="stat">
                    <div className="icons apple" />
                    <div className="bar">
                        <div
                            className="fill hunger"
                            style={{ width: `${percent(hunger, maxHunger)}%` }}
                        />
                        <div className="bar-text">{`${hunger} / ${maxHunger}`}</div>
                    </div>
                </div>

                <div className="aggression-bar-wrapper">
                    <div
                        className="aggression-fill"
                        style={{ width: `${aggressionPercent}%` }}
                    />
                </div>
                <div className="work-toggle-wrapper">
                    <button
                        className={`work-toggle-btn ${
                            isWorking ? "stop" : "start"
                        }`}
                        onClick={toggleWork}
                        disabled={isAggressive}
                    >
                        {working ? "CLOCK OUT" : "CLOCK IN"}
                    </button>
                    <button
                        className={`work-toggle-btn ${
                            passive ? "Aggressive" : "Passive"
                        }`}
                        onClick={togglePassive}
                    >
                        {passive ? "Passive" : "Aggressive"}
                    </button>
                    <div style={{ position: "relative" }}>
                        <div className="call-police-wrapper">
                            <button
                                className={`habbo-action-button red ${
                                    cooldown > 0 ? "disabled" : ""
                                }`}
                                onClick={() => setShowCallInput(!showCallInput)}
                                disabled={cooldown > 0}
                            >
                                {cooldown > 0 ? (
                                    <div className="cooldown-circle">
                                        <svg
                                            viewBox="0 0 36 36"
                                            className="cooldown-svg"
                                        >
                                            <path
                                                className="circle-bg"
                                                d="M18 2.0845
a 15.9155 15.9155 0 0 1 0 31.831
a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                            <path
                                                className="circle-progress"
                                                strokeDasharray={`${
                                                    (cooldown / 30) * 100
                                                }, 100`}
                                                d="M18 2.0845
a 15.9155 15.9155 0 0 1 0 31.831
a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                        </svg>
                                        <span className="cooldown-text">
                                            {cooldown}
                                        </span>
                                    </div>
                                ) : (
                                    "Call Police"
                                )}
                            </button>
                        </div>

                        {showCallInput && cooldown === 0 && (
                            <div className="call-police-input-box">
                                <div className="arrow-up" />
                                <textarea
                                    maxLength={200}
                                    placeholder="What's your emergency?"
                                    value={callMessage}
                                    onChange={(e) =>
                                        setCallMessage(e.target.value)
                                    }
                                />
                                <button
                                    onClick={triggerPoliceCall}
                                    className="habbo-action-button green"
                                >
                                    Send Call
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showProfile && (
                <MyProfileView
                    onClose={() => setShowProfile(false)}
                    stats={{
                        kills: kills,
                        deaths: deaths,
                        punches: punches_thrown,
                        damageGiven: damage_inflicted,
                        damageReceived: damage_received,
                        strength: strength,
                        stamina: stamina,
                        energy: 2,
                        hunger: 0,
                        xp: xp,
                        maxXP: maxXP,
                        level: level,
                        points: points,
                        defense: defense,
                        hunger_level: hunger_level,
                        gathering: gathering,
                        username: username,
                        figure: figure,
                        healthlevel: healthlevel,
                        gangName: gangName,
                    }}
                    onUpgrade={(stat) => {
                        console.log("Upgrade stat:", stat);
                        // Send a packet or trigger backend logic
                    }}
                />
            )}
        </div>
    );
};

export default StatsBar;
