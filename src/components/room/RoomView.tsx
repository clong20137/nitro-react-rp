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
import { GatheringProgressBar } from "../roleplay/GatheringProgressBar";
import { SellModuleView } from "../roleplay/SellModuleView";
import { ItemOfferPopupManager } from "../roleplay/ItemOfferPopupManager";
import { GangInviteContainer } from "../roleplay/GangInviteContainer";
import { GangClaimView } from "../roleplay/GangClaimView";
import { TaxiView } from "../roleplay/TaxiView";

import { Nitro } from "@nitrots/nitro-renderer";
import { RoomObjectMouseEvent } from "@nitrots/nitro-renderer";
import { RoomObjectCategory } from "@nitrots/nitro-renderer/src/nitro/room/object/RoomObjectCategory";

import AvatarGlowOverlay from "../roleplay/AvatarGlowOverlay";
import JukeboxView from "../roleplay/JukeboxView";
import { getRPStats } from "../roleplay/rpStatsCache";

export const RoomView: FC = () => {
    const { roomSession = null } = useRoom();
    const elementRef = useRef<HTMLDivElement>(null);

    // the selected UNIT index; -1 means none
    const [glowForUnit, setGlowForUnit] = useState<number>(-1);
    const { gathering, level } = getRPStats();

    // mount Nitro canvas
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

        const el = elementRef.current;
        if (!el || el.contains(canvas)) return;
        el.appendChild(canvas);
    }, []);

 

    // listen for clicks on room objects
    useEffect(() => {
        if (!roomSession) return;

        const engine = Nitro.instance.roomEngine;

        const onClick = (ev: RoomObjectMouseEvent) => {
            try {
                const obj = (ev as any).object;
                if (!obj) return;

                const category: number = obj.category;
                const roomUnitIndex: number = obj.id;

                if (category === RoomObjectCategory.UNIT) {
                    setGlowForUnit(roomUnitIndex);
                } else {
                    setGlowForUnit(-1); // clicked floor/furni -> hide
                }
            } catch {
                /* noop */
            }
        };

        engine.events.addEventListener(
            RoomObjectMouseEvent.CLICK,
            onClick as any
        );
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setGlowForUnit(-1);
        };
        window.addEventListener("keydown", onKey);

        return () => {
            engine.events.removeEventListener(
                RoomObjectMouseEvent.CLICK,
                onClick as any
            );
            window.removeEventListener("keydown", onKey);
            setGlowForUnit(-1);
        };
    }, [roomSession]);

    return (
        <Base
            fit
            innerRef={elementRef}
            className={!roomSession ? "d-none" : ""}
        >
            {roomSession && (
                <>
                    {/* DOM overlay rendered above canvas */}
                    {glowForUnit > -1 && (
                        <AvatarGlowOverlay
                            objectId={glowForUnit}
                            autoHideMs={4000} // optional fade after 4s
                            onHide={() => setGlowForUnit(-1)}
                        />
                    )}
                   

                    <LeftSidebarView />
                    <GangInviteContainer />
                    <ItemOfferPopupManager />
                    <SellModuleView />
                    <RoomWidgetsView />
                    <GatheringProgressBar />
                    <GangClaimView />
                    <TaxiView />
                    <JukeboxView />

                    {roomSession.isSpectator && <RoomSpectatorView />}
                </>
            )}
        </Base>
    );
};

export default RoomView;
