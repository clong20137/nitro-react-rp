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

/**
 * Mention regex (FIXED):
 * - supports back-to-back: @A@B@C
 * - DOES NOT "eat" the next '@'
 * - stops at whitespace or end or next '@'
 */
const MENTION_RE = /@([A-Za-z0-9_-]+)(?=@|\s|$)/g;

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
        (chat as any).showNameIcon && (chat as any).nameIconKey
            ? `${NAME_ICON_BASE}/${(chat as any).nameIconKey}.png`
            : null;

    const usernameHtmlCore = `${chat.username}: `;
    const usernameMarkup =
        (nameIconUrl
            ? `<img class="name-icon" src="${nameIconUrl}" alt="" aria-hidden="true" draggable="false" /> `
            : "") + usernameHtmlCore;

    /** Does this message contain ANY mention (for bolding spans)? */
    const hasAnyMention = useMemo(() => {
        const txt = chat?.formattedText || "";
        if (!txt) return false;
        MENTION_RE.lastIndex = 0;
        return MENTION_RE.test(txt);
    }, [chat?.formattedText]);

    /** Detect if THIS message mentions *me* (for ping + special bubble ONLY for me) */
    const thisMentionsMe = useMemo(() => {
        const txt = chat?.formattedText || "";
        const me = myNameLower;
        if (!txt || !me) return false;

        MENTION_RE.lastIndex = 0;
        let m: RegExpExecArray | null;

        while ((m = MENTION_RE.exec(txt)) !== null) {
            if ((m[1] || "").toLowerCase() === me) return true;
        }

        return false;
    }, [chat?.formattedText, myNameLower]);

    /**
     * Format with mention spans.
     * - @Name is ALWAYS bold via .mention CSS
     * - Fixed regex prevents losing the first '@' in @A@B@C
     * - We preserve Nitro <font> tags by not escaping here
     */
    const formattedWithMentions = useMemo(() => {
        const raw = chat?.formattedText || "";
        if (!raw) return "";

        if (!hasAnyMention) return raw;

        // reset before replace when using /g in some browsers
        MENTION_RE.lastIndex = 0;

        return raw.replace(MENTION_RE, (_match, p1: string) => {
            // Always bold the @Name portion
            return `<span class="mention">@${p1}</span>`;
        });
    }, [chat?.formattedText, hasAnyMention]);

    /**
     * Bubble style RULE (FIXED):
     * - roleplay keeps style 4
     * - ONLY the tagged user sees the special bubble (style 25)
     * - everyone else sees the normal server bubble
     */
    const bubbleStyleId = useMemo(() => {
        if (isRoleplay) return 4;

        // If your ChatWidgetView already set (chat as any).isTaggedForMe, honor it:
        const taggedForMe = !!(chat as any).isTaggedForMe;

        if (taggedForMe || thisMentionsMe) return 25;

        return chat.styleId;
    }, [isRoleplay, thisMentionsMe, chat.styleId, chat]);

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
