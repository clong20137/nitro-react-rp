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

/** Escape only angle brackets (for RP text) */
const escapeAngles = (s: string) =>
    s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

    /** Does this message contain *any* @mention (for bubble style)? */
    const hasAnyMention = useMemo(() => {
        const txt = chat?.formattedText || "";
        return /@([A-Za-z0-9_-]+)/.test(txt);
    }, [chat?.formattedText]);

    /** Detect if THIS message mentions *me* (for ping) */
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

    /**
     * Format with mention spans.
     * IMPORTANT: we operate on the *raw* formattedText and do NOT escape < >
     * here, so all the Nitro <font> tags & colors still work.
     */
    const formattedWithMentions = useMemo(() => {
        const raw = chat?.formattedText || "";
        if (!raw) return "";

        const re = /@([A-Za-z0-9_-]+)/g;

        // replace each @name with a span, preserving all other markup
        return raw.replace(re, (_match, p1: string) => {
            return `<span class="mention">@${p1}</span>`;
        });
    }, [chat?.formattedText]);

    /** Bubble style:
     * - roleplay keeps style 4
     * - any @mention → style 25 (mention bubble)
     * - otherwise use server style
     */
    const bubbleStyleId = useMemo(() => {
        if (isRoleplay) return 4;
        if (hasAnyMention) return 25;
        return chat.styleId;
    }, [isRoleplay, hasAnyMention, chat.styleId]);

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

    /** Play ping ONCE PER MESSAGE if it mentions me */
    useEffect(() => {
        if (!thisMentionsMe) return;

        const anyChat = chat as any;

        // guard: only ping once for this chat object
        if (anyChat._mentionPingPlayed) return;
        anyChat._mentionPingPlayed = true;

        try {
            const audio = new Audio(MENTION_PING_URL);
            audio.volume = 1.0;
            audio.play().catch(() => {});
        } catch {
            /* ignore */
        }
    }, [thisMentionsMe, chat]);

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
                                __html: `*${escapeAngles(
                                    chat.username
                                )} ${escapeAngles(
                                    chat.formattedText.slice(1, -1).trim()
                                )}*`,
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
