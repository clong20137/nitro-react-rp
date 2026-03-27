import { FC, useEffect, useRef, useState, useLayoutEffect } from "react";
import {
    GetSessionDataManager,
    SendMessageComposer,
    GetUserProfile,
} from "../../api";
import "./StatsBar.scss";
import { XPGainPopup } from "./XPGainPopup";
import { MyProfileView } from "./MyProfileView";
import { StartWorkComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartWorkComposer";
import { CallPoliceComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CallPoliceComposer";
import { PassiveModeComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PassiveModeComposer";
import { MobileVitalsView } from "./MobileVitalsView";
import { OpponentStatsOverlay } from "./OpponentStatsOverlay";
import { FriendlyTime, UserProfileEvent } from "@nitrots/nitro-renderer";

import { useMessageEvent } from "../../hooks";

type AnchorEventDetail = { id: string; el: HTMLElement | null };
const OB_REGISTER_EVT = "ob-register-anchor";

function useOnboardingAnchor(
    id: string,
    ref: React.MutableRefObject<HTMLElement | null>
) {
    useLayoutEffect(() => {
        const fire = () =>
            window.dispatchEvent(
                new CustomEvent<AnchorEventDetail>(OB_REGISTER_EVT, {
                    detail: { id, el: ref.current },
                })
            );
        fire();
        window.addEventListener("resize", fire);
        return () => window.removeEventListener("resize", fire);
    }, [id, ref]);
}

interface ProfileStats {
    userId?: number;
    kills: number;
    deaths: number;
    punches: number;
    damageGiven: number;
    damageReceived: number;

    strength: number;
    stamina: number;
    defense: number;
    gathering: number;

    xp: number;
    maxXP: number;
    level: number;
    points: number;

    // Vital bars
    health: number;
    maxHealth: number;

    energy: number;
    maxEnergy: number;

    hunger: number;
    maxHunger: number;

    healthlevel: number;

    // Identity
    username: string;
    figure: string;
    motto?: string;
    isOnline?: boolean;

    // Employment / corporation
    jobTitle?: string;
    corporationName?: string;
    corporationIconUrl?: string;

    // Gang info
    gangName?: string;
    gangId?: number;
    gangIconKey?: string;
    gangPrimaryColor?: string;
    gangSecondaryColor?: string;

    // Profile meta
    createdAt?: string;
    lastLogin?: string;

    // allow opponent overrides
    [key: string]: any;
}

export const StatsBar: FC = () => {
    const [OpponentStats, setOpponentStats] = useState<any | null>(null);

    const [health, setHealth] = useState(0);
    const [maxHealth, setMaxHealth] = useState(100);
    const [passive, setPassive] = useState(false);

    const [energy, setEnergy] = useState(0);
    const [maxEnergy, setMaxEnergy] = useState(100);

    const [hunger, setHunger] = useState(0);
    const [maxHunger, setMaxHunger] = useState(100);

    // --- Aggression (animated) ---
    const aggressionInitialMsRef = useRef(0);
    const aggressionStartTsRef = useRef(0);
    const [aggressionWindowMs, setAggressionWindowMs] = useState(45_000);
    const [inTurfRoom, setInTurfRoom] = useState(false);
    const [isAggressive, setAggressive] = useState(false);

    // lightweight 60fps clock
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        let raf: number;
        const tick = () => {
            setNow(performance.now());
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const [strength, setStrength] = useState(0);
    const [stamina, setStaminaLevel] = useState(0);
    const [hunger_level, setHungerLevel] = useState(0);
    const [gathering, setGatheringLevel] = useState(0);

    const figure = GetSessionDataManager().figure;
    const username = GetSessionDataManager().userName;

    // —— gang + profile meta ——
    const [gangName, setGangName] = useState<string>();
    const [gangId, setGangId] = useState<number | undefined>(undefined);
    const [gangIconKey, setGangIconKey] = useState<string | undefined>(
        undefined
    );
    const [gangPrimaryColor, setGangPrimaryColor] = useState<
        string | undefined
    >(undefined);
    const [gangSecondaryColor, setGangSecondaryColor] = useState<
        string | undefined
    >(undefined);

    const [jobTitle, setJobTitle] = useState<string | undefined>(undefined);
    const [corporationName, setCorporationName] = useState<string | undefined>(
        undefined
    );
    const [corporationIconUrl, setCorporationIconUrl] = useState<
        string | undefined
    >(undefined);
    const [motto, setMotto] = useState<string | undefined>(undefined);
    const [isOnline, setIsOnline] = useState<boolean>(true);

    // created + last login for profile
    const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
    const [lastLogin, setLastLogin] = useState<string | undefined>(undefined);

    const [isWorking, setIsWorking] = useState(false);
    const [working, setWorking] = useState(false);

    const [xp, setXp] = useState(0);
    const [maxXP, setMaxXP] = useState(100);
    const [level, setLevel] = useState(0);
    const [points, setPoints] = useState(0);
    const [defense, setDefense] = useState(0);
    const [punches_thrown, setPunchesThrown] = useState(0);
    const [punches_landed, setPunchesLanded] = useState(0);
    const [damage_inflicted, setDamageInflicted] = useState(0);
    const [damage_received, setDamageReceived] = useState(0);
    const [shifts_worked, setShiftsWorked] = useState(0);
    const [kills, setKills] = useState(0);
    const [deaths, setDeaths] = useState(0);
    const [arrests, setArrests] = useState(0);
    const [lastXp, setLastXp] = useState(xp);
    const [xpGained, setXpGained] = useState<number | null>(null);
    const [showXPTooltip, setShowXPTooltip] = useState(false);
    const [healthlevel, setHealthLevel] = useState(0);
    const [cooldown, setCooldown] = useState(0);

    // central profile state (me OR opponent)
    const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
    const [showProfile, setShowProfile] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    useOnboardingAnchor("stats", containerRef);

    const togglePassive = () => {
        setPassive((prev) => {
            const next = !prev;
            SendMessageComposer(new PassiveModeComposer(next));
            return next;
        });
    };

    // —— XP toast tracking ——
    useEffect(() => {
        if (xp > lastXp) {
            setXpGained(xp - lastXp);
            setTimeout(() => setXpGained(null), 1500);
        }
        setLastXp(xp);
    }, [xp, lastXp]);

    const toggleWork = () => {
        SendMessageComposer(new StartWorkComposer(!working));
        setWorking(!working);
    };

    // ===== Listen to SERVER stat pushes =====
    useEffect(() => {
        const handleStatsUpdate = (event: Event) => {
            const { detail: stats } = event as CustomEvent<any>;
            if (!stats) return;

            setHealth(stats.health);
            setMaxHealth(stats.maxHealth);
            setEnergy(stats.energy);
            setMaxEnergy(stats.maxEnergy);
            setHunger(stats.hunger);
            setMaxHunger(stats.maxHunger);

            const incomingMs =
                typeof stats.aggressionMs === "number"
                    ? stats.aggressionMs
                    : typeof stats.aggression_ms === "number"
                    ? stats.aggression_ms
                    : typeof stats.aggression === "number"
                    ? stats.aggression
                    : 0;

            aggressionInitialMsRef.current = Math.max(0, incomingMs);
            aggressionStartTsRef.current = performance.now();

            if (
                typeof stats.aggressionWindowMs === "number" &&
                stats.aggressionWindowMs > 0
            ) {
                setAggressionWindowMs(stats.aggressionWindowMs);
            }

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
            setAggressive(!!stats.isAggressive);
            setIsWorking(!!stats.working);
            setGangName(stats.gangName);
            setJobTitle(stats.jobTitle);
            setCorporationName(stats.corporationName);
            // Convert icon key into URL (same as CorporationsView logic)
            if (stats.corporationIcon) {
                setCorporationIconUrl(
                    /^https?:\/\//i.test(stats.corporationIcon)
                        ? stats.corporationIcon
                        : `/icons/corporations/${stats.corporationIcon}`
                );
            } else setCorporationIconUrl("");
        };

        window.addEventListener("user_stats_update", handleStatsUpdate);
        return () =>
            window.removeEventListener("user_stats_update", handleStatsUpdate);
    }, []);

    // ===== Virtual room type (to detect Turf) =====
    useEffect(() => {
        const onVRoom = (e: any) => {
            const t = String(e?.detail?.type || "").toLowerCase();
            const isTurf = t.includes("turf");
            setInTurfRoom(isTurf);
            if (isTurf) {
                aggressionInitialMsRef.current = Math.max(
                    aggressionInitialMsRef.current,
                    aggressionWindowMs
                );
                aggressionStartTsRef.current = performance.now();
            }
        };
        window.addEventListener("virtual_room_info_update", onVRoom);
        return () =>
            window.removeEventListener("virtual_room_info_update", onVRoom);
    }, [aggressionWindowMs]);

    // ===== Opponent inspect hook =====
    useEffect(() => {
        const onOpp = (event: CustomEvent) => setOpponentStats(event.detail);
        window.addEventListener("user_inspect_stats", onOpp as EventListener);
        return () =>
            window.removeEventListener(
                "user_inspect_stats",
                onOpp as EventListener
            );
    }, []);

    const percent = (value: number, max: number) =>
        max <= 0
            ? 0
            : Math.max(0, Math.min(100, Math.round((value / max) * 100)));

    const elapsed = Math.max(0, now - aggressionStartTsRef.current);
    const remainingMs = inTurfRoom
        ? aggressionWindowMs
        : Math.max(0, aggressionInitialMsRef.current - elapsed);
    const aggressionPercent = percent(remainingMs, aggressionWindowMs);

    const buildSelfProfile = (): ProfileStats => ({
        userId: GetSessionDataManager().userId,
        kills,
        deaths,
        punches: punches_thrown,
        damageGiven: damage_inflicted,
        damageReceived: damage_received,
        strength,
        stamina,
        defense,
        gathering,

        xp,
        maxXP,
        level,
        points,

        health,
        maxHealth,
        energy,
        maxEnergy,
        hunger,
        maxHunger,
        healthlevel,

        username,
        figure,
        motto,

        gangName,
        gangId,
        gangIconKey,
        gangPrimaryColor,
        gangSecondaryColor,

        jobTitle,
        corporationName,
        corporationIconUrl,

        isOnline,
        createdAt,
        lastLogin,
    });

    useEffect(() => {
        const myId = GetSessionDataManager().userId;
        if (myId > 0) GetUserProfile(myId);
    }, []);

    useMessageEvent<UserProfileEvent>(UserProfileEvent, (event) => {
        const parser = event.getParser();
        if (!parser) return;

        const myId = GetSessionDataManager().userId;
        if (parser.id !== myId) return;

        // Created date is already a string (same as UserContainerView)
        const created: string = parser.registration ?? "Unknown";

        // Format last login using FriendlyTime (returns string)
        const last: string =
            FriendlyTime.format(parser.secondsSinceLastVisit ?? 0, ".ago", 2) ??
            "Unknown";

        // Update your local state (must be string | undefined)
        setCreatedAt(created);
        setLastLogin(last);
        setMotto(parser.motto);
        setIsOnline(parser.isOnline);
    });

    // Listen for opponent avatar click → open profile
    useEffect(() => {
        const onOpenOppProfile = (e: Event) => {
            const { detail } = e as CustomEvent<any>;
            if (!detail) return;

            setProfileStats({
                // sensible defaults (opponent payload may be sparse)
                userId: detail.userId,
                kills: 0,
                deaths: 0,
                punches: 0,
                damageGiven: 0,
                damageReceived: 0,
                strength: 0,
                stamina: 0,
                defense: 0,
                gathering: 0,
                xp: 0,
                maxXP: 1,
                level: 0,
                points: 0,
                username: detail.username || "",
                figure: detail.figure || "",
                motto: detail.motto,
                gangName: detail.gangName,
                gangId: detail.gangId,
                gangIconKey: detail.gangIconKey,
                gangPrimaryColor: detail.gangPrimaryColor,
                gangSecondaryColor: detail.gangSecondaryColor,
                jobTitle: detail.jobTitle,
                corporationName: detail.corporationName,
                corporationIconUrl: detail.corporationIconUrl,
                isOnline: detail.isOnline,
                createdAt: detail.createdAt,
                lastLogin: detail.lastLogin,
                ...detail,
            } as ProfileStats);
            setShowProfile(true);
        };

        window.addEventListener(
            "open_profile_from_inspect",
            onOpenOppProfile as EventListener
        );
        return () =>
            window.removeEventListener(
                "open_profile_from_inspect",
                onOpenOppProfile as EventListener
            );
    }, []);
return (
    <div ref={containerRef} className="stats-bar-container">
        <div className="stats-left">
            <div className="greek-circle">
                {xpGained && <XPGainPopup amount={xpGained} />}

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
                            setProfileStats(buildSelfProfile());
                            setShowProfile(true);
                        }}
                        onMouseEnter={() => setShowXPTooltip(true)}
                        onMouseLeave={() => setShowXPTooltip(false)}
                    >
                        <img
                            className="avatar-head"
                            src={`https://imager.olympusrp.pw/?figure=${figure}&direction=2&head_direction=2&gesture=sml`}
                            alt="Avatar"
                        />
                        {showXPTooltip && (
                            <div className="xp-tooltip">
                                XP: {xp} / {maxXP}
                            </div>
                        )}
                    </div>

                    <div className="level-badge">{level}</div>
                </div>
            </div>

            <div className="avatar-name-wrapper">
                <div className="avatar-name">{username}</div>
            </div>
        </div>

        <div className="stats-right">
            <div className="stat">
                <div className="icons heart" />
                <div className="bar health-bar">
                    <div
                        className="fill health"
                        style={{ width: `${percent(health, maxHealth)}%` }}
                    />
                    <div className="bar-value">
                        {health} / {maxHealth}
                    </div>
                </div>
            </div>

            <div className="stat">
                <div className="icons bolt" />
                <div className="bar energy-bar">
                    <div
                        className="fill energy"
                        style={{ width: `${percent(energy, maxEnergy)}%` }}
                    />
                    <div className="bar-value">
                        {energy} / {maxEnergy}
                    </div>
                </div>
            </div>

            <div className="stat">
                <div className="icons apple" />
                <div className="bar hunger-bar">
                    <div
                        className="fill hunger"
                        style={{ width: `${percent(hunger, maxHunger)}%` }}
                    />
                    <div className="bar-value">
                        {hunger} / {maxHunger}
                    </div>
                </div>
            </div>

            <div className="aggression-bar-wrapper">
                <div
                    className="aggression-fill"
                    style={{ width: `${aggressionPercent}%` }}
                />
            </div>
        </div>

        <MobileVitalsView />

        {showProfile && profileStats && (
            <MyProfileView
                onClose={() => setShowProfile(false)}
                isOnline={profileStats.isOnline ?? true}
                stats={profileStats}
                onUpgrade={(stat) => console.log("Upgrade stat:", stat)}
            />
        )}

        <OpponentStatsOverlay
            onClose={() =>
                window.dispatchEvent(new CustomEvent("user_inspect_clear"))
            }
        />
    </div>
);

    return (
        <div ref={containerRef} className="stats-bar-container">
            <div className="stats-left">
                <div className="greek-circle">
                    {xpGained && <XPGainPopup amount={xpGained} />}

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
                                setProfileStats(buildSelfProfile());
                                setShowProfile(true);
                            }}
                            onMouseEnter={() => setShowXPTooltip(true)}
                            onMouseLeave={() => setShowXPTooltip(false)}
                        >
                            <img
                                className="avatar-head"
                                src={`https://imager.olympusrp.pw/?figure=${figure}&direction=2&head_direction=2&gesture=sml`}
                                alt="Avatar"
                            />
                            {showXPTooltip && (
                                <div className="xp-tooltip">
                                    XP: {xp} / {maxXP}
                                </div>
                            )}
                        </div>

                        <div className="level-badge">{level}</div>
                    </div>
                </div>

                <div className="avatar-name-wrapper">
                    <div className="avatar-name">{username}</div>
                </div>
            </div>

            <div className="stats-right">
                <div className="stat">
                    <div className="icons heart" />
                    <div className="bar health-bar">
                        <div
                            className="fill health"
                            style={{ width: `${percent(health, maxHealth)}%` }}
                        />
                        <div className="bar-value">
                            {health} / {maxHealth}
                        </div>
                    </div>
                </div>

                <div className="stat">
                    <div className="icons bolt" />
                    <div className="bar energy-bar">
                        <div
                            className="fill energy"
                            style={{ width: `${percent(energy, maxEnergy)}%` }}
                        />
                        <div className="bar-value">
                            {energy} / {maxEnergy}
                        </div>
                    </div>
                </div>

                <div className="stat">
                    <div className="icons apple" />
                    <div className="bar hunger-bar">
                        <div
                            className="fill hunger"
                            style={{ width: `${percent(hunger, maxHunger)}%` }}
                        />
                        <div className="bar-value">
                            {hunger} / {maxHunger}
                        </div>
                    </div>
                </div>

                {/* Aggression bar */}
                <div className="aggression-bar-wrapper">
                    <div
                        className="aggression-fill"
                        style={{ width: `${aggressionPercent}%` }}
                    />
                </div>
            </div>

            {showProfile && profileStats && (
                <MyProfileView
                    onClose={() => setShowProfile(false)}
                    isOnline={profileStats.isOnline ?? true}
                    stats={profileStats}
                    onUpgrade={(stat) => console.log("Upgrade stat:", stat)}
                />
            )}

            <OpponentStatsOverlay
                onClose={() =>
                    window.dispatchEvent(new CustomEvent("user_inspect_clear"))
                }
            />
        </div>
    );
};

export default StatsBar;
