import {
    RoomEngineEvent,
    RoomEnterEffect,
    RoomSessionDanceEvent,
} from "@nitrots/nitro-renderer";
import { FC, useEffect, useRef, useState } from "react";
import {
    AvatarInfoFurni,
    AvatarInfoPet,
    AvatarInfoRentableBot,
    AvatarInfoUser,
    GetSessionDataManager,
    RoomWidgetUpdateRentableBotChatEvent,
    SendMessageComposer,
} from "../../../../api";
import { Column } from "../../../../common";
import {
    useAvatarInfoWidget,
    useRoom,
    useRoomEngineEvent,
    useRoomSessionManagerEvent,
    useUiEvent,
} from "../../../../hooks";
import { AvatarInfoRentableBotChatView } from "./AvatarInfoRentableBotChatView";
import { AvatarInfoUseProductConfirmView } from "./AvatarInfoUseProductConfirmView";
import { AvatarInfoUseProductView } from "./AvatarInfoUseProductView";
import { InfoStandWidgetBotView } from "./infostand/InfoStandWidgetBotView";
import { InfoStandWidgetFurniView } from "./infostand/InfoStandWidgetFurniView";
import { InfoStandWidgetPetView } from "./infostand/InfoStandWidgetPetView";
import { InfoStandWidgetRentableBotView } from "./infostand/InfoStandWidgetRentableBotView";
import { InfoStandWidgetUserView } from "./infostand/InfoStandWidgetUserView";
import { AvatarInfoWidgetAvatarView } from "./menu/AvatarInfoWidgetAvatarView";
import { AvatarInfoWidgetDecorateView } from "./menu/AvatarInfoWidgetDecorateView";
import { AvatarInfoWidgetFurniView } from "./menu/AvatarInfoWidgetFurniView";
import { AvatarInfoWidgetNameView } from "./menu/AvatarInfoWidgetNameView";
import { AvatarInfoWidgetOwnAvatarView } from "./menu/AvatarInfoWidgetOwnAvatarView";
import { AvatarInfoWidgetOwnPetView } from "./menu/AvatarInfoWidgetOwnPetView";
import { AvatarInfoWidgetPetView } from "./menu/AvatarInfoWidgetPetView";
import { AvatarInfoWidgetRentableBotView } from "./menu/AvatarInfoWidgetRentableBotView";

import { SetTargetComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SetTargetComposer";

type OpponentStats = {
    userId: number;
    username: string;
    figure: string;
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    hunger: number;
    maxHunger: number;
    aggression: number;
    xpPercent: number;
    level: number;
    healthPercent: number;
    energyPercent: number;
    hungerPercent: number;
};

export const AvatarInfoWidgetView: FC<{}> = () => {
    const [isGameMode, setGameMode] = useState(false);
    const [isDancing, setIsDancing] = useState(false);
    const [rentableBotChatEvent, setRentableBotChatEvent] =
        useState<RoomWidgetUpdateRentableBotChatEvent>(null);

    const {
        avatarInfo = null,
        setAvatarInfo = null,
        activeNameBubble = null,
        setActiveNameBubble = null,
        nameBubbles = [],
        removeNameBubble = null,
        productBubbles = [],
        confirmingProduct = null,
        updateConfirmingProduct = null,
        removeProductBubble = null,
        isDecorating = false,
        setIsDecorating = null,
    } = useAvatarInfoWidget();

    const { roomSession = null } = useRoom();

    // last peer we emitted for
    const lastPeerUserIdRef = useRef<number | null>(null);

    // polling timer
    const pollTimerRef = useRef<number | null>(null);

    // locked target (client-side mirror)
    const lockedUserIdRef = useRef<number | null>(null);

    // opponent overlay visibility
    const opponentVisibleRef = useRef<boolean>(false);

    const stopPolling = () => {
        if (pollTimerRef.current !== null) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const startPolling = (userId: number) => {
        stopPolling();
        pollTimerRef.current = window.setInterval(() => {
            window.dispatchEvent(
                new CustomEvent("user_inspect_request", { detail: { userId } })
            );
        }, 1000);
    };

    /**
     * ✅ ONLY clears the HARD lock, not soft target.
     * This must send (0, true) per your SetTargetEvent.
     */
    const clearLockedTarget = () => {
        if (!lockedUserIdRef.current) return;

        lockedUserIdRef.current = null;

        try {
            SendMessageComposer(new SetTargetComposer(0, true)); // (0, true) = clear lock
        } catch {}
    };

    /* ---------------- engine/session hooks ---------------- */

    useRoomEngineEvent<RoomEngineEvent>(RoomEngineEvent.NORMAL_MODE, () => {
        if (isGameMode) setGameMode(false);
    });

    useRoomEngineEvent<RoomEngineEvent>(RoomEngineEvent.GAME_MODE, () => {
        if (!isGameMode) setGameMode(true);
    });

    useRoomSessionManagerEvent<RoomSessionDanceEvent>(
        RoomSessionDanceEvent.RSDE_DANCE,
        (event) => {
            if (event.roomIndex !== roomSession.ownRoomIndex) return;
            setIsDancing(event.danceId !== 0);
        }
    );

    useUiEvent<RoomWidgetUpdateRentableBotChatEvent>(
        RoomWidgetUpdateRentableBotChatEvent.UPDATE_CHAT,
        (event) => setRentableBotChatEvent(event)
    );

    /* ---------------- CLOSE / CLEAR overlay ---------------- */
    useEffect(() => {
        const onOpponentClear = () => {
            opponentVisibleRef.current = false;
            stopPolling();

            // ✅ IMPORTANT: if UI closes while locked, clear the hard target on server
            clearLockedTarget();

            // NOTE: do NOT wipe lastPeerUserIdRef here.
            // Soft targeting should persist until you click a different user.
        };

        window.addEventListener("user_inspect_clear", onOpponentClear);
        return () =>
            window.removeEventListener("user_inspect_clear", onOpponentClear);
    }, []);

    /**
     * ✅ ALSO clear lock on unmount (room change / reload / etc.)
     * This prevents stale hard target if the widget disappears without emitting user_inspect_clear.
     */
    useEffect(() => {
        return () => {
            stopPolling();
            clearLockedTarget();
        };
    }, []);

    /* ---------------- lock/unlock events ---------------- */
    useEffect(() => {
        const onLock = (e: Event) => {
            const ce = e as CustomEvent<{
                userId: number;
                username?: string;
                figure?: string;
            }>;

            const userId = ce?.detail?.userId;
            if (!userId) return;

            lockedUserIdRef.current = userId;

            // ✅ lock server-side
            try {
                SendMessageComposer(new SetTargetComposer(userId, true)); // true = lock
            } catch {}

            // ensure overlay shows the locked user
            window.dispatchEvent(
                new CustomEvent("user_inspect_stats", {
                    detail: {
                        userId,
                        username: ce.detail?.username || "",
                        figure: ce.detail?.figure || "",
                        health: 0,
                        maxHealth: 100,
                        energy: 0,
                        maxEnergy: 100,
                        hunger: 0,
                        maxHunger: 100,
                        aggression: 0,
                        xpPercent: 0,
                        level: 0,
                        healthPercent: 0,
                        energyPercent: 0,
                        hungerPercent: 0,
                    } as OpponentStats,
                })
            );

            opponentVisibleRef.current = true;
            lastPeerUserIdRef.current = userId;

            startPolling(userId);
        };

        /**
         * ✅ When your UI explicitly “unlocks”, we clear hard lock.
         * IMPORTANT: do NOT dispatch opponent_target_clear from clearLockedTarget(),
         * otherwise you'd loop back into this handler.
         */
        const onUnlock = () => {
            clearLockedTarget();
        };

        window.addEventListener("opponent_target_set", onLock as EventListener);
        window.addEventListener("opponent_target_clear", onUnlock);

        return () => {
            window.removeEventListener(
                "opponent_target_set",
                onLock as EventListener
            );
            window.removeEventListener("opponent_target_clear", onUnlock);
        };
    }, []);

    /* ---------------- opponent emitters (CLICK ONLY) ---------------- */

    const emitOpponentForPeer = (info: AvatarInfoUser) => {
        const userId = info.webID;

        // If locked to someone, ignore other clicks
        if (lockedUserIdRef.current && lockedUserIdRef.current !== userId) {
            return;
        }

        // ✅ set SOFT target server-side on click
        // This is what makes “click someone else” update your target.
        try {
            SendMessageComposer(new SetTargetComposer(userId, false)); // false = soft
        } catch {}

        const sameUser = lastPeerUserIdRef.current === userId;

        // re-emit if new user OR overlay hidden
        if (!sameUser || !opponentVisibleRef.current) {
            lastPeerUserIdRef.current = userId;

            const payload: OpponentStats = {
                userId,
                username: info.name || "",
                figure: info.figure || "",
                health: 0,
                maxHealth: 100,
                energy: 0,
                maxEnergy: 100,
                hunger: 0,
                maxHunger: 100,
                aggression: 0,
                xpPercent: 0,
                level: 0,
                healthPercent: 0,
                energyPercent: 0,
                hungerPercent: 0,
            };

            window.dispatchEvent(
                new CustomEvent("user_inspect_stats", { detail: payload })
            );

            opponentVisibleRef.current = true;
        }

        startPolling(userId);
    };

    /* ---------------- original widget rendering ---------------- */

    const getMenuView = () => {
        if (!roomSession || isGameMode) return null;

        if (activeNameBubble)
            return (
                <AvatarInfoWidgetNameView
                    nameInfo={activeNameBubble}
                    onClose={() => setActiveNameBubble(null)}
                />
            );

        if (avatarInfo) {
            switch (avatarInfo.type) {
                case AvatarInfoFurni.FURNI: {
                    const info = avatarInfo as AvatarInfoFurni;
                    if (!isDecorating) return null;

                    return (
                        <AvatarInfoWidgetFurniView
                            avatarInfo={info}
                            onClose={() => setAvatarInfo(null)}
                        />
                    );
                }
                case AvatarInfoUser.OWN_USER:
                case AvatarInfoUser.PEER: {
                    const info = avatarInfo as AvatarInfoUser;
                    if (info.isSpectatorMode) return null;

                    if (info.isOwnUser) {
                        if (RoomEnterEffect.isRunning()) return null;

                        return (
                            <AvatarInfoWidgetOwnAvatarView
                                avatarInfo={info}
                                isDancing={isDancing}
                                setIsDecorating={setIsDecorating}
                                onClose={() => setAvatarInfo(null)}
                            />
                        );
                    }

                    // clicked a PEER
                    emitOpponentForPeer(info);

                    return (
                        <AvatarInfoWidgetAvatarView
                            avatarInfo={info}
                            onClose={() => setAvatarInfo(null)}
                        />
                    );
                }
                case AvatarInfoPet.PET_INFO: {
                    const info = avatarInfo as AvatarInfoPet;

                    if (info.isOwner)
                        return (
                            <AvatarInfoWidgetOwnPetView
                                avatarInfo={info}
                                onClose={() => setAvatarInfo(null)}
                            />
                        );

                    return (
                        <AvatarInfoWidgetPetView
                            avatarInfo={info}
                            onClose={() => setAvatarInfo(null)}
                        />
                    );
                }
                case AvatarInfoRentableBot.RENTABLE_BOT:
                    return (
                        <AvatarInfoWidgetRentableBotView
                            avatarInfo={avatarInfo as AvatarInfoRentableBot}
                            onClose={() => setAvatarInfo(null)}
                        />
                    );
            }
        }

        return null;
    };

    const getInfostandView = () => {
        if (!avatarInfo) return null;

        switch (avatarInfo.type) {
            case AvatarInfoFurni.FURNI:
                return (
                    <InfoStandWidgetFurniView
                        avatarInfo={avatarInfo as AvatarInfoFurni}
                        onClose={() => setAvatarInfo(null)}
                    />
                );
            case AvatarInfoUser.OWN_USER:
            case AvatarInfoUser.PEER:
                return (
                    <InfoStandWidgetUserView
                        avatarInfo={avatarInfo as AvatarInfoUser}
                        setAvatarInfo={setAvatarInfo}
                        onClose={() => setAvatarInfo(null)}
                    />
                );
            case AvatarInfoUser.BOT:
                return (
                    <InfoStandWidgetBotView
                        avatarInfo={avatarInfo as AvatarInfoUser}
                        onClose={() => setAvatarInfo(null)}
                    />
                );
            case AvatarInfoRentableBot.RENTABLE_BOT:
                return (
                    <InfoStandWidgetRentableBotView
                        avatarInfo={avatarInfo as AvatarInfoRentableBot}
                        onClose={() => setAvatarInfo(null)}
                    />
                );
            case AvatarInfoPet.PET_INFO:
                return (
                    <InfoStandWidgetPetView
                        avatarInfo={avatarInfo as AvatarInfoPet}
                        onClose={() => setAvatarInfo(null)}
                    />
                );
        }
    };

    return (
        <>
            {isDecorating && (
                <AvatarInfoWidgetDecorateView
                    userId={GetSessionDataManager().userId}
                    userName={GetSessionDataManager().userName}
                    roomIndex={roomSession.ownRoomIndex}
                    setIsDecorating={setIsDecorating}
                />
            )}

            {getMenuView()}

            {avatarInfo && (
                <Column alignItems="end" className="nitro-infostand-container">
                    {getInfostandView()}
                </Column>
            )}

            {nameBubbles.length > 0 &&
                nameBubbles.map((name, index) => (
                    <AvatarInfoWidgetNameView
                        key={index}
                        nameInfo={name}
                        onClose={() => removeNameBubble(index)}
                    />
                ))}

            {productBubbles.length > 0 &&
                productBubbles.map((item, index) => {
                    return (
                        <AvatarInfoUseProductView
                            key={item.id}
                            item={item}
                            updateConfirmingProduct={updateConfirmingProduct}
                            onClose={() => removeProductBubble(index)}
                        />
                    );
                })}

            {rentableBotChatEvent && (
                <AvatarInfoRentableBotChatView
                    chatEvent={rentableBotChatEvent}
                    onClose={() => setRentableBotChatEvent(null)}
                />
            )}

            {confirmingProduct && (
                <AvatarInfoUseProductConfirmView
                    item={confirmingProduct}
                    onClose={() => updateConfirmingProduct(null)}
                />
            )}
        </>
    );
};
