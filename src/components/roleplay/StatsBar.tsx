import { FC, useEffect, useRef, useState } from "react";
import { GetSessionDataManager } from "../../api";
import "./StatsBar.scss";
import { XPGainPopup } from "./XPGainPopup";
import { MyProfileView } from "./MyProfileView";
import { StartWorkComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartWorkComposer";
import { SendMessageComposer } from "../../api";
import { CallPoliceComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CallPoliceComposer";
import { PassiveModeComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PassiveModeComposer";

/** ---- onboarding anchor hook (local copy) ---- */
import { MutableRefObject, useLayoutEffect } from "react";
type AnchorEventDetail = { id: string; el: HTMLElement | null };
const OB_REGISTER_EVT = "ob-register-anchor";
function useOnboardingAnchor(id: string, ref: MutableRefObject<HTMLElement | null>) {
useLayoutEffect(() => {
const el = ref.current;
if (!el) return;
window.dispatchEvent(new CustomEvent<AnchorEventDetail>(OB_REGISTER_EVT, { detail: { id, el } }));
const re = () =>
window.dispatchEvent(new CustomEvent<AnchorEventDetail>(OB_REGISTER_EVT, { detail: { id, el: ref.current } }));
window.addEventListener("resize", re);
return () => window.removeEventListener("resize", re);
}, [id, ref]);
}
/** ------------------------------------------- */

export const StatsBar: FC = () => {
const [OpponentStats, setOpponentStats] = useState<any | null>(null);

const [health, setHealth] = useState(0);
const [maxHealth, setMaxHealth] = useState(100);
const [passive, setPassive] = useState(false);

const [energy, setEnergy] = useState(0);
const [maxEnergy, setMaxEnergy] = useState(100);

const [hunger, setHunger] = useState(0);
const [maxHunger, setMaxHunger] = useState(100);

const [aggression, setAggression] = useState(0);
const [strength, setStrength] = useState(0);
const [stamina, setStaminaLevel] = useState(0);
const [hunger_level, setHungerLevel] = useState(0);
const [gathering, setGatheringLevel] = useState(0);
const figure = GetSessionDataManager().figure;
const username = GetSessionDataManager().userName;
const [isAggressive, setAggressive] = useState(false);

// —— gang + corp/profile meta we’ll pass to <MyProfileView> ——
const [gangName, setGangName] = useState<string>();
const [gangId, setGangId] = useState<number | undefined>(undefined);
const [gangIconKey, setGangIconKey] = useState<string | undefined>(undefined);
const [gangPrimaryColor, setGangPrimaryColor] = useState<string | undefined>(undefined);
const [gangSecondaryColor, setGangSecondaryColor] = useState<string | undefined>(undefined);

const [jobTitle, setJobTitle] = useState<string | undefined>(undefined);
const [corporationName, setCorporationName] = useState<string | undefined>(undefined);
const [corporationIconUrl, setCorporationIconUrl] = useState<string | undefined>(undefined);
const [motto, setMotto] = useState<string | undefined>(undefined);
const [isOnline, setIsOnline] = useState<boolean>(true);

const [showCallPoliceInput, setShowCallPoliceInput] = useState(false);
const [callPoliceMessage, setCallPoliceMessage] = useState("");

const aggressionSeconds = aggression / 1000;
const aggressionPercent = Math.min((aggressionSeconds / 30) * 100, 100);

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
const [showProfile, setShowProfile] = useState(false);
const [healthlevel, setHealthLevel] = useState(0);
const [cooldown, setCooldown] = useState(0);
const [showCallInput, setShowCallInput] = useState(false);
const [callMessage, setCallMessage] = useState("");

const containerRef = useRef<HTMLDivElement | null>(null);
useOnboardingAnchor('stats', containerRef); // <= register anchor for the guide

const togglePassive = () => {
setPassive((prev) => {
const next = !prev;
SendMessageComposer(new PassiveModeComposer(next));
return next;
});
};

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

useEffect(() => {
const handleStatsUpdate = (event: Event) => {
const customEvent = event as CustomEvent<any>;
const stats = customEvent.detail;

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
setIsWorking(stats.working);
setGangName(stats.gangName);
};
window.addEventListener("user_stats_update", handleStatsUpdate);
return () => window.removeEventListener("user_stats_update", handleStatsUpdate);
}, []);

useEffect(() => {
const onGangStatus = (ev: any) => {
const d = ev?.detail || {};
if (typeof d.gangName === "string") setGangName(d.gangName);
if (typeof d.gangId === "number") setGangId(d.gangId);

const norm = (v?: string) => !v ? undefined : v.startsWith("#") ? v.toUpperCase() : `#${String(v).toUpperCase()}`;
setGangPrimaryColor(norm(d.primaryColor));
setGangSecondaryColor(norm(d.secondaryColor));

let key = (d.iconKey ?? d.icon ?? "").toString().trim();
if (!key && typeof d.iconUrl === "string") {
const m = d.iconUrl.match(/\/([A-Z0-9]+)\.(gif|png)$/i);
if (m) key = m[1];
}
if (key) setGangIconKey(key.toUpperCase());
};
window.addEventListener("gang_status_result", onGangStatus);
return () => window.removeEventListener("gang_status_result", onGangStatus);
}, []);

useEffect(() => {
const onProfileMeta = (ev: any) => {
const d = ev?.detail || {};
if (typeof d.motto === "string") setMotto(d.motto);
if (typeof d.jobTitle === "string") setJobTitle(d.jobTitle);
if (typeof d.corporationName === "string") setCorporationName(d.corporationName);
if (typeof d.corporationIconUrl === "string") setCorporationIconUrl(d.corporationIconUrl);
if (typeof d.isOnline === "boolean") setIsOnline(d.isOnline);
};
window.addEventListener("user_profile_meta", onProfileMeta);
window.addEventListener("job_status_result", onProfileMeta);
return () => {
window.removeEventListener("user_profile_meta", onProfileMeta);
window.removeEventListener("job_status_result", onProfileMeta);
};
}, []);

const percent = (value: number, max: number) => (max === 0 ? 0 : Math.round((value / max) * 100));

useEffect(() => {
const handleOpponentStatsUpdate = (event: CustomEvent) => setOpponentStats(event.detail);
window.addEventListener("user_inspect_stats", handleOpponentStatsUpdate as EventListener);
return () => window.removeEventListener("user_inspect_stats", handleOpponentStatsUpdate as EventListener);
}, []);

useEffect(() => {
if (cooldown > 0) {
const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
return () => clearTimeout(timer);
}
}, [cooldown]);

const triggerPoliceCall = () => {
if (cooldown > 0 || !callMessage.trim()) return;
const u = GetSessionDataManager().userName;
const a = GetSessionDataManager().figure;
SendMessageComposer(new CallPoliceComposer(u, a, callMessage.trim()));
setCallMessage("");
setShowCallInput(false);
setCooldown(30);
};

return (
<div ref={containerRef} className="stats-bar-container">
<div className="stats-left">
<div className="xp-bar-container" style={{ position: "relative" }}>
<div className="xp-bar-fill" style={{ width: `${(xp / maxXP) * 100}%` }} />
{xpGained && <XPGainPopup amount={xpGained} />}
</div>

<div className="greek-circle">
<div className="greek-xp-ring">
<svg className="xp-ring-svg" viewBox="0 0 36 36">
<path className="xp-ring-background" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
<path className="xp-ring-progress" strokeDasharray={`${percent(xp, maxXP)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
</svg>

<div
className="avatar-tooltip-wrapper"
onClick={() => setShowProfile((p) => !p)}
onMouseEnter={() => setShowXPTooltip(true)}
onMouseLeave={() => setShowXPTooltip(false)}
>
<img
className="avatar-head"
src={`http://www.habbo.com/habbo-imaging/avatarimage?figure=${figure}&direction=2&head_direction=2&gesture=sml`}
alt="Avatar"
/>
{showXPTooltip && <div className="xp-tooltip">XP: {xp} / {maxXP}</div>}
</div>

<div className="level-badge">{level}</div>
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
<div className="fill health" style={{ width: `${percent(health, maxHealth)}%` }} />
<div className="bar-text">{`${(health)} / ${maxHealth}`}</div>
</div>
</div>

<div className="stat">
<div className="icons bolt" />
<div className="bar">
<div className="fill energy" style={{ width: `${percent(energy, maxEnergy)}%` }} />
<div className="bar-text">{`${energy} / ${maxEnergy}`}</div>
</div>
</div>

<div className="stat">
<div className="icons apple" />
<div className="bar">
<div className="fill hunger" style={{ width: `${percent(hunger, maxHunger)}%` }} />
<div className="bar-text">{`${hunger} / ${maxHunger}`}</div>
</div>
</div>

<div className="aggression-bar-wrapper">
<div className="aggression-fill" style={{ width: `${aggressionPercent}%` }} />
</div>
</div>

{showProfile && (
<MyProfileView
onClose={() => setShowProfile(false)}
isOnline={isOnline}
stats={{
kills,
deaths,
punches: punches_thrown,
damageGiven: damage_inflicted,
damageReceived: damage_received,
strength,
stamina,
energy: 2,
hunger: 0,
xp,
maxXP,
level,
points,
defense,
hungerLevel: hunger_level,
gathering,
username,
figure,
healthlevel,
gangName,
gangId,
gangIconKey: gangIconKey,
gangPrimaryColor,
gangSecondaryColor,
motto,
jobTitle,
corporationName,
corporationIconUrl,
isOnline,
}}
onUpgrade={(stat) => console.log("Upgrade stat:", stat)}
/>
)}
</div>
);
};

export default StatsBar;
