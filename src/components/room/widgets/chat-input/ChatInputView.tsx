import {
HabboClubLevelEnum,
RoomControllerLevel,
} from "@nitrots/nitro-renderer";
import React, {
FC,
useCallback,
useEffect,
useMemo,
useRef,
useState,
} from "react";
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

type Macro = { id: string; key: string; command: string };
type Preset = { id: string; name: string; macros: Macro[] };
const LS_PRESETS = "olrp.macros.presets.v1";
const LS_ACTIVE = "olrp.macros.activePreset.v1";
const LS_ENABLED = "olrp.macros.enabled.v1";
const LS_COOLDOWN_PER_KEY = "olrp.macros.cooldownMs.v1";
const LS_COOLDOWN_GLOBAL = "olrp.macros.globalCooldownMs.v1";
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

type ReadMacrosResult = { enabled: boolean; macros: Macro[] };
const readActiveMacros = (): ReadMacrosResult => {
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

export const ChatInputView: FC<{}> = () => {
const [chatValue, setChatValue] = useState<string>("");
const [emojiOpen, setEmojiOpen] = useState(false);
const [isMobile, setIsMobile] = useState(false);
const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

const { chatStyleId = 0 } = useSessionInfo();
const {
selectedUsername = "",
floodBlocked = false,
floodBlockedSeconds = 0,
setIsTyping = null,
setIsIdle = null,
sendChat = null,
} = useChatInputWidget();

const inputRef = useRef<HTMLInputElement>(null);
const buttonRef = useRef<HTMLButtonElement | null>(null);
const popoverRef = useRef<HTMLDivElement | null>(null);

const macrosEnabledRef = useRef<boolean>(true);
const macrosMapRef = useRef<Map<string, string>>(new Map());
const perKeyCooldownRef = useRef<number>(DEFAULT_PER_KEY_MS);
const globalCooldownRef = useRef<number>(DEFAULT_GLOBAL_MS);
const lastGlobalFireRef = useRef<number>(0);
const lastKeyFireRef = useRef<Map<string, number>>(new Map());

const hydrateMacros = useCallback(() => {
const { enabled, macros } = readActiveMacros();
macrosEnabledRef.current = enabled;

const m = new Map<string, string>();
for (const row of macros) {
if (row?.key && row?.command) m.set(row.key, row.command);
}
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
if (inputRef.current && inputRef.current === activeElement) return false;

if (
!(activeElement instanceof HTMLInputElement) &&
!(activeElement instanceof HTMLTextAreaElement)
)
return false;

return true;
}, []);

const isChatFocused = useCallback(() => {
return !!inputRef.current && document.activeElement === inputRef.current;
}, []);

const setInputFocus = useCallback(() => {
if (!inputRef.current) return;
inputRef.current.focus();
const len = inputRef.current.value.length;
inputRef.current.setSelectionRange(len, len);
}, []);

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
return;
}

sendChat(text, chatType, recipientName, chatStyleId);
}

if (chatType === ChatMessageTypeEnum.CHAT_WHISPER) {
setChatValue(append);
} else {
setChatValue("");
}
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

const triggerMobileCombat = useCallback(() => {
const command = ":hit x";
setChatValue(command);
sendChatValue(command, false);
setEmojiOpen(false);
}, [sendChatValue]);

useEffect(() => {
const updateMobile = () => {
setIsMobile(window.innerWidth <= 768);
};

updateMobile();
window.addEventListener("resize", updateMobile);

return () => window.removeEventListener("resize", updateMobile);
}, []);

useEffect(() => {
const root = document.documentElement;

const applyLift = (lift: number, keyboardOpen: boolean) => {
root.style.setProperty("--chatbar-lift", `${Math.max(0, lift)}px`);
setIsKeyboardOpen(keyboardOpen);
};

const updateViewportLift = () => {
if (!window.visualViewport || !isMobile) {
applyLift(0, false);
return;
}

const vv = window.visualViewport;
const keyboardHeight = Math.max(
0,
window.innerHeight - (vv.height + vv.offsetTop)
);

const keyboardOpen = keyboardHeight > 120;
const desiredLift = keyboardOpen ? Math.max(0, keyboardHeight - 12) : 0;

applyLift(desiredLift, keyboardOpen);
};

updateViewportLift();

window.visualViewport?.addEventListener("resize", updateViewportLift);
window.visualViewport?.addEventListener("scroll", updateViewportLift);
window.addEventListener("orientationchange", updateViewportLift);
window.addEventListener("resize", updateViewportLift);

return () => {
root.style.setProperty("--chatbar-lift", "0px");
window.visualViewport?.removeEventListener("resize", updateViewportLift);
window.visualViewport?.removeEventListener("scroll", updateViewportLift);
window.removeEventListener("orientationchange", updateViewportLift);
window.removeEventListener("resize", updateViewportLift);
};
}, [isMobile]);

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

const onMacrosChanged = () => hydrateMacros();

const onMacroRun = (ev: Event) => {
const detail = (ev as CustomEvent)?.detail as
| { command?: string }
| undefined;

if (detail?.command) {
setChatValue(detail.command);
sendChatValue(detail.command, false);
setEmojiOpen(false);
}
};

window.addEventListener("storage", onStorage);
window.addEventListener(
"olrp_macros_changed",
onMacrosChanged as EventListener
);
window.addEventListener("macro_run", onMacroRun as EventListener);

return () => {
window.removeEventListener("storage", onStorage);
window.removeEventListener(
"olrp_macros_changed",
onMacrosChanged as EventListener
);
window.removeEventListener(
"macro_run",
onMacroRun as EventListener
);
};
}, [hydrateMacros, sendChatValue]);

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

const onKeyDownEvent = useCallback(
(event: KeyboardEvent) => {
if (
!event.repeat &&
macrosEnabledRef.current &&
!floodBlocked &&
!anotherInputHasFocus() &&
!isChatFocused()
) {
const k = eventToKeyString(event);

if (k) {
const macroCmd = macrosMapRef.current.get(k);

if (macroCmd) {
const now = performance.now();

if (
now - lastGlobalFireRef.current <
globalCooldownRef.current
) {
event.preventDefault();
return;
}

const lastForKey = lastKeyFireRef.current.get(k) || 0;
if (now - lastForKey < perKeyCooldownRef.current) {
event.preventDefault();
return;
}

event.preventDefault();

lastGlobalFireRef.current = now;
lastKeyFireRef.current.set(k, now);

setChatValue(macroCmd);
sendChatValue(macroCmd, false);
setEmojiOpen(false);
return;
}
}
}

if (floodBlocked || !inputRef.current || anotherInputHasFocus())
return;

if (document.activeElement !== inputRef.current) setInputFocus();

const value = inputRef.current.value;

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
anotherInputHasFocus,
isChatFocused,
setInputFocus,
checkSpecialKeywordForInput,
sendChatValue,
]
);

useUiEvent<RoomWidgetUpdateChatInputContentEvent>(
RoomWidgetUpdateChatInputContentEvent.CHAT_INPUT_CONTENT,
(event) => {
switch (event.chatMode) {
case RoomWidgetUpdateChatInputContentEvent.WHISPER:
setChatValue(`${chatModeIdWhisper} ${event.userName} `);
return;
case RoomWidgetUpdateChatInputContentEvent.SHOUT:
return;
}
}
);

useMemo(() => {
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
inputRef.current.parentElement!.dataset.value = chatValue;
}, [chatValue]);

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
<div className={`nitro-chat-mobile-wrap ${isKeyboardOpen ? "keyboard-open" : ""}`}>
<div className="nitro-chat-input-container">
<div className="input-sizer align-items-center">
{!floodBlocked && (
<input
ref={inputRef}
type="text"
className="chat-input"
placeholder={LocalizeText("widgets.chatinput.default")}
value={chatValue}
maxLength={maxChatLength}
onChange={(event) =>
updateChatInput(event.target.value)
}
onMouseDown={() => setInputFocus()}
onFocus={() => setIsKeyboardOpen(isMobile)}
onBlur={() => {
if (!window.visualViewport) {
setIsKeyboardOpen(false);
document.documentElement.style.setProperty("--chatbar-lift", "0px");
}
}}
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
</div>

{isMobile && !floodBlocked && (
<button
type="button"
className="mobile-combat-button"
onClick={triggerMobileCombat}
title="Combat"
aria-label="Combat"
>
<span className="mobile-combat-button__inner">Hit</span>
</button>
)}
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
el.selectionStart ?? el.value.length;
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
document.getElementById("toolbar-chat-input-container")!
);
};
