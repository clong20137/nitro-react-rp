import { FC, useEffect, useState } from "react";
import { SettingsView } from "../roleplay/SettingsView";

type VRoomDetail = {
    virtualRoomId: number;
    name: string;
    type: string; // "safe", "combat", etc.
    credits?: number; // optional; included if server sends it
    userCount?: number; // optional; if you want to send people-in-zone
};

export const RightSideView: FC<{}> = () => {
    const [gameTime, setGameTime] = useState("—:— —");
    const [onlineUsers, setOnlineUsers] = useState<number>(0);
    const [virtualName, setVirtualName] = useState("Loading…");
    const [virtualId, setVirtualId] = useState<number>(0);
    const [virtualType, setVirtualType] = useState<string>("default");
    const [credits, setCredits] = useState<number>(0);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        // clock
        const t = setInterval(() => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes().toString().padStart(2, "0");
            const ampm = h >= 12 ? "PM" : "AM";
            setGameTime(`${h % 12 || 12}:${m} ${ampm}`);
        }, 20_000);

        const handleVRoomInfo = (e: any) => {
            const detail = e.detail as VRoomDetail;
            if (!detail) return;

            setVirtualName(detail.name);
            setVirtualId(detail.virtualRoomId);
            setVirtualType(detail.type || "default");
            if (typeof detail.credits === "number") setCredits(detail.credits);
            if (typeof detail.userCount === "number")
                setOnlineUsers(detail.userCount);
        };

        const handleCreditUpdate = (e: any) => {
            if (e?.detail?.amount != null)
                setCredits(Number(e.detail.amount) || 0);
        };

        window.addEventListener("virtual_room_info_update", handleVRoomInfo);
        window.addEventListener("credit_balance_update", handleCreditUpdate);

        return () => {
            clearInterval(t);
            window.removeEventListener(
                "virtual_room_info_update",
                handleVRoomInfo
            );
            window.removeEventListener(
                "credit_balance_update",
                handleCreditUpdate
            );
        };
    }, []);

    return (
        <div className="nitro-right-compact">
            {/* top mini bar (time • credits • gear) */}
            <div className="rs-mini">
                <div className="rs-time">
                    <i className="ico ico-time" /> {gameTime}
                </div>

                <div className="rs-credits">
                    <i className="ico ico-coin" /> {credits}
                </div>

                <button
                    className="ico ico-gear"
            
                    title="Settings"
                    onClick={() => setShowSettings(true)}
                />
            </div>

            {/* zone / virtual room card */}
            <div className="rs-card">
                <div className="rs-title" title={virtualName}>
                    <i className="ico ico-zone" />
                    <span className="rs-title-text">
                        {virtualId
                            ? `[${virtualId}] - ${virtualName}`
                            : virtualName}
                    </span>
                </div>

                <div className="rs-counter">
                    <span>{onlineUsers}</span>
                    <i className="ico ico-flag" />
                </div>
            </div>

            {showSettings && (
                <SettingsView onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
};
