import {
    GetGuestRoomResultEvent,
    RateFlatMessageComposer,
} from "@nitrots/nitro-renderer";
import classNames from "classnames";
import { FC, useEffect, useState } from "react";
import {
    AvatarInfoName,
    CreateLinkEvent,
    GetRoomEngine,
    LocalizeText,
    SendMessageComposer,
} from "../../../../api";
import {
    Base,
    Column,
    Flex,
    Text,
    TransitionAnimation,
    TransitionAnimationTypes,
} from "../../../../common";
import { useMessageEvent, useNavigator, useRoom } from "../../../../hooks";
import { Session } from "inspector";
import { GetSessionDataManager } from "../../../../api";

export const RoomToolsWidgetView: FC<{}> = (props) => {
    const [isZoomedIn, setIsZoomedIn] = useState<boolean>(false);
    const [roomName, setRoomName] = useState<string>(null);
    const [roomOwner, setRoomOwner] = useState<string>(null);
    const [roomTags, setRoomTags] = useState<string[]>(null);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { navigatorData = null } = useNavigator();
    const { roomSession = null } = useRoom();

    const handleToolClick = (action: string) => {
        switch (action) {
            case "settings":
                CreateLinkEvent("navigator/toggle-room-info");
                return;
            case "zoom":
                setIsZoomedIn((prevValue) => {
                    let scale =
                        GetRoomEngine().getRoomInstanceRenderingCanvasScale(
                            roomSession.roomId,
                            1
                        );

                    if (!prevValue) scale /= 2;
                    else scale *= 2;

                    GetRoomEngine().setRoomInstanceRenderingCanvasScale(
                        roomSession.roomId,
                        1,
                        scale
                    );

                    return !prevValue;
                });
                return;
            case "chat_history":
                CreateLinkEvent("chat-history/toggle");
                return;
            // case "like_room":
            //     SendMessageComposer(new RateFlatMessageComposer(1));
            //     return;
            case "toggle_room_link":
                CreateLinkEvent("navigator/toggle-room-link");
                return;
        }
    };

    useMessageEvent<GetGuestRoomResultEvent>(
        GetGuestRoomResultEvent,
        (event) => {
            const parser = event.getParser();

            if (!parser.roomEnter || parser.data.roomId !== roomSession.roomId)
                return;

            if (roomName !== parser.data.roomName)
                setRoomName(parser.data.roomName);
            if (roomOwner !== parser.data.ownerName)
                setRoomOwner(parser.data.ownerName);
            if (roomTags !== parser.data.tags) setRoomTags(parser.data.tags);
        }
    );

    useEffect(() => {
        setIsOpen(true);

        const timeout = setTimeout(() => setIsOpen(false), 5000);

        return () => clearTimeout(timeout);
    }, [roomName, roomOwner, roomTags]);

    return <Flex className="nitro-room-tools-container" gap={2}></Flex>;
};
