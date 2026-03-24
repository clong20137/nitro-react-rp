import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { useEffect, useRef, useState } from "react";
import { GetNitroInstance, GetOwnRoomObject } from "../../api";
import { ObjectLocationView } from "../room/widgets/object-location/ObjectLocationView";
import "./CombatCooldownView.scss";

interface CombatCooldownDetail {
    weaponType?: number;
    totalMs?: number;
    remainingMs?: number;
}

export const CombatCooldownView = () => {
    const [visible, setVisible] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);
    const [durationMs, setDurationMs] = useState(3000);
    const [objectId, setObjectId] = useState<number>(-1);

    const rafRef = useRef<number | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const endAtRef = useRef(0);
    const objectIdRef = useRef(-1);
    const visibleRef = useRef(false);
    const cooldownTokenRef = useRef(0);

    const stopRAF = () => {
        if(rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    const clearHideTimer = () => {
        if(hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    const resolveOwnObjectId = (): number => {
        try {
            const ownRoomObject = GetOwnRoomObject();

            if(ownRoomObject && ownRoomObject.id >= 0) return ownRoomObject.id;
        } catch {}

        return -1;
    };

    const hardHide = () => {
        clearHideTimer();
        stopRAF();
        endAtRef.current = 0;
        visibleRef.current = false;
        setFadingOut(false);
        setVisible(false);
    };

    const softHide = (token: number) => {
        if(token !== cooldownTokenRef.current) return;

        clearHideTimer();
        stopRAF();
        visibleRef.current = false;
        setFadingOut(true);

        hideTimerRef.current = setTimeout(() => {
            if(token !== cooldownTokenRef.current) return;

            setVisible(false);
            setFadingOut(false);
            hideTimerRef.current = null;
        }, 150);
    };

    useEffect(() => {
        objectIdRef.current = objectId;
    }, [objectId]);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const remain = Math.max(0, endAtRef.current - now);
            const nextObjectId = resolveOwnObjectId();

            if(nextObjectId >= 0 && nextObjectId !== objectIdRef.current) {
                objectIdRef.current = nextObjectId;
                setObjectId(nextObjectId);
            }

            if(remain <= 0) {
                softHide(cooldownTokenRef.current);
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        const handleStart = (e: Event) => {
            const detail = ((e as CustomEvent).detail || {}) as CombatCooldownDetail;

            const total = Number(detail.totalMs ?? 0);
            const remaining = Number(detail.remainingMs ?? total);
            const nextObjectId = resolveOwnObjectId();

            if(!Number.isFinite(total) || total <= 0) {
                hardHide();
                return;
            }

            if(!Number.isFinite(remaining) || remaining <= 0) {
                hardHide();
                return;
            }

            if(nextObjectId < 0) return;

            cooldownTokenRef.current += 1;
            const token = cooldownTokenRef.current;

            clearHideTimer();
            stopRAF();

            objectIdRef.current = nextObjectId;
            setObjectId(nextObjectId);
            setDurationMs(total);
            setFadingOut(false);
            setVisible(true);
            visibleRef.current = true;

            requestAnimationFrame(() => {
                if(token !== cooldownTokenRef.current) return;

                endAtRef.current = performance.now() + remaining;
                rafRef.current = requestAnimationFrame(tick);
            });
        };

        const handleCancel = () => {
            cooldownTokenRef.current += 1;
            hardHide();
        };

        const syncOwnAvatar = () => {
            if(!visibleRef.current) return;

            const nextObjectId = resolveOwnObjectId();

            if(nextObjectId >= 0 && nextObjectId !== objectIdRef.current) {
                objectIdRef.current = nextObjectId;
                setObjectId(nextObjectId);
            }
        };

        window.addEventListener("combat_cooldown", handleStart as EventListener);
        window.addEventListener("combat_cooldown_cancel", handleCancel);
        GetNitroInstance().ticker.add(syncOwnAvatar);

        return () => {
            window.removeEventListener("combat_cooldown", handleStart as EventListener);
            window.removeEventListener("combat_cooldown_cancel", handleCancel);
            GetNitroInstance().ticker.remove(syncOwnAvatar);
            hardHide();
        };
    }, []);

    if(!visible || objectId < 0) return null;

    return (
        <ObjectLocationView
            objectId={objectId}
            category={RoomObjectCategory.UNIT}
        >
            <div className={`combat-cooldown-bar ${fadingOut ? "fade-out" : "fade-in"}`}>
                <div className="combat-cooldown-track">
                    <div
                        key={durationMs}
                        className="combat-cooldown-fill"
                        style={{
                            animationDuration: `${durationMs}ms`
                        }}
                    />
                </div>
            </div>
        </ObjectLocationView>
    );
};
