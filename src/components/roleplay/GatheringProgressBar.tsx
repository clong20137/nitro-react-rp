import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { useEffect, useRef, useState } from "react";
import { GetNitroInstance, GetOwnRoomObject } from "../../api";
import { ObjectLocationView } from "../room/widgets/object-location/ObjectLocationView";
import "./GatherProgressView.scss";

interface GatherProgressDetail {
    durationMs?: number;
    duration?: number;
    icon?: string | null;
    name?: string;
    userId?: number;
}

export const GatheringProgressBar = () => {
    const [visible, setVisible] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);
    const [durationMs, setDurationMs] = useState(30000);
    const [label, setLabel] = useState("Gathering...");
    const [animKey, setAnimKey] = useState(0);
    const [remainingMs, setRemainingMs] = useState(0);
    const [objectId, setObjectId] = useState<number>(-1);

    const endAtRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopRAF = () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    const clearHideTimer = () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
    };

    const resolveOwnObjectId = (): number => {
        try {
            const ownRoomObject = GetOwnRoomObject();

            if (ownRoomObject && ownRoomObject.id >= 0) return ownRoomObject.id;
        } catch {}

        return -1;
    };

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const remain = Math.max(0, endAtRef.current - now);

            const nextObjectId = resolveOwnObjectId();

            if (nextObjectId >= 0 && nextObjectId !== objectId) {
                setObjectId(nextObjectId);
            }

            setRemainingMs(remain);

            if (remain > 0) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            setFadingOut(true);

            setTimeout(() => {
                setVisible(false);
                stopRAF();
            }, 200);
        };

        const handleStart = (e: Event) => {
            const detail = ((e as CustomEvent).detail ||
                {}) as GatherProgressDetail;
            const dur = Number(detail.durationMs ?? detail.duration);
            const nextObjectId = resolveOwnObjectId();

            if (!Number.isFinite(dur) || dur <= 0) return;
            if (nextObjectId < 0) return;

            clearHideTimer();
            stopRAF();

            setDurationMs(dur);
            setLabel(detail.name || "Gathering Item..");
            setObjectId(nextObjectId);
            setFadingOut(false);
            setVisible(true);

            requestAnimationFrame(() => {
                setAnimKey((k) => (k + 1) & 0xffff);
                endAtRef.current = performance.now() + dur;
                setRemainingMs(dur);
                rafRef.current = requestAnimationFrame(tick);
            });

            hideTimerRef.current = setTimeout(() => {
                setFadingOut(true);

                setTimeout(() => {
                    setVisible(false);
                    stopRAF();
                }, 200);
            }, dur);
        };

        const handleCancel = () => {
            clearHideTimer();
            stopRAF();
            setRemainingMs(0);
            setFadingOut(true);

            setTimeout(() => {
                setVisible(false);
            }, 200);
        };

        const syncOwnAvatar = () => {
            if (!visible) return;

            const nextObjectId = resolveOwnObjectId();

            if (nextObjectId >= 0 && nextObjectId !== objectId) {
                setObjectId(nextObjectId);
            }
        };

        window.addEventListener(
            "gather_progress",
            handleStart as EventListener,
        );
        window.addEventListener("gather_cancel", handleCancel);
        GetNitroInstance().ticker.add(syncOwnAvatar);

        return () => {
            window.removeEventListener(
                "gather_progress",
                handleStart as EventListener,
            );
            window.removeEventListener("gather_cancel", handleCancel);
            GetNitroInstance().ticker.remove(syncOwnAvatar);
            clearHideTimer();
            stopRAF();
        };
    }, [visible, objectId]);

    if (!visible || objectId < 0) return null;

    const seconds = Math.ceil((remainingMs + 100) / 1000);

    return (
        <ObjectLocationView
            key={animKey}
            objectId={objectId}
            category={RoomObjectCategory.UNIT}
        >
            <div
                className={`gather-avatar-bar ${fadingOut ? "fade-out" : "fade-in"}`}
            >
                <div className="gather-avatar-label">{label}</div>

                <div className="gather-avatar-track">
                    <div
                        className="gather-avatar-fill"
                        style={{ animationDuration: `${durationMs}ms` }}
                    />
                </div>

                <div className="gather-avatar-time">{seconds}s</div>
            </div>
        </ObjectLocationView>
    );
};
