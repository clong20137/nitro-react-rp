import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { useEffect, useRef, useState } from "react";
import { GetNitroInstance, GetOwnRoomObject } from "../../api";
import { ObjectLocationView } from "../room/widgets/object-location/ObjectLocationView";
import "./MobileVitalsView.scss";

export const MobileVitalsView = () => {
const [objectId, setObjectId] = useState<number>(-1);
const [health, setHealth] = useState(0);
const [maxHealth, setMaxHealth] = useState(100);
const [energy, setEnergy] = useState(0);
const [maxEnergy, setMaxEnergy] = useState(100);
const [hunger, setHunger] = useState(0);
const [maxHunger, setMaxHunger] = useState(100);
const [isMobile, setIsMobile] = useState(false);

const objectIdRef = useRef(-1);
const visibleRef = useRef(false);

const percent = (value: number, max: number) =>
max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));

const resolveOwnObjectId = (): number => {
try {
const ownRoomObject = GetOwnRoomObject();

if(ownRoomObject && ownRoomObject.id >= 0) return ownRoomObject.id;
} catch {}

return -1;
};

useEffect(() => {
const updateMobile = () => {
setIsMobile(window.innerWidth <= 768);
};

updateMobile();
window.addEventListener("resize", updateMobile);

return () => window.removeEventListener("resize", updateMobile);
}, []);

useEffect(() => {
objectIdRef.current = objectId;
}, [objectId]);

useEffect(() => {
visibleRef.current = isMobile;
}, [isMobile]);

useEffect(() => {
const handleStatsUpdate = (event: Event) => {
const { detail: stats } = event as CustomEvent<any>;
if(!stats) return;

setHealth(Number(stats.health ?? 0));
setMaxHealth(Number(stats.maxHealth ?? 100));
setEnergy(Number(stats.energy ?? 0));
setMaxEnergy(Number(stats.maxEnergy ?? 100));
setHunger(Number(stats.hunger ?? 0));
setMaxHunger(Number(stats.maxHunger ?? 100));

const nextObjectId = resolveOwnObjectId();

if(nextObjectId >= 0 && nextObjectId !== objectIdRef.current) {
objectIdRef.current = nextObjectId;
setObjectId(nextObjectId);
}
};

const syncOwnAvatar = () => {
if(!visibleRef.current) return;

const nextObjectId = resolveOwnObjectId();

if(nextObjectId >= 0 && nextObjectId !== objectIdRef.current) {
objectIdRef.current = nextObjectId;
setObjectId(nextObjectId);
}
};

window.addEventListener("user_stats_update", handleStatsUpdate);
GetNitroInstance().ticker.add(syncOwnAvatar);

return () => {
window.removeEventListener("user_stats_update", handleStatsUpdate);
GetNitroInstance().ticker.remove(syncOwnAvatar);
};
}, []);

if(!isMobile || objectId < 0) return null;

return (
<ObjectLocationView objectId={objectId} category={RoomObjectCategory.UNIT}>
<div className="mobile-vitals">
<div className="mobile-vital health">
<div
className="mobile-vital-fill"
style={{ width: `${percent(health, maxHealth)}%` }}
/>
</div>

<div className="mobile-vital energy">
<div
className="mobile-vital-fill"
style={{ width: `${percent(energy, maxEnergy)}%` }}
/>
</div>

<div className="mobile-vital hunger">
<div
className="mobile-vital-fill"
style={{ width: `${percent(hunger, maxHunger)}%` }}
/>
</div>
</div>
</ObjectLocationView>
);
};

export default MobileVitalsView;
