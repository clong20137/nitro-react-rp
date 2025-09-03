import { FC, useEffect, useRef, useState } from "react";
import {
    DispatchMouseEvent,
    DispatchTouchEvent,
    GetNitroInstance,
} from "../../api";
import { Base } from "../../common";
import { useRoom } from "../../hooks";
import { LeftSidebarView } from "../roleplay/LeftSideBarView";
import { RoomSpectatorView } from "./spectator/RoomSpectatorView";
import { RoomWidgetsView } from "./widgets/RoomWidgetsView";
import ZeusStatsBar from "../roleplay/ZeusStatsBar";
import StatsBar from "../roleplay/StatsBar";
import { PoliceCallView } from "../roleplay/PoliceCallView";
import { GatheringProgressBar } from "../roleplay/GatheringProgressBar";
import { SellModuleView } from "../roleplay/SellModuleView";
import { ItemOfferPopupManager } from "../roleplay/ItemOfferPopupManager";
import { GangInviteContainer } from "../roleplay/GangInviteContainer";
import { NightSkyOverlay } from "../roleplay/NightSkyOverlay";



type Phase = "DAY" | "DUSK" | "NIGHT" | "DAWN";

export const RoomView: FC = () => {
    const { roomSession = null } = useRoom();
    const elementRef = useRef<HTMLDivElement>(null);

    // server-driven time-of-day for overlay
    const [phase, setPhase] = useState<Phase>("DAY");
    const [overlayOpacity, setOverlayOpacity] = useState(0); // 0..1

    const [zeusStats, setZeusStats] = useState({
        health: 0,
        maxHealth: 150,
    });

    useEffect(() => {
        const instance = GetNitroInstance();
        instance.renderer.clearBeforeRender = false;

        const canvas = instance.renderer.view as HTMLCanvasElement;
        if (!canvas) return;

        canvas.onclick = (event) => DispatchMouseEvent(event);
        canvas.onmousemove = (event) => DispatchMouseEvent(event);
        canvas.onmousedown = (event) => DispatchMouseEvent(event);
        canvas.onmouseup = (event) => DispatchMouseEvent(event);

        canvas.ontouchstart = (event) => DispatchTouchEvent(event);
        canvas.ontouchmove = (event) => DispatchTouchEvent(event);
        canvas.ontouchend = (event) => DispatchTouchEvent(event);
        canvas.ontouchcancel = (event) => DispatchTouchEvent(event);

        const el = elementRef.current;
        if (!el || el.contains(canvas)) return;
        el.appendChild(canvas);
    }, []);

    // Listen to server ticks to control the overlay
    useEffect(() => {
        const onTimeOfDay = (e: Event) => {
            const d = (e as CustomEvent<{ hhmm: string; phase: Phase }>).detail;
            if (!d) return;

            setPhase(d.phase);

            // simple mapping; tweak to taste (or drive from server if you add brightness)
            const next =
                d.phase === "NIGHT"
                    ? 0.9
                    : d.phase === "DUSK" || d.phase === "DAWN"
                    ? 0.55
                    : 0.0;
            setOverlayOpacity(next);
        };

        window.addEventListener("time_of_day_update", onTimeOfDay);
        return () =>
            window.removeEventListener("time_of_day_update", onTimeOfDay);
    }, []);

    useEffect(() => {
        const handleZeusStatsUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{
                health: number;
                maxHealth: number;
            }>;
            setZeusStats(customEvent.detail);
        };

        window.addEventListener("zeus_stats_update", handleZeusStatsUpdate);
        return () =>
            window.removeEventListener(
                "zeus_stats_update",
                handleZeusStatsUpdate
            );
    }, []);

    return (
        <Base
            fit
            innerRef={elementRef}
            className={!roomSession ? "d-none" : ""}
            // ensure the overlay can absolutely-position within this container
            style={{ position: "relative" }}
        >
            {/* Overlay lives above Nitro canvas */}
            <NightSkyOverlay
                container={elementRef.current}
                phase={phase}
                opacity={overlayOpacity}
                // optional: make stars stable per room using its id if available:
                roomSeed={roomSession?.roomId ?? 1337}
                moonImageUrl={"/assets/moon.png"} // put a 256x256 transparent moon PNG here
            />

            {roomSession && (
                <>
                    <LeftSidebarView />
                    <GangInviteContainer />
                    <ItemOfferPopupManager />
                    <SellModuleView />
                    <RoomWidgetsView />
                    <GatheringProgressBar />
                    {roomSession.isSpectator && <RoomSpectatorView />}
                </>
            )}
        </Base>
    );
};
