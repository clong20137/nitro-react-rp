import { FC, useEffect, useRef, useState } from "react";
import "./SettingsView.scss";

interface SettingsViewProps {
    onClose: () => void;
}

export const SettingsView: FC<SettingsViewProps> = ({ onClose }) => {
    const [liveFeed, setLiveFeed] = useState(() => {
        const stored = localStorage.getItem("liveFeedEnabled");
        return stored ? JSON.parse(stored) : true;
    });
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const stored = localStorage.getItem("settingsPos");
        return stored ? JSON.parse(stored) : { x: 100, y: 100 };
    });
    // refs for super-smooth dragging
    const rootRef = useRef<HTMLDivElement | null>(null);
    const startMouseRef = useRef<{ x: number; y: number } | null>(null);
    const startPosRef = useRef<{ x: number; y: number }>(position);
    const rafRef = useRef<number | null>(null);
    const deltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
    const draggingRef = useRef(false);

    useEffect(() => {
        startPosRef.current = position; // keep in sync after commits
    }, [position]);

    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const posRef = useRef<{ x: number; y: number }>(position);
    const forceRender = useState(0)[1];

    useEffect(() => {
        posRef.current = position;
    }, [position]);

    const applyTransform = () => {
        if (!rootRef.current) return;
        const { dx, dy } = deltaRef.current;
        rootRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current || !startMouseRef.current) return;

        const dx = e.clientX - startMouseRef.current.x;
        const dy = e.clientY - startMouseRef.current.y;
        deltaRef.current = { dx, dy };

        // throttle via RAF
        if (rafRef.current == null) {
            rafRef.current = requestAnimationFrame(() => {
                applyTransform();
                rafRef.current = null;
            });
        }
    };
    const onMouseUp = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;

        // commit new position and clear transform
        const { dx, dy } = deltaRef.current;
        const committed = {
            x: startPosRef.current.x + dx,
            y: startPosRef.current.y + dy,
        };
        setPosition(committed);
        localStorage.setItem("settingsPos", JSON.stringify(committed));

        if (rootRef.current) {
            rootRef.current.style.transform = "translate(0, 0)";
            rootRef.current.style.willChange = "auto";
            document.body.classList.remove("dragging");
        }

        // cleanup listeners
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    const startDrag = (e: React.MouseEvent) => {
        draggingRef.current = true;
        startMouseRef.current = { x: e.clientX, y: e.clientY };
        deltaRef.current = { dx: 0, dy: 0 };

        if (rootRef.current) {
            // hint the browser for perf
            rootRef.current.style.willChange = "transform";
        }
        document.body.classList.add("dragging");

        window.addEventListener("mousemove", onMouseMove, { passive: true });
        window.addEventListener("mouseup", onMouseUp);
    };

    const saveSettings = () => {
        localStorage.setItem("liveFeedEnabled", JSON.stringify(liveFeed));
        window.dispatchEvent(
            new CustomEvent("toggleLiveFeed", { detail: { enabled: liveFeed } })
        );
        onClose();
    };

    return (
        <div
            className="settings-view"
            style={{ left: posRef.current.x, top: posRef.current.y }}
        >
            <div className="settings-header" onMouseDown={startDrag}>
                <span>Settings</span>
                <button className="close-button" onClick={onClose}>
                    ✖
                </button>
            </div>

            <div className="setting-option">
                <label htmlFor="liveFeed">Live Feed</label>
                <input
                    type="checkbox"
                    id="liveFeed"
                    checked={liveFeed}
                    onChange={(e) => setLiveFeed(e.target.checked)}
                />
            </div>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                    className="habbo-action-button green"
                    onClick={saveSettings}
                >
                    Save
                </button>
            </div>
        </div>
    );
};
