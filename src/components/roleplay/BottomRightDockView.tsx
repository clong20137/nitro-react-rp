import { FC, useEffect, useState } from "react";
import { PhoneView } from "./PhoneView";
import { ArenaQueueView } from "./ArenaQueueView";
import "./BottomRightDockView.scss";

import { CreateLinkEvent, GetSessionDataManager } from "../../api";
import { LayoutItemCountView } from "../../common";
import { useInventoryUnseenTracker } from "../../hooks";

export const BottomRightDockView: FC = () => {
    const [phoneOpen, setPhoneOpen] = useState(false);
    const [arenaOpen, setArenaOpen] = useState(false);

    const [notificationCount, setNotificationCount] = useState(0);
    const [shake, setShake] = useState(false);

    const [virtualRoomId, setVirtualRoomId] = useState<number | null>(null);

    const { getFullCount = 0 } = useInventoryUnseenTracker();
    const isMod = GetSessionDataManager().isModerator;

    /* ---------------- DoorDash notifications ---------------- */
    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<any[]>;
            const list = custom.detail || [];

            setNotificationCount((prev) => {
                const next = list.length;

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
        return () => window.removeEventListener("doordash_orders", handler);
    }, []);

    /* ---------------- Virtual room id (same as GangClaim) ---------------- */
    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ virtualRoomId?: number }>;
            const vId = custom.detail?.virtualRoomId;

            if (typeof vId === "number") setVirtualRoomId(vId);
        };

        // Some bridges may use one or the other – listen to both
        window.addEventListener(
            "virtual_room_status",
            handler as EventListener
        );
        window.addEventListener(
            "virtual_room_info_update",
            handler as EventListener
        );

        return () => {
            window.removeEventListener(
                "virtual_room_status",
                handler as EventListener
            );
            window.removeEventListener(
                "virtual_room_info_update",
                handler as EventListener
            );
        };
    }, []);

    /* auto-close arena UI if we leave vRoom 33 */
    useEffect(() => {
        if (virtualRoomId !== 33 && arenaOpen) setArenaOpen(false);
    }, [virtualRoomId, arenaOpen]);

    const isArenaRoom = virtualRoomId === 33;
    const isClothingRoom = virtualRoomId === 26;

    return (
        <>
            {/* PHONE VIEW */}
            {phoneOpen && <PhoneView onClose={() => setPhoneOpen(false)} />}

            {/* ARENA QUEUE VIEW */}
            {isArenaRoom && (
                <ArenaQueueView
                    visible={arenaOpen}
                    onClose={() => setArenaOpen(false)}
                />
            )}

            <div className="bottom-right-dock">
                {/* Phone (always visible) */}
                <button
                    className={
                        "dock-tile phone-tile" + (shake ? " dock-shake" : "")
                    }
                    onClick={() => setPhoneOpen((prev) => !prev)}
                    title="Phone"
                    data-label="Phone"
                >
                    <span className="dock-icon dock-icon-phone" />

                    {notificationCount > 0 && (
                        <span className="dock-notification-badge">
                            {notificationCount}
                        </span>
                    )}
                </button>

                {/* Arena – only in vRoom 33 */}
                {isArenaRoom && (
                    <button
                        className={
                            "dock-tile arena-tile" +
                            (arenaOpen ? " arena-tile--active" : "")
                        }
                        onClick={() => setArenaOpen((prev) => !prev)}
                        title="Bubble Juice Arena"
                        data-label="Arena"
                    >
                        <span className="dock-icon dock-icon-arena" />
                    </button>
                )}

                {/* Clothing Store – only in vRoom 26 */}
                {isClothingRoom && (
                    <button
                        className="dock-tile clothing-tile"
                        onClick={() => CreateLinkEvent("avatar-editor/toggle")}
                        title="Clothing Store"
                        data-label="Clothing Store"
                    >
                        <span className="dock-icon dock-icon-clothing" />
                    </button>
                )}

                {/* Catalog (mods only) */}
                {isMod && (
                    <button
                        className="dock-tile catalog-tile"
                        onClick={() => CreateLinkEvent("catalog/toggle")}
                        title="Catalog"
                        data-label="Catalog"
                    >
                        <span className="dock-icon icon icon-catalog" />
                    </button>
                )}

                {/* Inventory (mods only) */}
                {isMod && (
                    <button
                        className="dock-tile inventory-tile"
                        onClick={() => CreateLinkEvent("inventory/toggle")}
                        title="Inventory"
                        data-label="Inventory"
                    >
                        <span className="dock-icon navigation-item icon icon-inventory">
                            {getFullCount > 0 && (
                                <LayoutItemCountView count={getFullCount} />
                            )}
                        </span>
                    </button>
                )}

                {/* Mod Tools (mods only) */}
                {isMod && (
                    <button
                        className="dock-tile modtools-tile"
                        onClick={() => CreateLinkEvent("mod-tools/toggle")}
                        title="Mod Tools"
                        data-label="Mod Tools"
                    >
                        <span className="dock-icon icon icon-modtools" />
                    </button>
                )}
            </div>
        </>
    );
};
