import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { CSSProperties, FC, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    GetRoomObjectBounds,
    GetRoomObjectScreenLocation,
    GetRoomSession,
} from "../../api";
import "./DamageNumbersOverlay.scss";

type DamageEventDetail = {
    userId?: number;
    health?: number;
    maxHealth?: number;
};

type FloatingDamage = {
    id: number;
    value: number | string;
    left: number;
    top: number;
    style: CSSProperties;
    isKo?: boolean;
};

const MAX_POPUPS = 12;
const POPUP_LIFETIME_MS = 1150;

export const DamageNumbersOverlay: FC = () => {
    const [items, setItems] = useState<FloatingDamage[]>([]);
    const healthByUserRef = useRef<Map<number, number>>(new Map());
    const sequenceRef = useRef(0);

    useEffect(() => {
        const onStats = (event: Event) => {
            const detail = (event as CustomEvent<DamageEventDetail>)?.detail;

            if (!detail) return;

            const userId = Number(detail.userId || 0);
            const health = Number(detail.health);
            const maxHealth = Number(detail.maxHealth);

            if (!userId || !Number.isFinite(health)) return;

            let previousHealth = healthByUserRef.current.get(userId);

            if (previousHealth === undefined) {
                if (Number.isFinite(maxHealth) && maxHealth > 0) {
                    previousHealth = maxHealth;
                } else {
                    healthByUserRef.current.set(userId, health);
                    return;
                }
            }

            healthByUserRef.current.set(userId, health);

            const damage = Math.round(previousHealth - health);
            const isKo = health <= 0 && previousHealth > 0;

            if (damage <= 0 && !isKo) return;

            try {
                const roomSession = GetRoomSession();

                if (!roomSession) return;

                const userData = roomSession.userDataManager?.getUserData?.(userId);

                if (!userData || userData.roomIndex < 0) return;

                const roomIndex = userData.roomIndex;

                const bounds = GetRoomObjectBounds(
                    roomSession.roomId,
                    roomIndex,
                    RoomObjectCategory.UNIT,
                    1,
                );

                const loc = GetRoomObjectScreenLocation(
                    roomSession.roomId,
                    roomIndex,
                    RoomObjectCategory.UNIT,
                    1,
                );

                if (!bounds || !loc) return;

                const popupId = ++sequenceRef.current;
                const left = Math.round(loc.x + (popupId % 2 === 0 ? -10 : 12));
                const top = Math.round(
                    loc.y - Math.max(56, bounds.height * 0.78) - (popupId % 3) * 8,
                );

                const driftX = `${popupId % 2 === 0 ? -14 : 14}px`;
                const driftRotate = `${popupId % 2 === 0 ? -7 : 7}deg`;

                const nextItem: FloatingDamage = {
                    id: popupId,
                    value: isKo ? "K.O!" : damage,
                    left,
                    top,
                    isKo,
                    style: {
                        ["--damage-drift-x" as any]: driftX,
                        ["--damage-rotate" as any]: driftRotate,
                        animationDelay: `${Math.min(90, (popupId % 3) * 35)}ms`,
                    },
                };

                setItems((current) => [
                    ...current.slice(-(MAX_POPUPS - 1)),
                    nextItem,
                ]);

                window.setTimeout(() => {
                    setItems((current) =>
                        current.filter((item) => item.id !== popupId),
                    );
                }, POPUP_LIFETIME_MS);
            } catch {
                return;
            }
        };

        window.addEventListener("open-opponent-stats", onStats as EventListener);
        window.addEventListener("user_inspect_stats", onStats as EventListener);

        return () => {
            window.removeEventListener("open-opponent-stats", onStats as EventListener);
            window.removeEventListener("user_inspect_stats", onStats as EventListener);
        };
    }, []);

    if (!items.length) return null;

    return createPortal(
        <>
            {items.map((item) => (
                <div
                    key={item.id}
                    className={
                        item.isKo
                            ? "rp-damage-number rp-damage-number--ko"
                            : "rp-damage-number rp-damage-number--hit"
                    }
                    style={{
                        left: `${item.left}px`,
                        top: `${item.top}px`,
                        ...item.style,
                    }}
                >
                    <span className="rp-damage-number__text">{item.value}</span>
                </div>
            ))}
        </>,
        document.body,
    );
};

export default DamageNumbersOverlay;
