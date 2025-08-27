import { useEffect, useRef } from "react";
import "./EmojiPicker.scss";

type Props = {
    onPick: (emoji: string) => void;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLButtonElement>;
};

const EMOJIS = [
    "😀",
    "😅",
    "😂",
    "🥲",
    "😉",
    "😊",
    "😍",
    "😘",
    "😎",
    "🤩",
    "😇",
    "😐",
    "😑",
    "🙄",
    "😴",
    "🤒",
    "🤕",
    "🤧",
    "🥶",
    "🥵",
    "🤢",
    "🤮",
    "👍",
    "👎",
    "👏",
    "🙌",
    "🙏",
    "💯",
    "🔥",
    "✨",
    "🎉",
    "🥳",
    "💬",
    "😡",
    "😤",
    "😱",
    "🤯",
    "😭",
    "😤",
    "😈",
    "👀",
    "🫡",
    "🤝",
    "❤️",
    "🍔",
    "🍕",
    "🍟",
    "🍣",
    "🍩",
    "🍪",
    "☕",
    "🍺",
    "🍷",
    "🥤",
    "🍭",
];

export function EmojiPicker({ onPick, onClose, anchorRef }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (
                ref.current &&
                !ref.current.contains(t) &&
                !anchorRef.current?.contains(t)
            )
                onClose();
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [onClose, anchorRef]);

    return (
        <div className="emoji-popover" ref={ref}>
            {EMOJIS.map((e) => (
                <button
                    key={e}
                    className="emoji-btn"
                    onClick={() => onPick(e)}
                    aria-label={e}
                >
                    {e}
                </button>
            ))}
        </div>
    );
}
