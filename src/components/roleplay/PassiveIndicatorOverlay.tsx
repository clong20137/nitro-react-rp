import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import {
    GetNitroInstance,
    GetRoomSession,
    GetSessionDataManager,
} from "../../api";
import { ObjectLocationView } from "../room/widgets/object-location/ObjectLocationView";
import passiveIcon from "../../icons/passive.png";
import "./PassiveIndicatorOverlay.scss";

declare global {
    interface Window {
        __rpPassiveUsers?: Record<number, boolean>;
    }
}

interface PassiveEntry {
    userId: number;
    objectId: number;
    visible: boolean;
    fadingOut: boolean;
}

const PASSIVE_KEYS = [
    "passive",
    "isPassive",
    "passiveMode",
    "passive_mode",
] as const;

const FADE_OUT_MS = 180;

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
    const [entries, setEntries] = useState<PassiveEntry[]>([]);
    const fadeTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
        new Map(),
    );

    const passiveUsers = useMemo(() => {
        if (!window.__rpPassiveUsers) window.__rpPassiveUsers = {};
        return window.__rpPassiveUsers;
    }, []);

    const clearFadeTimer = (userId: number) => {
        const timer = fadeTimersRef.current.get(userId);

        if (timer) {
            clearTimeout(timer);
            fadeTimersRef.current.delete(userId);
        }
    };

    const resolveObjectId = (userId: number): number => {
        try {
            const roomSession = GetRoomSession();

            if (!roomSession) return -1;

            const userData = roomSession.userDataManager?.getUserData?.(userId);
            const roomIndex = Number(userData?.roomIndex ?? -1);

            if (roomIndex < 0) return -1;

            return roomIndex;
        } catch {
            return -1;
        }
    };

    useEffect(() => {
        const syncPassive = (
            userId: number,
            passive: boolean | null | undefined,
        ) => {
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

        window.addEventListener(
            "rp_passive_state",
            onExplicitState as EventListener,
        );
        window.addEventListener("user_stats", onSelfStats as EventListener);
        window.addEventListener(
            "user_stats_update",
            onSelfStats as EventListener,
        );
        window.addEventListener(
            "user_inspect_stats",
            onInspectStats as EventListener,
        );
        window.addEventListener(
            "opponent_stats_update",
            onInspectStats as EventListener,
        );
        window.addEventListener(
            "open-opponent-stats",
            onInspectStats as EventListener,
        );
        window.addEventListener("room_leave", onRoomLeave as EventListener);

        return () => {
            window.removeEventListener(
                "rp_passive_state",
                onExplicitState as EventListener,
            );
            window.removeEventListener(
                "user_stats",
                onSelfStats as EventListener,
            );
            window.removeEventListener(
                "user_stats_update",
                onSelfStats as EventListener,
            );
            window.removeEventListener(
                "user_inspect_stats",
                onInspectStats as EventListener,
            );
            window.removeEventListener(
                "opponent_stats_update",
                onInspectStats as EventListener,
            );
            window.removeEventListener(
                "open-opponent-stats",
                onInspectStats as EventListener,
            );
            window.removeEventListener(
                "room_leave",
                onRoomLeave as EventListener,
            );
        };
    }, [passiveUsers]);

    useEffect(() => {
        const updateEntries = () => {
            const activeUserIds = new Set(
                Object.entries(window.__rpPassiveUsers || {})
                    .filter(([, passive]) => !!passive)
                    .map(([userId]) => Number(userId))
                    .filter((userId) => userId > 0),
            );

            setEntries((previous) => {
                const next: PassiveEntry[] = [];
                const seen = new Set<number>();

                for (const userId of activeUserIds) {
                    const objectId = resolveObjectId(userId);

                    if (objectId < 0) continue;

                    seen.add(userId);
                    clearFadeTimer(userId);

                    const existing = previous.find(
                        (entry) => entry.userId === userId,
                    );

                    next.push({
                        userId,
                        objectId,
                        visible: true,
                        fadingOut: false,
                    });

                    if (
                        existing &&
                        (existing.objectId !== objectId || existing.fadingOut)
                    ) {
                        next[next.length - 1] = {
                            ...next[next.length - 1],
                            objectId,
                        };
                    }
                }

                for (const entry of previous) {
                    if (seen.has(entry.userId)) continue;

                    if (entry.fadingOut) {
                        next.push(entry);
                        continue;
                    }

                    const fadingEntry: PassiveEntry = {
                        ...entry,
                        visible: true,
                        fadingOut: true,
                    };

                    next.push(fadingEntry);

                    if (!fadeTimersRef.current.has(entry.userId)) {
                        const timer = setTimeout(() => {
                            fadeTimersRef.current.delete(entry.userId);
                            setEntries((current) =>
                                current.filter(
                                    (item) => item.userId !== entry.userId,
                                ),
                            );
                        }, FADE_OUT_MS);

                        fadeTimersRef.current.set(entry.userId, timer);
                    }
                }

                return next;
            });
        };

        updateEntries();
        GetNitroInstance().ticker.add(updateEntries);

        return () => {
            GetNitroInstance().ticker.remove(updateEntries);

            for (const timer of fadeTimersRef.current.values()) {
                clearTimeout(timer);
            }

            fadeTimersRef.current.clear();
        };
    }, [version]);

    if (!entries.length) return null;

    return (
        <>
            {entries.map((entry) => (
                <ObjectLocationView
                    key={entry.userId}
                    objectId={entry.objectId}
                    category={RoomObjectCategory.UNIT}
                >
                    <div
                        className={`rp-passive-indicator ${entry.fadingOut ? "fade-out" : "fade-in"}`}
                    >
                        <img
                            className="rp-passive-indicator__image"
                            src={passiveIcon}
                            alt="Passive"
                        />
                    </div>
                </ObjectLocationView>
            ))}
        </>
    );
};

export default PassiveIndicatorOverlay;
