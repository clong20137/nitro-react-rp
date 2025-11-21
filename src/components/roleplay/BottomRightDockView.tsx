import { FC, useEffect, useState } from "react";
import { PhoneView } from "./PhoneView";
import { ArenaQueueView } from "./ArenaQueueView"; // adjust path if needed
import "./BottomRightDockView.scss";

export const BottomRightDockView: FC = () => {
    const [phoneOpen, setPhoneOpen] = useState(false);
    const [arenaOpen, setArenaOpen] = useState(false);

    const [notificationCount, setNotificationCount] = useState(0);
    const [shake, setShake] = useState(false);

    // Track current virtual room id (for gating the Arena button)
    const [virtualRoomId, setVirtualRoomId] = useState<number | null>(null);

    // Listen for DoorDash orders list updates
    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<any[]>;
            const list = custom.detail || [];

            setNotificationCount((prev) => {
                const next = list.length;

                // If the count increased, trigger a shake + vibrate
                if (next > prev) {
                    setShake(true);

                    try {
                        if (
                            typeof navigator !== "undefined" &&
                            "vibrate" in navigator
                        ) {
                            (navigator as any).vibrate([120, 80, 120]);
                        }
                    } catch {
                        // ignore
                    }

                    setTimeout(() => setShake(false), 500);
                }

                return next;
            });
        };

        window.addEventListener("doordash_orders", handler);

        return () => {
            window.removeEventListener("doordash_orders", handler);
        };
    }, []);

    // Listen for virtual-room changes from the client (ONLY SHOW ARENA IN VROOM 33)
    useEffect(() => {
        // NOTE: adjust the event name + detail key to match your existing implementation.
        // For example, if you already dispatch from Nitro something like:
        // window.dispatchEvent(new CustomEvent("virtual_room_status", { detail: { virtualRoomId: 33 } }));
        //
        // then this handler will pick it up.
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ virtualRoomId?: number }>;
            const vId = custom.detail?.virtualRoomId;

            if (typeof vId === "number") {
                setVirtualRoomId(vId);
            }
        };

        window.addEventListener("virtual_room_status", handler);

        return () => {
            window.removeEventListener("virtual_room_status", handler);
        };
    }, []);

    // If we ever leave vRoom 33, auto-close the arena UI
    useEffect(() => {
        if (virtualRoomId !== 20 && arenaOpen) {
            setArenaOpen(false);
        }
    }, [virtualRoomId, arenaOpen]);

    const isArenaRoom = virtualRoomId === 33;

    return (
        <>
            {phoneOpen && <PhoneView onClose={() => setPhoneOpen(false)} />}

            {/* Arena queue view – only visible when:
- we are in virtual room 33
- and the arena dock tile is toggled on */}
            {isArenaRoom && (
                <ArenaQueueView
                    visible={arenaOpen}
                    onClose={() => setArenaOpen(false)}
                    // currentUser / leaderboard can be wired later via events if you want
                />
            )}

            <div className="bottom-right-dock">
                {/* Phone button (existing) */}
                <button
                    className={
                        "dock-tile phone-tile" + (shake ? " dock-shake" : "")
                    }
                    onClick={() => setPhoneOpen((prev) => !prev)}
                    title="Phone"
                >
                    {/* red notification badge */}
                    {notificationCount > 0 && (
                        <span className="dock-notification-badge">
                            {notificationCount}
                        </span>
                    )}
                </button>

                {/* Arena button – ONLY when vRoomId === 33 */}
                {isArenaRoom && (
                    <button
                        className={
                            "dock-tile arena-tile" +
                            (arenaOpen ? " arena-tile--active" : "")
                        }
                        onClick={() => setArenaOpen((prev) => !prev)}
                        title="Bubble Juice Arena"
                    >
                        {/* you can style an icon with CSS background-image on .arena-tile */}
                    </button>
                )}
            </div>
        </>
    );
};
