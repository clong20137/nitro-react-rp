import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    GetNitroInstance,
    GetRoomObjectBounds,
    GetRoomObjectScreenLocation,
    GetRoomSession,
    GetSessionDataManager,
} from "../../api";
import "./PassiveIndicatorOverlay.scss";

declare global {
    interface Window {
        __rpPassiveUsers?: Record<number, boolean>;
    }
}

interface PassiveIndicatorItem {
    userId: number;
    left: number;
    top: number;
}

const PASSIVE_KEYS = ["passive", "isPassive", "passiveMode", "passive_mode"] as const;

const readPassiveValue = (payload: any): boolean | null => {
    if (!payload || typeof payload !== "object") return null;

    for (const key of PASSIVE_KEYS) {
        if (typeof payload[key] === "boolean") return payload[key];
    }

    return null;
};

const readUserId = (payload: any): number => {
    const value = Number(payload?.userId ?? payload?.webID ?? payload?.id ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
};

export const PassiveIndicatorOverlay: FC = () => {
    const [version, setVersion] = useState(0);
    const [items, setItems] = useState<PassiveIndicatorItem[]>([]);

    const passiveUsers = useMemo(() => {
        if (!window.__rpPassiveUsers) window.__rpPassiveUsers = {};
        return window.__rpPassiveUsers;
    }, []);

    useEffect(() => {
        const syncPassive = (userId: number, passive: boolean | null | undefined) => {
            if (!userId || passive == null) return;

            if (passive) passiveUsers[userId] = true;
            else delete passiveUsers[userId];

            setVersion((value) => value + 1);
        };

        const onExplicitState = (event: Event) => {
            const detail = (event as CustomEvent<any>)?.detail;
            syncPassive(readUserId(detail), readPassiveValue(detail));
        };

        const onSelfStats = (event: Event) => {
            const detail = (event as CustomEvent<any>)?.detail;
            const passive = readPassiveValue(detail);

            if (passive == null) return;

            syncPassive(GetSessionDataManager().userId, passive);
        };

        const onInspectStats = (event: Event) => {
            const detail = (event as CustomEvent<any>)?.detail;
            syncPassive(readUserId(detail), readPassiveValue(detail));
        };

        const onRoomLeave = () => {
            const selfUserId = Number(GetSessionDataManager().userId || 0);
            const keepSelf = selfUserId > 0 && !!passiveUsers[selfUserId];
            window.__rpPassiveUsers = keepSelf ? { [selfUserId]: true } : {};
            setVersion((value) => value + 1);
        };

        window.addEventListener("rp_passive_state", onExplicitState as EventListener);
        window.addEventListener("user_stats", onSelfStats as EventListener);
        window.addEventListener("user_stats_update", onSelfStats as EventListener);
        window.addEventListener("user_inspect_stats", onInspectStats as EventListener);
        window.addEventListener("opponent_stats_update", onInspectStats as EventListener);
        window.addEventListener("open-opponent-stats", onInspectStats as EventListener);
        window.addEventListener("room_leave", onRoomLeave as EventListener);

        return () => {
            window.removeEventListener("rp_passive_state", onExplicitState as EventListener);
            window.removeEventListener("user_stats", onSelfStats as EventListener);
            window.removeEventListener("user_stats_update", onSelfStats as EventListener);
            window.removeEventListener("user_inspect_stats", onInspectStats as EventListener);
            window.removeEventListener("opponent_stats_update", onInspectStats as EventListener);
            window.removeEventListener("open-opponent-stats", onInspectStats as EventListener);
            window.removeEventListener("room_leave", onRoomLeave as EventListener);
        };
    }, [passiveUsers]);

    useEffect(() => {
        const update = () => {
            const roomSession = GetRoomSession();
            const activeEntries = Object.entries(window.__rpPassiveUsers || {}).filter(([, passive]) => !!passive);

            if (!roomSession || !activeEntries.length) {
                setItems((previous) => (previous.length ? [] : previous));
                return;
            }

            const nextItems: PassiveIndicatorItem[] = [];

            for (const [userIdKey] of activeEntries) {
                const userId = Number(userIdKey);
                if (!userId) continue;

                try {
                    const userData = roomSession.userDataManager?.getUserData?.(userId);
                    const roomIndex = Number(userData?.roomIndex ?? -1);
                    if (roomIndex < 0) continue;

                    const objectBounds = GetRoomObjectBounds(roomSession.roomId, roomIndex, RoomObjectCategory.UNIT, 1);
                    const screenLocation = GetRoomObjectScreenLocation(roomSession.roomId, roomIndex, RoomObjectCategory.UNIT, 1);

                    if (!objectBounds || !screenLocation || objectBounds.width <= 0 || objectBounds.height <= 0) continue;

                    const left = Math.round(screenLocation.x - 40);
                    const top = Math.round(screenLocation.y - objectBounds.height - 28);

                    nextItems.push({ userId, left, top });
                } catch {}
            }

            setItems((previous) => {
                if (previous.length !== nextItems.length) return nextItems;

                for (let index = 0; index < nextItems.length; index++) {
                    const a = previous[index];
                    const b = nextItems[index];

                    if (!a || a.userId !== b.userId || a.left !== b.left || a.top !== b.top) {
                        return nextItems;
                    }
                }

                return previous;
            });
        };

        update();
        GetNitroInstance().ticker.add(update);

        return () => {
            GetNitroInstance().ticker.remove(update);
        };
    }, [version]);

    if (!items.length) return null;

    return createPortal(
        <>
            {items.map((item) => (
                <div
                    key={item.userId}
                    className="rp-passive-indicator"
                    style={{ left: `${item.left}px`, top: `${item.top}px` }}
                >
                    <span className="rp-passive-indicator__icon">🛡</span>
                    <span className="rp-passive-indicator__label">PASSIVE</span>
                </div>
            ))}
        </>,
        document.body,
    );
};

export default PassiveIndicatorOverlay;
