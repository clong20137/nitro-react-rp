import { FC, useEffect, useState } from "react";
import { SettingsView } from "../roleplay/SettingsView";
import { SendMessageComposer, GetSessionDataManager } from "../../api";
import { StartWorkComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartWorkComposer";
import { PassiveModeComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PassiveModeComposer";
import { CallPoliceComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CallPoliceComposer";

type VRoomDetail = {
    virtualRoomId: number;
    name: string;
    type: string; // "safe", "combat", etc.
    credits?: number;
    userCount?: number;

    // NEW: these arrive from VirtualRoomInfoComposer
    inGameTime?: string; // "HH:mm"
    phase?: "DAY" | "DUSK" | "NIGHT" | "DAWN";
};

type TimeOfDayDetail = {
    time: string; // "HH:mm"
    phase: "DAY" | "DUSK" | "NIGHT" | "DAWN";
};

const fmt12h = (hhmm: string) => {
    // expect "HH:mm"
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return "—:— —";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mm = String(m).padStart(2, "0");
    return `${h12}:${mm} ${ampm}`;
};

export const RightSideView: FC<{}> = () => {
    const [gameTime, setGameTime] = useState("—:— —");
    const [phase, setPhase] = useState<"DAY" | "DUSK" | "NIGHT" | "DAWN">(
        "DAY"
    );
    const [onlineUsers, setOnlineUsers] = useState<number>(0);
    const [virtualName, setVirtualName] = useState("Loading…");
    const [virtualId, setVirtualId] = useState<number>(0);
    const [virtualType, setVirtualType] = useState<string>("default");
    const [credits, setCredits] = useState<number>(0);
    const [showSettings, setShowSettings] = useState(false);

    // quick-action state (mirrors StatsBar)
    const [working, setWorking] = useState(false);
    const [passive, setPassive] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [showCall, setShowCall] = useState(false);
    const [callMsg, setCallMsg] = useState("");

    useEffect(() => {
        // SERVER-DRIVEN CLOCK (no local Date())
        const handleVRoomInfo = (e: any) => {
            const detail = e.detail as VRoomDetail;
            if (!detail) return;

            setVirtualName(detail.name);
            setVirtualId(detail.virtualRoomId);
            setVirtualType(detail.type || "default");
            if (typeof detail.credits === "number") setCredits(detail.credits);
            if (typeof detail.userCount === "number")
                setOnlineUsers(detail.userCount);

            // seed time/phase on enter or virtual-room change
            if (detail.inGameTime) setGameTime(fmt12h(detail.inGameTime));
            if (detail.phase) setPhase(detail.phase);
        };

        type TimeOfDayDetail = {
            hhmm: string; // "HH:mm"
            phase: "DAY" | "DUSK" | "NIGHT" | "DAWN";
        };

        // periodic push from TimeOfDayComposer
        const handleTimeOfDay = (e: any) => {
            const d = e?.detail as TimeOfDayDetail;
            if (!d) return;
            setGameTime(fmt12h(d.hhmm)); // ✅ use hhmm
            setPhase(d.phase);
        };

        const handleCreditUpdate = (e: any) => {
            if (e?.detail?.amount != null)
                setCredits(Number(e.detail.amount) || 0);
        };

        const onWork = (e: any) => setWorking(!!e?.detail?.isWorking);

        window.addEventListener("virtual_room_info_update", handleVRoomInfo);
        window.addEventListener("time_of_day_update", handleTimeOfDay); // <— NEW
        window.addEventListener("credit_balance_update", handleCreditUpdate);
        window.addEventListener("work_status_update", onWork as EventListener);

        return () => {
            window.removeEventListener(
                "virtual_room_info_update",
                handleVRoomInfo
            );
            window.removeEventListener("time_of_day_update", handleTimeOfDay); // <— NEW
            window.removeEventListener(
                "credit_balance_update",
                handleCreditUpdate
            );
            window.removeEventListener(
                "work_status_update",
                onWork as EventListener
            );
        };
    }, []);

    // cooldown tick
    useEffect(() => {
        if (cooldown <= 0) return;
        const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
        return () => clearTimeout(id);
    }, [cooldown]);

    // actions (reuse exact packets from StatsBar)
    const toggleWork = () => {
        SendMessageComposer(new StartWorkComposer(!working));
        setWorking((v) => !v);
    };

    const togglePassive = () => {
        const next = !passive;
        SendMessageComposer(new PassiveModeComposer(next));
        setPassive(next);
    };

    const sendPolice = () => {
        if (cooldown > 0 || !callMsg.trim()) return;
        const u = GetSessionDataManager().userName;
        const f = GetSessionDataManager().figure;
        SendMessageComposer(new CallPoliceComposer(u, f, callMsg.trim()));
        setCallMsg("");
        setShowCall(false);
        setCooldown(30);
    };

    return (
        <div className={`nitro-right-compact phase-${phase.toLowerCase()}`}>
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

            {/* Quick actions */}
            <div className="rs-quick">
                {/* Call Police */}
                <div className="qcall-wrap">
                    <button
                        className={`qbtn police ${
                            cooldown > 0 ? "cooling" : ""
                        }`}
                        title={
                            cooldown > 0
                                ? `Cooldown: ${cooldown}s`
                                : "Call Police"
                        }
                        onClick={() =>
                            cooldown > 0 ? null : setShowCall((v) => !v)
                        }
                        disabled={cooldown > 0}
                        aria-label="Call Police"
                    >
                        {cooldown > 0 && (
                            <div className="cooldown-ring">
                                <svg
                                    viewBox="0 0 36 36"
                                    className="cooldown-svg"
                                >
                                    <path
                                        className="circle-bg"
                                        d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                        className="circle-progress"
                                        strokeDasharray={`${
                                            (cooldown / 30) * 100
                                        }, 100`}
                                        d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <span className="cooldown-text">
                                    {cooldown}
                                </span>
                            </div>
                        )}
                    </button>

                    {showCall && cooldown === 0 && (
                        <div className="q-pop">
                            <div className="arrow-right" />
                            <textarea
                                maxLength={200}
                                placeholder="What's your emergency?"
                                value={callMsg}
                                onChange={(e) => setCallMsg(e.target.value)}
                            />
                            <button
                                className="habbo-action-button green"
                                onClick={sendPolice}
                            >
                                Send Call
                            </button>
                        </div>
                    )}
                </div>

                {/* Clock In / Out */}
                <button
                    className={`qbtn work ${working ? "on" : ""}`}
                    title={working ? "Clock Out" : "Clock In"}
                    onClick={toggleWork}
                    aria-label={working ? "Clock Out" : "Clock In"}
                />

                {/* Aggressive / Passive */}
                <button
                    className={`qbtn mode ${
                        passive ? "passive" : "aggressive"
                    }`}
                    title={passive ? "Passive Mode" : "Aggressive Mode"}
                    onClick={togglePassive}
                    aria-label="Toggle Aggressive / Passive"
                />
            </div>
        </div>
    );
};
