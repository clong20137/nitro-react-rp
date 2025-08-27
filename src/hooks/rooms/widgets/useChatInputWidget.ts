import {
    AvatarExpressionEnum,
    HabboClubLevelEnum,
    RoomControllerLevel,
    RoomEngineObjectEvent,
    RoomObjectCategory,
    RoomRotatingEffect,
    RoomSessionChatEvent,
    RoomSettingsComposer,
    RoomShakingEffect,
    RoomZoomEvent,
    TextureUtils,
} from '@nitrots/nitro-renderer';
import { useEffect, useState } from 'react';
import {
    ChatMessageTypeEnum,
    CreateLinkEvent,
    GetClubMemberLevel,
    GetConfiguration,
    GetNitroInstance,
    GetRoomEngine,
    GetSessionDataManager,
    LocalizeText,
    SendMessageComposer,
} from '../../../api';
import { useRoomEngineEvent, useRoomSessionManagerEvent } from '../../events';
import { useNotification } from '../../notification';
import { useObjectSelectedEvent } from '../engine';
import { useRoom } from '../useRoom';

const useChatInputWidgetState = () => {
    const [selectedUsername, setSelectedUsername] = useState('');
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [typingStartedSent, setTypingStartedSent] = useState(false);
    const [isIdle, setIsIdle] = useState(false);
    const [floodBlocked, setFloodBlocked] = useState(false);
    const [floodBlockedSeconds, setFloodBlockedSeconds] = useState(0);
    const { showNitroAlert = null, showConfirm = null } = useNotification();
    const { roomSession = null } = useRoom();

    const sendChat = (
        text: string,
        chatType: number,
        recipientName: string = '',
        styleId: number = 0
    ) => {
        if (text === '') return null;

        const parts = text.split(' ');

        if (parts.length > 0) {
            const firstPart = parts[0];
            let secondPart = '';

            if (parts.length > 1) secondPart = parts[1];

            if (firstPart.charAt(0) === ':' && secondPart === 'x') {
                const selectedAvatarId = GetRoomEngine().selectedAvatarId;

                if (selectedAvatarId > -1) {
                    const userData =
                        roomSession.userDataManager.getUserDataByIndex(
                            selectedAvatarId
                        );

                    if (userData) {
                        secondPart = userData.name;
                        text = text.replace(' x', ' ' + userData.name);
                    }
                }
            }

            switch (firstPart.toLowerCase()) {
                case ':shake':
                    RoomShakingEffect.init(2500, 5000);
                    RoomShakingEffect.turnVisualizationOn();

                    return null;

                case ':rotate':
                    RoomRotatingEffect.init(2500, 5000);
                    RoomRotatingEffect.turnVisualizationOn();

                    return null;
                case ':d':
                case ';d':
                    if (GetClubMemberLevel() === HabboClubLevelEnum.VIP) {
                        roomSession.sendExpressionMessage(
                            AvatarExpressionEnum.LAUGH.ordinal
                        );
                    }

                    break;
                case 'o/':
                case '_o/':
                    roomSession.sendExpressionMessage(
                        AvatarExpressionEnum.WAVE.ordinal
                    );

                    return null;
                case ':kiss':
                    if (GetClubMemberLevel() === HabboClubLevelEnum.VIP) {
                        roomSession.sendExpressionMessage(
                            AvatarExpressionEnum.BLOW.ordinal
                        );

                        return null;
                    }

                    break;
                case ':jump':
                    if (GetClubMemberLevel() === HabboClubLevelEnum.VIP) {
                        roomSession.sendExpressionMessage(
                            AvatarExpressionEnum.JUMP.ordinal
                        );

                        return null;
                    }

                    break;
                case ':idle':
                    roomSession.sendExpressionMessage(
                        AvatarExpressionEnum.IDLE.ordinal
                    );

                    return null;
                case '_b':
                    roomSession.sendExpressionMessage(
                        AvatarExpressionEnum.RESPECT.ordinal
                    );

                    return null;
                case ':sign':
                    roomSession.sendSignMessage(parseInt(secondPart));

                    return null;
                case ':iddqd':
                case ':flip':
                    GetRoomEngine().events.dispatchEvent(
                        new RoomZoomEvent(roomSession.roomId, -1, true)
                    );

                    return null;
                case ':zoom':
                    GetRoomEngine().events.dispatchEvent(
                        new RoomZoomEvent(
                            roomSession.roomId,
                            parseFloat(secondPart),
                            false
                        )
                    );

                    return null;
                case ':screenshot':
                    const texture = GetRoomEngine().createTextureFromRoom(
                        roomSession.roomId,
                        1
                    );

                    const image = new Image();

                    image.src = TextureUtils.generateImageUrl(texture);

                    const newWindow = window.open('');
                    newWindow.document.write(image.outerHTML);
                    return null;
                case ':pickall':
                    if (
                        roomSession.isRoomOwner ||
                        GetSessionDataManager().isModerator
                    ) {
                        showConfirm(
                            LocalizeText('room.confirm.pick_all'),
                            () => {
                                GetSessionDataManager().sendSpecialCommandMessage(
                                    ':pickall'
                                );
                            },
                            null,
                            null,
                            null,
                            LocalizeText('generic.alert.title')
                        );
                    }

                    return null;
                case ':furni':
                    CreateLinkEvent('furni-chooser/');
                    return null;
                case ':chooser':
                    CreateLinkEvent('user-chooser/');
                    return null;
                case ':floor':
                case ':bcfloor':
                    if (
                        roomSession.controllerLevel >=
                        RoomControllerLevel.ROOM_OWNER
                    )
                        CreateLinkEvent('floor-editor/show');

                    return null;
                case ':togglefps': {
                    if (GetNitroInstance().ticker.maxFPS > 0)
                        GetNitroInstance().ticker.maxFPS = 0;
                    else
                        GetNitroInstance().ticker.maxFPS = GetConfiguration(
                            'system.animation.fps'
                        );

                    return null;
                }
                case ':client':
                case ':nitro':
                case ':billsonnn':
                    showNitroAlert();
                    return null;
                case ':settings':
                    if (
                        roomSession.isRoomOwner ||
                        GetSessionDataManager().isModerator
                    ) {
                        SendMessageComposer(
                            new RoomSettingsComposer(roomSession.roomId)
                        );
                    }

                    return null;
            }
        }

        switch (chatType) {
            case ChatMessageTypeEnum.CHAT_DEFAULT:
                roomSession.sendChatMessage(text, styleId);
                break;
            case ChatMessageTypeEnum.CHAT_SHOUT:
                roomSession.sendShoutMessage(text, styleId);
                break;
            case ChatMessageTypeEnum.CHAT_WHISPER:
                roomSession.sendWhisperMessage(recipientName, text, styleId);
                break;
        }
    };

    useRoomSessionManagerEvent<RoomSessionChatEvent>(
        RoomSessionChatEvent.FLOOD_EVENT,
        (event) => {
            setFloodBlocked(true);
            setFloodBlockedSeconds(parseFloat(event.message));
        }
    );

    useObjectSelectedEvent((event) => {
        if (event.category !== RoomObjectCategory.UNIT) return;

        const userData = roomSession.userDataManager.getUserDataByIndex(
            event.id
        );

        if (!userData) return;

        setSelectedUsername(userData.name);
    });

    useRoomEngineEvent<RoomEngineObjectEvent>(
        RoomEngineObjectEvent.DESELECTED,
        (event) => setSelectedUsername('')
    );

    useEffect(() => {
        if (!floodBlocked) return;

        let seconds = 0;

        const interval = setInterval(() => {
            setFloodBlockedSeconds((prevValue) => {
                seconds = (prevValue || 0) - 1;

                return seconds;
            });

            if (seconds < 0) {
                clearInterval(interval);

                setFloodBlocked(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [floodBlocked]);

    useEffect(() => {
        if (!isIdle) return;

        let timeout: ReturnType<typeof setTimeout> = null;

        if (isIdle) {
            timeout = setTimeout(() => {
                setIsIdle(false);
                setIsTyping(false);
            }, 10000);
        }

        return () => clearTimeout(timeout);
    }, [isIdle]);

    useEffect(() => {
        if (isTyping) {
            if (!typingStartedSent) {
                setTypingStartedSent(true);

                roomSession.sendChatTypingMessage(isTyping);
            }
        } else {
            if (typingStartedSent) {
                setTypingStartedSent(false);

                roomSession.sendChatTypingMessage(isTyping);
            }
        }
    }, [roomSession, isTyping, typingStartedSent]);

    return {
        selectedUsername,
        floodBlocked,
        floodBlockedSeconds,
        setIsTyping,
        setIsIdle,
        sendChat,
    };
};

export const useChatInputWidget = useChatInputWidgetState;

/* -----------------------------------------------------------------------
Lightweight Emoji Picker (additive only; no changes to existing logic)
Usage in your ChatInput component:
import { openEmojiPicker } from '.../useChatInputWidget';
<button onClick={() => openEmojiPicker({ anchor: inputRef.current })}>😊</button>
useEffect(() => {
const onPick = (e: any) => { setText(prev => prev + e.detail.emoji); };
window.addEventListener('chat:emoji', onPick);
return () => window.removeEventListener('chat:emoji', onPick);
}, []);
------------------------------------------------------------------------ */

export type EmojiPickerOptions = {
    anchor?: HTMLElement | null;
    onPick?: (emoji: string) => void;
    // optional: maxHeight?: number; // can extend later
};

const OLY_EMOJI_ID = 'olymrp-emoji-picker';

const EMOJI_SET: string[] = [
    '😀',
    '😂',
    '🤣',
    '😊',
    '😍',
    '😎',
    '😭',
    '😡',
    '😴',
    '🤔',
    '👍',
    '👎',
    '🙏',
    '👏',
    '💪',
    '🔥',
    '💯',
    '🎉',
    '🏆',
    '💀',
    '🥳',
    '😇',
    '🤝',
    '🤙',
    '💖',
    '💔',
    '💤',
    '🤑',
    '🤒',
    '🤕',
    '🚓',
    '🚑',
    '🚒',
    '💊',
    '🩹',
    '⚒️',
    '🧯',
    '🔒',
    '🔓',
    '🚫',
    '🍔',
    '🍕',
    '🌮',
    '🌯',
    '☕',
    '🍺',
    '🍷',
    '🍩',
    '🍪',
    '🍰',
];

export function openEmojiPicker(options?: EmojiPickerOptions): void {
    closeEmojiPicker(); // ensure single instance

    const anchor = options?.anchor || null;

    const wrap = document.createElement('div');
    wrap.id = OLY_EMOJI_ID;
    Object.assign(wrap.style, {
        position: 'absolute',
        zIndex: '99999',
        width: '260px',
        maxHeight: '220px',
        overflowY: 'auto',
        background: 'rgba(25,25,28,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        padding: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '6px',
        userSelect: 'none',
    } as CSSStyleDeclaration);

    // place to the RIGHT side of the chat bar (anchor)
    const place = () => {
        const rect = anchor?.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const scrollX = window.scrollX || document.documentElement.scrollLeft;

        // Default bottom-right if no anchor
        let left = (rect ? rect.right : window.innerWidth - 280) + scrollX + 8; // right side
        let top = (rect ? rect.top : window.innerHeight - 280) + scrollY;

        // keep on-screen
        if (left + 260 > window.innerWidth + scrollX)
            left = (rect ? rect.left : window.innerWidth - 280) + scrollX - 268;
        if (top + 220 > window.innerHeight + scrollY)
            top = window.innerHeight + scrollY - 228;

        wrap.style.left = `${left}px`;
        wrap.style.top = `${top}px`;
    };

    EMOJI_SET.forEach((ch) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = ch;
        Object.assign(btn.style, {
            fontSize: '18px',
            lineHeight: '32px',
            width: '32px',
            height: '32px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            cursor: 'pointer',
        } as CSSStyleDeclaration);

        btn.onmouseenter = () => {
            btn.style.background = 'rgba(255,255,255,0.06)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'transparent';
        };
        btn.onclick = () => {
            options?.onPick?.(ch);
            // broadcast so your input can append it without prop drilling
            window.dispatchEvent(
                new CustomEvent('chat:emoji', { detail: { emoji: ch } })
            );
            closeEmojiPicker();
        };

        wrap.appendChild(btn);
    });

    // click-away & escape to close
    const onDocClick = (e: MouseEvent) => {
        if (!wrap.contains(e.target as Node)) closeEmojiPicker();
    };
    const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeEmojiPicker();
    };

    document.addEventListener('mousedown', onDocClick, { capture: true });
    document.addEventListener('keydown', onEsc);
    (wrap as any).__cleanup = () => {
        document.removeEventListener('mousedown', onDocClick, {
            capture: true,
        } as any);
        document.removeEventListener('keydown', onEsc);
    };

    document.body.appendChild(wrap);
    place();
}

export function closeEmojiPicker(): void {
    const el = document.getElementById(OLY_EMOJI_ID) as
        | (HTMLDivElement & { __cleanup?: () => void })
        | null;
    if (!el) return;
    try {
        el.__cleanup?.();
    } catch {}
    if (el.parentNode) el.parentNode.removeChild(el);
}
