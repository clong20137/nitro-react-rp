import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./WantedListView.scss";

interface WantedUser {
    userId: number;
    username: string;
    figure: string;
    charges: string;
    wantedLevel: number;
}

interface WantedListViewProps {
    onClose: () => void;
}

const STORAGE_KEY = "wanted-list-pos";

export const WantedListView: FC<WantedListViewProps> = ({ onClose }) => {
    const [wantedUsers, setWantedUsers] = useState<WantedUser[]>([]);

    // --- draggable state ---
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 120,
        y: 120,
    });
    const dragging = useRef(false);
    const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Load saved position before paint (prevents jump)
    useLayoutEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const pos = JSON.parse(saved);
                setPosition({
                    x: Number(pos.x) || 120,
                    y: Number(pos.y) || 120,
                });
            }
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        const handleWantedListUpdate = (e: any) => {
            const users = e.detail || [];
            console.log("Wanted Users State Updated:", users);
            setWantedUsers(users);
        };

        window.addEventListener("wanted_list_update", handleWantedListUpdate);
        return () =>
            window.removeEventListener(
                "wanted_list_update",
                handleWantedListUpdate
            );
    }, []);

    const renderStars = (level: number) => (
        <div className="wanted-stars">
            {[...Array(5)].map((_, i) => (
                <span key={i} className={i < level ? "filled" : "empty"}>
                    ★
                </span>
            ))}
        </div>
    );

    // --- drag helpers ---
    const clampToViewport = (x: number, y: number) => {
        const el = containerRef.current;
        if (!el) return { x, y };
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxX = Math.max(0, vw - rect.width);
        const maxY = Math.max(0, vh - rect.height);
        return {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY),
        };
    };

    const startDragMouse = (e: React.MouseEvent) => {
        dragging.current = true;
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        document.body.style.userSelect = "none";
    };
    const onMouseMove = (e: MouseEvent) => {
        if (!dragging.current) return;
        const nx = e.clientX - dragOffset.current.x;
        const ny = e.clientY - dragOffset.current.y;
        setPosition(clampToViewport(nx, ny));
    };
    const endDragMouse = () => {
        if (!dragging.current) return;
        dragging.current = false;
        document.body.style.userSelect = "";
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    };

    // touch
    const startDragTouch = (e: React.TouchEvent) => {
        const t = e.touches[0];
        dragging.current = true;
        dragOffset.current = {
            x: t.clientX - position.x,
            y: t.clientY - position.y,
        };
        document.body.style.userSelect = "none";
    };
    const onTouchMove = (e: TouchEvent) => {
        if (!dragging.current) return;
        const t = e.touches[0];
        const nx = t.clientX - dragOffset.current.x;
        const ny = t.clientY - dragOffset.current.y;
        setPosition(clampToViewport(nx, ny));
    };
    const endDragTouch = () => {
        if (!dragging.current) return;
        dragging.current = false;
        document.body.style.userSelect = "";
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    };

    // global listeners
    useEffect(() => {
        const mm = (e: MouseEvent) => onMouseMove(e);
        const mu = () => endDragMouse();
        const tm = (e: TouchEvent) => onTouchMove(e);
        const tu = () => endDragTouch();

        document.addEventListener("mousemove", mm);
        document.addEventListener("mouseup", mu);
        document.addEventListener("touchmove", tm, { passive: false });
        document.addEventListener("touchend", tu);

        return () => {
            document.removeEventListener("mousemove", mm);
            document.removeEventListener("mouseup", mu);
            document.removeEventListener("touchmove", tm as any);
            document.removeEventListener("touchend", tu);
        };
    }, [position]);

    return (
        <div
            ref={containerRef}
            className="wanted-list-view"
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex: 1100,
            }}
        >
            <div
                className="wanted-header"
                onMouseDown={startDragMouse}
                onTouchStart={startDragTouch}
                style={{ cursor: "grab", userSelect: "none" }}
            >
                <span>Wanted List</span>
                <button onClick={onClose} className="close-button">
                    ✖
                </button>
            </div>

            <div className="wanted-content">
                {wantedUsers.length === 0 ? (
                    <div className="no-wanted-users">
                        No wanted users found.
                    </div>
                ) : (
                    wantedUsers.map((user) => (
                        <div className="wanted-entry" key={user.userId}>
                            <div className="avatar">
                                <img
                                    src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${user.figure}&headonly=1&direction=2`}
                                    alt={user.username}
                                />
                            </div>
                            <div className="wanted-info">
                                <div className="username">{user.username}</div>
                                <div className="charges">{user.charges}</div>
                                {renderStars(user.wantedLevel)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
