import { FC, useEffect, useRef, useState } from "react";
import "./SettingsView.scss";

interface SettingsViewProps {
    onClose: () => void;
}

export const SettingsView: FC<SettingsViewProps> = ({ onClose }) => {
    // Live Feed toggle
    const [liveFeed, setLiveFeed] = useState(() => {
        const stored = localStorage.getItem("liveFeedEnabled");
        return stored ? JSON.parse(stored) : true;
    });

    // Gang Invites toggle
    const [gangInvites, setGangInvites] = useState(() => {
        const stored = localStorage.getItem("gangInvitesEnabled");
        return stored ? JSON.parse(stored) : true;
    });

    // Position persistence
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const stored = localStorage.getItem("settingsPos");
        return stored ? JSON.parse(stored) : { x: 100, y: 100 };
    });

    const rootRef = useRef<HTMLDivElement | null>(null);

    const startMouseRef = useRef<{ x: number; y: number } | null>(null);
    const startPosRef = useRef<{ x: number; y: number }>(position);
    const rafRef = useRef<number | null>(null);
    const deltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
    const draggingRef = useRef(false);

    // Keep startPosRef in sync with the committed position
    useEffect(() => {
        startPosRef.current = position;
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

        if (rafRef.current == null) {
            rafRef.current = requestAnimationFrame(() => {
                applyTransform();
                rafRef.current = null;
            });
        }
    };

    const cleanupListeners = () => {
        window.removeEventListener("mousemove", onMouseMove as any);
        window.removeEventListener("mouseup", onMouseUp as any);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    const onMouseUp = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;

        const { dx, dy } = deltaRef.current;
        const committed = {
            x: startPosRef.current.x + dx,
            y: startPosRef.current.y + dy,
        };

        // Commit new position to state + storage (triggers re-render with new left/top)
        setPosition(committed);
        localStorage.setItem("settingsPos", JSON.stringify(committed));

        // Defer clearing transform until AFTER React paints new left/top
        requestAnimationFrame(() => {
            if (rootRef.current) {
                rootRef.current.style.transform = "translate(0px, 0px)";
                rootRef.current.style.willChange = "auto";
            }
            document.body.classList.remove("dragging");
        });

        cleanupListeners();
    };

    const startDrag = (e: React.MouseEvent) => {
        draggingRef.current = true;
        startMouseRef.current = { x: e.clientX, y: e.clientY };
        deltaRef.current = { dx: 0, dy: 0 };

        if (rootRef.current) {
            rootRef.current.style.willChange = "transform";
        }
        document.body.classList.add("dragging");

        // Passive is fine for mousemove (we don't call preventDefault)
        window.addEventListener("mousemove", onMouseMove as any, {
            passive: true,
        });
        window.addEventListener("mouseup", onMouseUp as any);
    };

    useEffect(() => {
        // Safety cleanup on unmount
        return () => {
            cleanupListeners();
            document.body.classList.remove("dragging");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveSettings = () => {
        localStorage.setItem("liveFeedEnabled", JSON.stringify(liveFeed));
        localStorage.setItem("gangInvitesEnabled", JSON.stringify(gangInvites));

        window.dispatchEvent(
            new CustomEvent("toggleLiveFeed", { detail: { enabled: liveFeed } })
        );
        window.dispatchEvent(
            new CustomEvent("toggleGangInvites", {
                detail: { enabled: gangInvites },
            })
        );

        onClose();
    };

    return (
        <div
            ref={rootRef}
            className="settings-view"
            style={{ left: position.x, top: position.y }}
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

            <div className="setting-option">
                <label htmlFor="gangInvites">Gang Invites</label>
                <input
                    type="checkbox"
                    id="gangInvites"
                    checked={gangInvites}
                    onChange={(e) => setGangInvites(e.target.checked)}
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
