import { FC, useEffect, useRef, useState } from "react";
import {
    DispatchMouseEvent,
    DispatchTouchEvent,
    GetNitroInstance,
    GetRoomSession,
    SendMessageComposer,
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
import { ATMView } from "../roleplay/ATMView";
import { PhoneView } from "../roleplay/PhoneView";
import { CommandsListView } from "../roleplay/CommandsListView";

// ✅ Correct walk composer (your version)
import { RoomUnitWalkComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/room/unit/RoomUnitWalkComposer";

// We'll listen for tile mouse events as well
import { RoomObjectTileMouseEvent } from "@nitrots/nitro-renderer/src/nitro/room/events/RoomObjectTileMouseEvent";
import { BottomRightDockView } from "../roleplay/BottomRightDockView";
import { ArenaQueueView } from "../roleplay/ArenaQueueView";
import { HotRoomsView } from "../roleplay/HotRoomsView";
import { JobBoardView } from "../roleplay/JobBoardView";
import { OnboardingOverlay } from "../../components/roleplay/OnboardingOverlay";
import { CombatCooldownView } from "../../components/roleplay/CombatCooldownView";

/* -----------------------------------------------------------
Click-through helpers
----------------------------------------------------------- */
declare global {
    interface Window {
        setClickThroughUsers?: (on: boolean) => void;
        isClickThroughUsers?: () => boolean;
    }
}
const isCTEnabled = () => window.isClickThroughUsers?.() === true;

/* -----------------------------------------------------------
Component
----------------------------------------------------------- */
export const RoomView: FC = () => {
    const { roomSession = null } = useRoom();
    const elementRef = useRef<HTMLDivElement>(null);
    const [glowForUnit, setGlowForUnit] = useState<number>(-1);
    const { gathering, level } = getRPStats();
    const [phoneVisible, setPhoneVisible] = useState(true);

    // Cache last tile hovered (so we can click-through onto it)
    const lastTileRef = useRef<{ x: number; y: number } | null>(null);

    // Mount Nitro canvas
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

    /* -----------------------------------------------------------
Handle UNIT click and TILE mouse move
----------------------------------------------------------- */
    useEffect(() => {
        if (!roomSession) return;

        const engine = Nitro.instance.roomEngine;

        const onAnyMouse = (ev: any) => {
            // Track last floor tile under the cursor
            if (ev instanceof RoomObjectTileMouseEvent) {
                try {
                    lastTileRef.current = {
                        x: ev.tileXAsInt,
                        y: ev.tileYAsInt,
                    };
                } catch {}
            }

            // If it's a UNIT click and click-through is ON, swallow it and walk to last tile
            if (
                ev instanceof RoomObjectMouseEvent &&
                ev.type === RoomObjectMouseEvent.CLICK
            ) {
                const obj = (ev as any).object;
                if (obj) {
                    const category: number = obj.category;

                    if (category === RoomObjectCategory.UNIT && isCTEnabled()) {
                        setGlowForUnit(-1);

                        // Prefer the tile under pointer *right now* if we have it
                        const tile = lastTileRef.current;
                        if (tile)
                            SendMessageComposer(
                                new RoomUnitWalkComposer(tile.x, tile.y)
                            );

                        // stop any default unit-click (inspect/profile)
                        return;
                    }
                }
            }

            // If user clicked the floor tile directly while click-through is ON, walk there
            if (
                ev instanceof RoomObjectTileMouseEvent &&
                ev.type === RoomObjectMouseEvent.CLICK &&
                isCTEnabled()
            ) {
                SendMessageComposer(
                    new RoomUnitWalkComposer(ev.tileXAsInt, ev.tileYAsInt)
                );
                return;
            }

            // (your existing glow highlight if needed)
            if (
                ev instanceof RoomObjectMouseEvent &&
                ev.type === RoomObjectMouseEvent.CLICK
            ) {
                const obj = (ev as any).object;
                if (obj) {
                    const category: number = obj.category;
                    const roomUnitIndex: number = obj.id;
                    if (category === RoomObjectCategory.UNIT)
                        setGlowForUnit(roomUnitIndex);
                    else setGlowForUnit(-1);
                }
            }
        };

        engine.events.addEventListener(
            RoomObjectMouseEvent.MOUSE_MOVE,
            onAnyMouse as any
        );
        engine.events.addEventListener(
            RoomObjectMouseEvent.CLICK,
            onAnyMouse as any
        );

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setGlowForUnit(-1);
        };
        window.addEventListener("keydown", onKey);

        return () => {
            engine.events.removeEventListener(
                RoomObjectMouseEvent.MOUSE_MOVE,
                onAnyMouse as any
            );
            engine.events.removeEventListener(
                RoomObjectMouseEvent.CLICK,
                onAnyMouse as any
            );
            window.removeEventListener("keydown", onKey);
            setGlowForUnit(-1);
            lastTileRef.current = null;
        };
    }, [roomSession]);

    /* -----------------------------------------------------------
Render
----------------------------------------------------------- */
    return (
        <Base
            fit
            innerRef={elementRef}
            className={!roomSession ? "d-none" : ""}
        >
            {roomSession && (
                <>
                    {glowForUnit > -1 && (
                        <AvatarGlowOverlay
                            objectId={glowForUnit}
                            autoHideMs={4000}
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
                    <ATMView></ATMView>
                    <HotRoomsView></HotRoomsView>
                    <CommandsListView />
                    <BottomRightDockView></BottomRightDockView>
                    <JobBoardView></JobBoardView>
                    <OnboardingOverlay />
                    <CombatCooldownView></CombatCooldownView>
                    {/*
                    <ArenaQueueView visible={true}></ArenaQueueView>
                    */}

                    {roomSession.isSpectator && <RoomSpectatorView />}
                </>
            )}
        </Base>
    );
};

export default RoomView;
