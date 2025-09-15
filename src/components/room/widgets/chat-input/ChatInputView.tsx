import {
    HabboClubLevelEnum,
    RoomControllerLevel,
} from "@nitrots/nitro-renderer";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ChatMessageTypeEnum,
    GetClubMemberLevel,
    GetConfiguration,
    GetRoomSession,
    GetSessionDataManager,
    LocalizeText,
    RoomWidgetUpdateChatInputContentEvent,
} from "../../../../api";
import { Text } from "../../../../common";
import {
    useChatInputWidget,
    useSessionInfo,
    useUiEvent,
} from "../../../../hooks";

/* ===== Macros (read-only) ===== */
type Macro = { id: string; key: string; command: string };
type Preset = { id: string; name: string; macros: Macro[] };
const LS_PRESETS = "olrp.macros.presets.v1";
const LS_ACTIVE = "olrp.macros.activePreset.v1";
const LS_ENABLED = "olrp.macros.enabled.v1";

/* Optional cooldown overrides */
const LS_COOLDOWN_PER_KEY = "olrp.macros.cooldownMs.v1";
const LS_COOLDOWN_GLOBAL = "olrp.macros.globalCooldownMs.v1";

/* Defaults */
const DEFAULT_PER_KEY_MS = 2000;
const DEFAULT_GLOBAL_MS = 1200;

const eventToKeyString = (e: KeyboardEvent): string | null => {
    if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta"
    )
        return null;
    const code = (e.code || e.key) as string;
    return code === " " ? "Space" : code;
};

const readNumberLS = (key: string, fallback: number) => {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const readActiveMacros = (): { enabled: boolean; macros: Macro[] } => {
    try {
        const enabled = JSON.parse(localStorage.getItem(LS_ENABLED) || "true");
        const presets: Preset[] = JSON.parse(
            localStorage.getItem(LS_PRESETS) || "[]"
        );
        const activeId =
            localStorage.getItem(LS_ACTIVE) || presets[0]?.id || "";
        const preset = presets.find((p) => p.id === activeId) || presets[0];
        return { enabled: !!enabled, macros: preset?.macros || [] };
    } catch {
        return { enabled: true, macros: [] };
    }
};

export const ChatInputView: FC<{}> = (props) => {
    const [chatValue, setChatValue] = useState<string>("");
    const { chatStyleId = 0 } = useSessionInfo();
    const {
        selectedUsername = "",
        floodBlocked = false,
        floodBlockedSeconds = 0,
        setIsTyping = null,
        setIsIdle = null,
        sendChat = null,
    } = useChatInputWidget();
    const inputRef = useRef<HTMLInputElement>();

    // Emoji popover
    const [emojiOpen, setEmojiOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    /* ===== Macros state & cooldowns ===== */
    const macrosEnabledRef = useRef<boolean>(true);
    const macrosMapRef = useRef<Map<string, string>>(new Map()); // key -> command

    const perKeyCooldownRef = useRef<number>(DEFAULT_PER_KEY_MS);
    const globalCooldownRef = useRef<number>(DEFAULT_GLOBAL_MS);

    const lastGlobalFireRef = useRef<number>(0);
    const lastKeyFireRef = useRef<Map<string, number>>(new Map());

    const hydrateMacros = useCallback(() => {
        const { enabled, macros } = readActiveMacros();
        macrosEnabledRef.current = enabled;
        const m = new Map<string, string>();
        for (const row of macros)
            if (row?.key && row?.command) m.set(row.key, row.command);
        macrosMapRef.current = m;

        perKeyCooldownRef.current = readNumberLS(
            LS_COOLDOWN_PER_KEY,
            DEFAULT_PER_KEY_MS
        );
        globalCooldownRef.current = readNumberLS(
            LS_COOLDOWN_GLOBAL,
            DEFAULT_GLOBAL_MS
        );
    }, []);

    useEffect(() => {
        hydrateMacros();
        const onStorage = (e: StorageEvent) => {
            if (
                [
                    LS_PRESETS,
                    LS_ACTIVE,
                    LS_ENABLED,
                    LS_COOLDOWN_PER_KEY,
                    LS_COOLDOWN_GLOBAL,
                ].includes(e.key || "")
            ) {
                hydrateMacros();
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [hydrateMacros]);

    // curated emojis
    const EMOJIS = useMemo(
        () => [
            "😀",
            "😂",
            "😊",
            "😉",
            "😍",
            "🤩",
            "😘",
            "😎",
            "😇",
            "😭",
            "😤",
            "😴",
            "🤔",
            "😅",
            "🤠",
            "😜",
            "🥳",
            "😈",
            "🤓",
            "😬",
            "👍",
            "👎",
            "👏",
            "🙌",
            "🔥",
            "💯",
            "❤️",
            "💙",
            "💚",
            "💛",
            "💜",
            "🩷",
            "✨",
            "🌟",
            "🍀",
            "⚡",
            "🎯",
            "🎉",
        ],
        []
    );
    const buttonEmoji = useMemo(
        () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        [EMOJIS]
    );

    const chatModeIdWhisper = useMemo(
        () => LocalizeText("widgets.chatinput.mode.whisper"),
        []
    );
    const chatModeIdShout = useMemo(
        () => LocalizeText("widgets.chatinput.mode.shout"),
        []
    );
    const chatModeIdSpeak = useMemo(
        () => LocalizeText("widgets.chatinput.mode.speak"),
        []
    );
    const maxChatLength = useMemo(
        () => GetConfiguration<number>("chat.input.maxlength", 100),
        []
    );

    const anotherInputHasFocus = useCallback(() => {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        if (inputRef && inputRef.current === activeElement) return false;
        if (
            !(activeElement instanceof HTMLInputElement) &&
            !(activeElement instanceof HTMLTextAreaElement)
        )
            return false;
        return true;
    }, [inputRef]);

    const setInputFocus = useCallback(() => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(
            inputRef.current.value.length * 2,
            inputRef.current.value.length * 2
        );
    }, [inputRef]);

    const checkSpecialKeywordForInput = useCallback(() => {
        setChatValue((prevValue) => {
            if (prevValue !== chatModeIdWhisper || !selectedUsername.length)
                return prevValue;
            return `${prevValue} ${selectedUsername}`;
        });
    }, [selectedUsername, chatModeIdWhisper]);

    const sendChatValue = useCallback(
        (value: string, shiftKey: boolean = false) => {
            if (!value || value === "") return;

            let chatType = shiftKey
                ? ChatMessageTypeEnum.CHAT_SHOUT
                : ChatMessageTypeEnum.CHAT_DEFAULT;
            let text = value;

            const parts = text.split(" ");

            let recipientName = "";
            let append = "";

            switch (parts[0]) {
                case chatModeIdWhisper:
                    chatType = ChatMessageTypeEnum.CHAT_WHISPER;
                    recipientName = parts[1];
                    append = chatModeIdWhisper + " " + recipientName + " ";
                    parts.shift();
                    parts.shift();
                    break;
                case chatModeIdShout:
                    chatType = ChatMessageTypeEnum.CHAT_SHOUT;
                    parts.shift();
                    break;
                case chatModeIdSpeak:
                    chatType = ChatMessageTypeEnum.CHAT_DEFAULT;
                    parts.shift();
                    break;
            }

            text = parts.join(" ");

            setIsTyping(false);
            setIsIdle(false);

            if (text.length <= maxChatLength) {
                if (/%CC%/g.test(encodeURIComponent(text))) {
                    setChatValue("");
                } else {
                    setChatValue(text);
                    sendChat(text, chatType, recipientName, chatStyleId);
                    setTimeout(() => setChatValue(""), 0);
                }
            }

            setChatValue(append);
        },
        [
            chatModeIdWhisper,
            chatModeIdShout,
            chatModeIdSpeak,
            maxChatLength,
            chatStyleId,
            setIsTyping,
            setIsIdle,
            sendChat,
        ]
    );

    const updateChatInput = useCallback(
        (value: string) => {
            if (!value || !value.length) setIsTyping(false);
            else {
                setIsTyping(true);
                setIsIdle(true);
            }
            setChatValue(value);
        },
        [setIsTyping, setIsIdle]
    );

    /* ===== Global keydown: includes macro hotkeys with cooldowns ===== */
    const onKeyDownEvent = useCallback(
        (event: KeyboardEvent) => {
            // 1) Try macro first — also block auto-repeat to avoid spam when key is held
            if (event.repeat) {
                // ignore key-hold repeats
                return;
            }
            const k = eventToKeyString(event);
            if (k && macrosEnabledRef.current) {
                const macroCmd = macrosMapRef.current.get(k);
                if (macroCmd && !floodBlocked) {
                    const now = performance.now();

                    // global cooldown check
                    const sinceGlobal = now - lastGlobalFireRef.current;
                    if (sinceGlobal < globalCooldownRef.current) {
                        // still on global cooldown → ignore
                        event.preventDefault();
                        return;
                    }

                    // per-key cooldown check
                    const lastForKey = lastKeyFireRef.current.get(k) || 0;
                    const sinceKey = now - lastForKey;
                    if (sinceKey < perKeyCooldownRef.current) {
                        event.preventDefault();
                        return;
                    }

                    // pass both checks → fire macro
                    event.preventDefault();
                    lastGlobalFireRef.current = now;
                    lastKeyFireRef.current.set(k, now);

                    if (
                        inputRef.current &&
                        document.activeElement !== inputRef.current
                    )
                        inputRef.current.focus();

                    setChatValue(macroCmd);
                    sendChatValue(macroCmd, false);
                    setEmojiOpen(false);
                    return; // stop further handling
                }
            }

            // 2) Regular input handling
            if (floodBlocked || !inputRef.current || anotherInputHasFocus())
                return;

            if (document.activeElement !== inputRef.current) setInputFocus();

            const value = (event.target as HTMLInputElement).value;

            switch (event.key) {
                case " ":
                case "Space":
                    checkSpecialKeywordForInput();
                    return;
                case "NumpadEnter":
                case "Enter":
                    sendChatValue(value, event.shiftKey);
                    setEmojiOpen(false);
                    return;
                case "Backspace":
                    if (value) {
                        const parts = value.split(" ");
                        if (
                            parts[0] === chatModeIdWhisper &&
                            parts.length === 3 &&
                            parts[2] === ""
                        ) {
                            setChatValue("");
                        }
                    }
                    return;
            }
        },
        [
            floodBlocked,
            inputRef,
            anotherInputHasFocus,
            setInputFocus,
            checkSpecialKeywordForInput,
            sendChatValue,
        ]
    );

    useUiEvent<RoomWidgetUpdateChatInputContentEvent>(
        RoomWidgetUpdateChatInputContentEvent.CHAT_INPUT_CONTENT,
        (event) => {
            switch (event.chatMode) {
                case RoomWidgetUpdateChatInputContentEvent.WHISPER: {
                    setChatValue(`${chatModeIdWhisper} ${event.userName} `);
                    return;
                }
                case RoomWidgetUpdateChatInputContentEvent.SHOUT:
                    return;
            }
        }
    );

    // Styles list still computed (no UI)
    const chatStyleIds = useMemo(() => {
        let styleIds: number[] = [];
        const styles = GetConfiguration<
            {
                styleId: number;
                minRank: number;
                isSystemStyle: boolean;
                isHcOnly: boolean;
                isAmbassadorOnly: boolean;
            }[]
        >("chat.styles");

        for (const style of styles) {
            if (!style) continue;

            if (style.minRank > 0) {
                if (GetSessionDataManager().hasSecurity(style.minRank))
                    styleIds.push(style.styleId);
                continue;
            }

            if (style.isSystemStyle) {
                if (
                    GetSessionDataManager().hasSecurity(
                        RoomControllerLevel.MODERATOR
                    )
                ) {
                    styleIds.push(style.styleId);
                    continue;
                }
            }

            if (
                GetConfiguration<number[]>("chat.styles.disabled").indexOf(
                    style.styleId
                ) >= 0
            )
                continue;

            if (
                style.isHcOnly &&
                GetClubMemberLevel() >= HabboClubLevelEnum.CLUB
            ) {
                styleIds.push(style.styleId);
                continue;
            }

            if (
                style.isAmbassadorOnly &&
                GetSessionDataManager().isAmbassador
            ) {
                styleIds.push(style.styleId);
                continue;
            }

            if (!style.isHcOnly && !style.isAmbassadorOnly)
                styleIds.push(style.styleId);
        }

        return styleIds;
    }, []);

    useEffect(() => {
        document.body.addEventListener("keydown", onKeyDownEvent);
        return () =>
            document.body.removeEventListener("keydown", onKeyDownEvent);
    }, [onKeyDownEvent]);

    useEffect(() => {
        if (!inputRef.current) return;
        inputRef.current.parentElement.dataset.value = chatValue;
    }, [chatValue]);

    // Close popover if clicking outside
    useEffect(() => {
        if (!emojiOpen) return;

        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (popoverRef.current?.contains(t)) return;
            if (buttonRef.current?.contains(t)) return;
            setEmojiOpen(false);
        };

        window.addEventListener("mousedown", onDocClick);
        return () => window.removeEventListener("mousedown", onDocClick);
    }, [emojiOpen]);

    // Compute popover coordinates anchored to the button
    const popoverStyle: React.CSSProperties = useMemo(() => {
        if (!buttonRef.current) return { display: "none" };
        const r = buttonRef.current.getBoundingClientRect();
        return {
            position: "fixed",
            top: Math.max(0, r.top - 220),
            left: Math.min(window.innerWidth - 260, r.right - 240),
            zIndex: 2000,
        };
    }, [emojiOpen]);

    if (GetRoomSession().isSpectator) return null;

    return createPortal(
        <>
            <div className="nitro-chat-input-container">
                <div className="input-sizer align-items-center">
                    {!floodBlocked && (
                        <input
                            ref={inputRef}
                            type="text"
                            className="chat-input"
                            placeholder={LocalizeText(
                                "widgets.chatinput.default"
                            )}
                            value={chatValue}
                            maxLength={maxChatLength}
                            onChange={(event) =>
                                updateChatInput(event.target.value)
                            }
                            onMouseDown={() => setInputFocus()}
                        />
                    )}

                    {floodBlocked && (
                        <Text variant="danger">
                            {LocalizeText(
                                "chat.input.alert.flood",
                                ["time"],
                                [floodBlockedSeconds.toString()]
                            )}
                        </Text>
                    )}
                </div>

                <button
                    ref={buttonRef}
                    className="emoji-button"
                    title={LocalizeText("insert.emoji") || "Emoji"}
                    onClick={() => setEmojiOpen((v) => !v)}
                    type="button"
                >
                    {buttonEmoji}
                </button>
            </div>

            {emojiOpen &&
                createPortal(
                    <div
                        className="emoji-popover"
                        ref={popoverRef}
                        style={popoverStyle}
                    >
                        <div className="emoji-grid">
                            {EMOJIS.map((e, i) => (
                                <button
                                    key={i}
                                    className="emoji-cell"
                                    type="button"
                                    onClick={() => {
                                        const el = inputRef.current;
                                        if (!el) return;
                                        const start =
                                            el.selectionStart ??
                                            el.value.length;
                                        const end =
                                            el.selectionEnd ?? el.value.length;
                                        const next =
                                            el.value.slice(0, start) +
                                            e +
                                            el.value.slice(end);
                                        setChatValue(next);
                                        requestAnimationFrame(() => {
                                            el.focus();
                                            const pos = start + e.length;
                                            el.setSelectionRange(pos, pos);
                                        });
                                    }}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>,
                    document.body
                )}
        </>,
        document.getElementById("toolbar-chat-input-container")
    );
};
