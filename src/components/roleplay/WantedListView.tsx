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

const POS_KEY = "wanted-list-pos";
const SIZE_KEY = "wanted-list-size";

/** star art (replace paths if yours differ) */
const STAR_FULL = "../../icons/star-full.gif";
const STAR_EMPTY = "../../icons/star-empty.gif";

export const WantedListView: FC<WantedListViewProps> = ({ onClose }) => {
    const [wantedUsers, setWantedUsers] = useState<WantedUser[]>([]);

    const containerRef = useRef<HTMLDivElement | null>(null);

    // draggable
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 120,
        y: 120,
    });
    const dragging = useRef(false);
    const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // resizable
    const [size, setSize] = useState<{ width: number; height: number }>({
        width: 340,
        height: 420,
    });
    const resizing = useRef(false);
    const resizeStart = useRef<{ x: number; y: number; w: number; h: number }>({
        x: 0,
        y: 0,
        w: 340,
        h: 420,
    });

    // closing state for exit animation
    const [closing, setClosing] = useState(false);
    const handleClose = () => setClosing(true);

    useLayoutEffect(() => {
        try {
            const p = localStorage.getItem(POS_KEY);
            if (p) {
                const { x, y } = JSON.parse(p);
                setPosition({ x: Number(x) || 120, y: Number(y) || 120 });
            }
            const s = localStorage.getItem(SIZE_KEY);
            if (s) {
                const { width, height } = JSON.parse(s);
                setSize({
                    width: Math.max(280, Number(width) || 340),
                    height: Math.max(300, Number(height) || 420),
                });
            }
        } catch {}
    }, []);

    useEffect(() => {
        const handle = (e: any) => setWantedUsers(e.detail || []);
        window.addEventListener("wanted_list_update", handle);
        return () => window.removeEventListener("wanted_list_update", handle);
    }, []);

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

    // drag mouse/touch
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
        setPosition(
            clampToViewport(
                e.clientX - dragOffset.current.x,
                e.clientY - dragOffset.current.y
            )
        );
    };
    const endDragMouse = () => {
        if (!dragging.current) return;
        dragging.current = false;
        document.body.style.userSelect = "";
        localStorage.setItem(POS_KEY, JSON.stringify(position));
    };

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
        setPosition(
            clampToViewport(
                t.clientX - dragOffset.current.x,
                t.clientY - dragOffset.current.y
            )
        );
    };
    const endDragTouch = () => {
        if (!dragging.current) return;
        dragging.current = false;
        document.body.style.userSelect = "";
        localStorage.setItem(POS_KEY, JSON.stringify(position));
    };

    // resize mouse/touch
    const startResizeMouse = (e: React.MouseEvent) => {
        e.stopPropagation();
        resizing.current = true;
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            w: size.width,
            h: size.height,
        };
        document.body.style.userSelect = "none";
    };
    const startResizeTouch = (e: React.TouchEvent) => {
        e.stopPropagation();
        const t = e.touches[0];
        resizing.current = true;
        resizeStart.current = {
            x: t.clientX,
            y: t.clientY,
            w: size.width,
            h: size.height,
        };
        document.body.style.userSelect = "none";
    };
    const onResizeMove = (clientX: number, clientY: number) => {
        if (!resizing.current) return;
        const dx = clientX - resizeStart.current.x;
        const dy = clientY - resizeStart.current.y;
        setSize({
            width: Math.max(280, resizeStart.current.w + dx),
            height: Math.max(300, resizeStart.current.h + dy),
        });
    };
    const endResize = () => {
        if (!resizing.current) return;
        resizing.current = false;
        document.body.style.userSelect = "";
        localStorage.setItem(SIZE_KEY, JSON.stringify(size));
    };

    // global listeners
    useEffect(() => {
        const mm = (e: MouseEvent) => {
            onMouseMove(e);
            if (resizing.current) onResizeMove(e.clientX, e.clientY);
        };
        const mu = () => {
            endDragMouse();
            endResize();
        };
        const tm = (e: TouchEvent) => {
            onTouchMove(e);
            if (resizing.current)
                onResizeMove(e.touches[0].clientX, e.touches[0].clientY);
        };
        const tu = () => {
            endDragTouch();
            endResize();
        };

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
    }, [position, size]);

    const renderStars = (level: number) => (
        <div
            className="wanted-stars"
            role="img"
            aria-label={`${level} out of 5`}
        >
            {[...Array(5)].map((_, i) => (
                <img
                    key={i}
                    className={`star ${i < level ? "filled" : "empty"}`}
                    src={i < level ? STAR_FULL : STAR_EMPTY}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                />
            ))}
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={`wanted-list-view ${closing ? "exit-br" : "enter-br"}`}
            onAnimationEnd={() => {
                if (closing) onClose();
            }}
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
            }}
        >
            <div
                className="wanted-header"
                onMouseDown={startDragMouse}
                onTouchStart={startDragTouch}
            >
                <span>Wanted List</span>
                <button onClick={handleClose} className="close-button">
                    ✖
                </button>
            </div>

            <div className="wanted-content">
                {wantedUsers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <img alt="empty" src="../../icons/duck.gif" />
                        </div>
                        <div className="empty-title">NO WANTED USERS</div>
                        <div className="empty-sub">
                            All citizens are being good little ducks.
                        </div>
                    </div>
                ) : (
                    wantedUsers.map((u, idx) => {
                        // rotating accent color (stable per index)
                        const hue = (idx * 47) % 360;
                        const accent = `hsl(${hue} 70% 46%)`;
                        return (
                            <div
                                className="wanted-entry colorized"
                                key={u.userId}
                                style={{ ["--accent" as any]: accent }}
                            >
                                <div className="avatar">
                                    <img
                                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${u.figure}&headonly=1&direction=2`}
                                        alt={u.username}
                                    />
                                </div>
                                <div className="wanted-info">
                                    <div className="username">{u.username}</div>
                                    <div className="charges">{u.charges}</div>
                                    {renderStars(u.wantedLevel)}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div
                className="resize-handle"
                onMouseDown={startResizeMouse}
                onTouchStart={startResizeTouch}
            />
        </div>
    );
};
