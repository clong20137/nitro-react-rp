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
import { OpponentStatsBar } from "../roleplay/OpponentStatsBar";
import StatsBar from "../roleplay/StatsBar";
import { PoliceCallView } from "../roleplay/PoliceCallView";
import { GatheringProgressBar } from "../roleplay/GatheringProgressBar";
import { SellModuleView } from "../roleplay/SellModuleView";
import { ItemOfferPopupManager } from "../roleplay/ItemOfferPopupManager";
import { GangInviteContainer } from "../roleplay/GangInviteContainer";



export const RoomView: FC = () => {
    const { roomSession = null } = useRoom();
    const elementRef = useRef<HTMLDivElement>(null);

    const [zeusStats, setZeusStats] = useState({
        health: 0,
        maxHealth: 150,
    });
   
    useEffect(() => {
        const instance = GetNitroInstance();
        instance.renderer.clearBeforeRender = false;

        const canvas = instance.renderer.view;
        if (!canvas) return;

        canvas.onclick = (event) => DispatchMouseEvent(event);
        canvas.onmousemove = (event) => DispatchMouseEvent(event);
        canvas.onmousedown = (event) => DispatchMouseEvent(event);
        canvas.onmouseup = (event) => DispatchMouseEvent(event);

        canvas.ontouchstart = (event) => DispatchTouchEvent(event);
        canvas.ontouchmove = (event) => DispatchTouchEvent(event);
        canvas.ontouchend = (event) => DispatchTouchEvent(event);
        canvas.ontouchcancel = (event) => DispatchTouchEvent(event);

        const element = elementRef.current;
        if (!element || element.contains(canvas)) return;
        element.appendChild(canvas);
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
            window.removeEventListener("zeus_stats_update", handleZeusStatsUpdate);
    }, []);

    return (
        <Base
            fit
            innerRef={elementRef}
            className={!roomSession ? "d-none" : ""}
        >
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
