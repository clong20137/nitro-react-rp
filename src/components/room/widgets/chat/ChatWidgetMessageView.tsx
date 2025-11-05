import { RoomChatSettings, RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { ChatBubbleMessage, GetRoomEngine } from "../../../../api";

interface ChatWidgetMessageViewProps {
    chat: ChatBubbleMessage;
    makeRoom: (chat: ChatBubbleMessage) => void;
    bubbleWidth?: number;
}

/** Use the same folder you used in the store */
const NAME_ICON_BASE = "/nitro-react/src/assets/images/chat/nameicons";

export const ChatWidgetMessageView: FC<ChatWidgetMessageViewProps> = (
    props
) => {
    const {
        chat,
        makeRoom,
        bubbleWidth = RoomChatSettings.CHAT_BUBBLE_WIDTH_NORMAL,
    } = props;
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>();

    const getBubbleWidth = useMemo(() => {
        switch (bubbleWidth) {
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_NORMAL:
                return 350;
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_THIN:
                return 240;
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_WIDE:
                return 2000;
        }
    }, [bubbleWidth]);

    const isRoleplay =
        chat &&
        chat.styleId === 4 &&
        chat.formattedText?.startsWith("*") &&
        chat.formattedText?.endsWith("*");

    useEffect(() => {
        const el = elementRef.current;
        if (!el) return;

        const width = el.offsetWidth;
        const height = el.offsetHeight;

        chat.width = width;
        chat.height = height;
        chat.elementRef = el;

        let left = chat.left;
        let top = chat.top;

        if (!left && !top) {
            left = chat.location.x - width / 2;
            top = el.parentElement!.offsetHeight - height;
            chat.left = left;
            chat.top = top;
        }

        if (!chat.visible) {
            makeRoom(chat);
            chat.visible = true;
        }

        return () => {
            chat.elementRef = null;
        };
    }, [elementRef, chat, makeRoom]);

    useEffect(() => setIsVisible(chat.visible), [chat.visible]);

    const bubbleStyleId = isRoleplay ? 4 : chat.styleId;

    // If server attached these (recommended):
    // chat.showNameIcon: boolean
    // chat.nameIconKey: string (e.g., "1", "2", ... or file key)
    const nameIconUrl =
        chat.showNameIcon && chat.nameIconKey
            ? `${NAME_ICON_BASE}/${chat.nameIconKey}.png`
            : null;

    // 👇 Build the exact username HTML the client expects,
    // but prefix our icon <img> BEFORE the "[ADM]" (which is inside username HTML)
    // We simply prepend it to the whole username HTML string.
    const usernameHtmlCore = `${chat.username}: `; // this is what you had before
    const usernameMarkup =
        (nameIconUrl
            ? `<img class="name-icon" src="${nameIconUrl}" alt="" aria-hidden="true" draggable="false" /> `
            : "") + usernameHtmlCore;

    return (
        <div
            ref={elementRef}
            className={`bubble-container ${
                isVisible ? "visible" : "invisible"
            }`}
            onClick={() =>
                GetRoomEngine().selectRoomObject(
                    chat.roomId,
                    chat.senderId,
                    RoomObjectCategory.UNIT
                )
            }
        >
            {bubbleStyleId === 0 && (
                <div
                    className="user-container-bg"
                    style={{ backgroundColor: chat.color }}
                />
            )}

            <div
                className={`chat-bubble bubble-${bubbleStyleId} type-${chat.type}`}
                style={{ maxWidth: getBubbleWidth }}
            >
                <div className="user-container">
                    {chat.imageUrl && (
                        <div
                            className="user-image"
                            style={{ backgroundImage: `url(${chat.imageUrl})` }}
                        />
                    )}
                </div>

                <div className="chat-content">
                    {isRoleplay ? (
                        <span
                            className="message"
                            dangerouslySetInnerHTML={{
                                __html: `*${chat.username} ${chat.formattedText
                                    .slice(1, -1)
                                    .trim()}*`,
                            }}
                        />
                    ) : (
                        <>
                            <b
                                className="username mr-1"
                                // NOTE: we inject the icon markup directly here so it appears before [ADM]
                                dangerouslySetInnerHTML={{
                                    __html: usernameMarkup,
                                }}
                            />
                            <span
                                className="message"
                                dangerouslySetInnerHTML={{
                                    __html: chat.formattedText,
                                }}
                            />
                        </>
                    )}
                </div>

                <div className="pointer" />
            </div>
        </div>
    );
};
