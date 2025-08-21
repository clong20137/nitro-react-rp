import { FC } from "react";
import "./StatsBar.scss"; // reuse the same stylesheet

export interface OpponentStats {
health: number; maxHealth: number;
energy: number; maxEnergy: number;
hunger: number; maxHunger: number;
aggression: number;
username: string;
figure: string;
xpPercent?: number;
level: number;
healthPercent?: number;
energyPercent?: number;
hungerPercent?: number;
}

const pct = (v: number, m: number) => (m <= 0 ? 0 : Math.round((v / m) * 100));

export const OpponentStatsBar: FC<{
data: OpponentStats;
onClose?: () => void;
}> = ({ data }) => {
if (!data) return null;

const aggressionSeconds = data.aggression / 1000;
const aggressionPercent = Math.min((aggressionSeconds / 30) * 100, 100);

return (
<div className="stats-bar-container opponent" data-testid="opponent-stats">
<div className="stats-left">
<div className="greek-circle">
<div className="greek-xp-ring">
<svg className="xp-ring-svg" viewBox="0 0 36 36">
<path className="xp-ring-background"
d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
<path className="xp-ring-progress"
strokeDasharray={`${data.xpPercent ?? 0}, 100`}
d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
</svg>

<div className="avatar-tooltip-wrapper">
<img
className="avatar-head"
src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${data.figure}&direction=4&head_direction=4&gesture=sml`}
alt={data.username}
/>
</div>

<div className="level-badge">{data.level ?? 0}</div>
</div>
</div>

<div className="avatar-name-wrapper">
<div className="avatar-name">{data.username}</div>
<div className="avatar-level">Level: {data.level ?? 0}</div>
</div>
</div>

<div className="stats-right">
<div className="stat">
<div className="icons heart" />
<div className="bar">
<div className="fill health" style={{ width: `${pct(data.health, data.maxHealth)}%` }} />
<div className="bar-text">{`${data.health} / ${data.maxHealth}`}</div>
</div>
</div>

<div className="stat">
<div className="icons bolt" />
<div className="bar">
<div className="fill energy" style={{ width: `${pct(data.energy, data.maxEnergy)}%` }} />
<div className="bar-text">{`${data.energy} / ${data.maxEnergy}`}</div>
</div>
</div>

<div className="stat">
<div className="icons apple" />
<div className="bar">
<div className="fill hunger" style={{ width: `${pct(data.hunger, data.maxHunger)}%` }} />
<div className="bar-text">{`${data.hunger} / ${data.maxHunger}`}</div>
</div>
</div>

<div className="aggression-bar-wrapper">
<div className="aggression-fill" style={{ width: `${aggressionPercent}%` }} />
</div>
</div>
</div>
);
};

export default OpponentStatsBar;
