import { RoomChatSettings, RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import {
    ChatBubbleMessage,
    GetRoomEngine,
    GetSessionDataManager,
} from "../../../../api";

interface ChatWidgetMessageViewProps {
    chat: ChatBubbleMessage;
    makeRoom: (chat: ChatBubbleMessage) => void;
    bubbleWidth?: number;
}

/** Base for name icons (same as store) */
const NAME_ICON_BASE = "/nitro-react/src/assets/images/chat/nameicons";

/** Mention ping sound */
const MENTION_PING_URL = "/assets/sounds/mention-ping.mp3";

export const ChatWidgetMessageView: FC<ChatWidgetMessageViewProps> = (
    props
) => {
    const {
        chat,
        makeRoom,
        bubbleWidth = RoomChatSettings.CHAT_BUBBLE_WIDTH_NORMAL,
    } = props;
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);
    const pingPlayedRef = useRef(false);

    const myName = (GetSessionDataManager()?.userName || "").trim();
    const myNameLower = myName.toLowerCase();

    const getBubbleWidth = useMemo(() => {
        switch (bubbleWidth) {
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_NORMAL:
                return 350;
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_THIN:
                return 240;
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_WIDE:
                return 2000;
            default:
                return 350;
        }
    }, [bubbleWidth]);

    const isRoleplay =
        chat &&
        chat.styleId === 4 &&
        chat.formattedText?.startsWith("*") &&
        chat.formattedText?.endsWith("*");

    /** Build icon (if provided by server) */
    const nameIconUrl =
        chat.showNameIcon && chat.nameIconKey
            ? `${NAME_ICON_BASE}/${chat.nameIconKey}.png`
            : null;

    const usernameHtmlCore = `${chat.username}: `;
    const usernameMarkup =
        (nameIconUrl
            ? `<img class="name-icon" src="${nameIconUrl}" alt="" aria-hidden="true" draggable="false" /> `
            : "") + usernameHtmlCore;

    /** Detect if THIS message mentions me (case-insensitive) */
    const thisMentionsMe = useMemo(() => {
        const txt = chat?.formattedText || "";
        const me = myNameLower;
        if (!txt || !me) return false;

        const scanRe = /@([A-Za-z0-9_-]+)/g;
        let m: RegExpExecArray | null;
        while ((m = scanRe.exec(txt)) !== null) {
            if ((m[1] || "").toLowerCase() === me) return true;
        }
        return false;
    }, [chat?.formattedText, myNameLower]);

    /** Format with mention spans (allows multiple mentions) */
    const formattedWithMentions = useMemo(() => {
        const txt = chat?.formattedText || "";
        if (!txt) return "";

        const replaceRe = /@([A-Za-z0-9_-]+)/g;

        const html = txt.replace(replaceRe, (_m, handle: string) => {
            const safe = handle;
            return `<span class="mention">@${safe}</span>`;
        });

        return html;
    }, [chat?.formattedText]);

    /** Bubble style: roleplay (4), mention highlight (25), else normal */
    const bubbleStyleId = useMemo(() => {
        if (isRoleplay) return 4;
        if (thisMentionsMe) return 25;
        return chat.styleId;
    }, [isRoleplay, thisMentionsMe, chat.styleId]);

    /** Measure / place bubble */
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

    /** Play ping for me once if I'm mentioned */
    useEffect(() => {
        if (!thisMentionsMe) {
            pingPlayedRef.current = false;
            return;
        }
        if (pingPlayedRef.current) return;
        pingPlayedRef.current = true;

        try {
            const audio = new Audio(MENTION_PING_URL);
            audio.volume = 1.0;
            audio.play().catch(() => {});
        } catch {
            /* ignore */
        }
    }, [thisMentionsMe]);

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
                                dangerouslySetInnerHTML={{
                                    __html: usernameMarkup,
                                }}
                            />
                            <span
                                className="message"
                                dangerouslySetInnerHTML={{
                                    __html: formattedWithMentions,
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
