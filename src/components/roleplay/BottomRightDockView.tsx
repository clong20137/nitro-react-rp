import { FC, useEffect, useState } from "react";
import { PhoneView } from "./PhoneView";
import "./BottomRightDockView.scss";

export const BottomRightDockView: FC = () => {
    const [phoneOpen, setPhoneOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [shake, setShake] = useState(false);

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

    return (
        <>
            {phoneOpen && <PhoneView onClose={() => setPhoneOpen(false)} />}

            <div className="bottom-right-dock">
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
            </div>
        </>
    );
};
