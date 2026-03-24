import { RoomObjectCategory } from '@nitrots/nitro-renderer';
import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    GetNitroInstance,
    GetRoomObjectBounds,
    GetRoomObjectScreenLocation,
    GetRoomSession,
} from '../../api';
import './DamageNumbersOverlay.scss';

type DamageEventDetail = {
    userId?: number;
    health?: number;
    maxHealth?: number;
};

type FloatingDamage = {
    id: number;
    value: number;
    left: number;
    top: number;
    style: CSSProperties;
};

const MAX_POPUPS = 6;
const POPUP_LIFETIME_MS = 1150;

export const DamageNumbersOverlay: FC = () => {
    const [trackedUserId, setTrackedUserId] = useState<number>(0);
    const [trackedHealth, setTrackedHealth] = useState<number | null>(null);
    const [items, setItems] = useState<FloatingDamage[]>([]);
    const trackedUserIdRef = useRef(0);
    const trackedHealthRef = useRef<number | null>(null);
    const sequenceRef = useRef(0);

    useEffect(() => {
        trackedUserIdRef.current = trackedUserId;
    }, [trackedUserId]);

    useEffect(() => {
        trackedHealthRef.current = trackedHealth;
    }, [trackedHealth]);

    useEffect(() => {
        const syncTrackedTarget = (event?: Event) => {
            const detailUserId = (event as CustomEvent<{ userId?: number }>)?.detail?.userId;
            const nextUserId = Number(detailUserId || (window as any).__rpTargetUserId || 0);

            trackedUserIdRef.current = nextUserId > 0 ? nextUserId : 0;
            trackedHealthRef.current = null;
            setTrackedUserId(trackedUserIdRef.current);
            setTrackedHealth(null);
            setItems([]);
        };

        syncTrackedTarget();

        window.addEventListener('rp_target_changed', syncTrackedTarget as EventListener);
        window.addEventListener('opponent_target_set', syncTrackedTarget as EventListener);
        window.addEventListener('opponent_target_clear', syncTrackedTarget as EventListener);
        window.addEventListener('user_inspect_clear', syncTrackedTarget as EventListener);

        return () => {
            window.removeEventListener('rp_target_changed', syncTrackedTarget as EventListener);
            window.removeEventListener('opponent_target_set', syncTrackedTarget as EventListener);
            window.removeEventListener('opponent_target_clear', syncTrackedTarget as EventListener);
            window.removeEventListener('user_inspect_clear', syncTrackedTarget as EventListener);
        };
    }, []);

    const roomIndex = useMemo(() => {
        if (trackedUserId <= 0) return -1;

        try {
            const roomSession = GetRoomSession();
            const userData = roomSession?.userDataManager?.getUserData?.(trackedUserId);

            if (userData?.roomIndex >= 0) return userData.roomIndex;
        } catch {}

        return -1;
    }, [trackedUserId]);

    useEffect(() => {
        const onStats = (event: Event) => {
            const detail = (event as CustomEvent<DamageEventDetail>)?.detail;
            if (!detail) return;

            const userId = Number(detail.userId || 0);
            const health = Number(detail.health);

            if (!userId || !Number.isFinite(health)) return;
            if (trackedUserIdRef.current <= 0 || userId !== trackedUserIdRef.current) return;

            const previousHealth = trackedHealthRef.current;

            trackedHealthRef.current = health;
            setTrackedHealth(health);

            if (previousHealth === null) return;

            const damage = Math.max(0, Math.round(previousHealth - health));
            if (damage <= 0) return;

            try {
                const roomSession = GetRoomSession();
                if (!roomSession || roomIndex < 0) return;

                const bounds = GetRoomObjectBounds(roomSession.roomId, roomIndex, RoomObjectCategory.UNIT, 1);
                const loc = GetRoomObjectScreenLocation(roomSession.roomId, roomIndex, RoomObjectCategory.UNIT, 1);

                if (!bounds || !loc) return;

                const left = Math.round(loc.x + ((sequenceRef.current % 2 === 0) ? -10 : 12));
                const top = Math.round(loc.y - Math.max(56, bounds.height * 0.78) - ((sequenceRef.current % 3) * 8));
                const driftX = `${((sequenceRef.current % 2 === 0) ? -14 : 14)}px`;
                const driftRotate = `${((sequenceRef.current % 2 === 0) ? -7 : 7)}deg`;
                const id = window.setTimeout(() => {
                    setItems(current => current.filter(item => item.id !== popupId));
                }, POPUP_LIFETIME_MS);
                const popupId = ++sequenceRef.current;

                const nextItem: FloatingDamage = {
                    id: popupId,
                    value: damage,
                    left,
                    top,
                    style: {
                        ['--damage-drift-x' as any]: driftX,
                        ['--damage-rotate' as any]: driftRotate,
                        animationDelay: `${Math.min(90, (popupId % 3) * 35)}ms`,
                    },
                };

                setItems(current => [...current.slice(-(MAX_POPUPS - 1)), nextItem]);

                return () => window.clearTimeout(id);
            } catch {}
        };

        window.addEventListener('open-opponent-stats', onStats as EventListener);
        window.addEventListener('user_inspect_stats', onStats as EventListener);

        return () => {
            window.removeEventListener('open-opponent-stats', onStats as EventListener);
            window.removeEventListener('user_inspect_stats', onStats as EventListener);
        };
    }, [roomIndex]);

    if (!items.length) return null;

    return createPortal(
        <>
            {items.map(item => (
                <div
                    key={item.id}
                    className="rp-damage-number"
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
