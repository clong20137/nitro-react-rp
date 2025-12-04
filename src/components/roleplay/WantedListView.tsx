import React, {
    FC,
    useEffect,
    useRef,
    useState,
    useCallback,
    useLayoutEffect,
} from "react";
import "./WantedListView.scss";

interface WantedUser {
    userId: number;
    username: string;
    figure: string;
    wantedLevel: number;
    charges: string[]; // normalized to array in state
}

interface WantedListViewProps {
    onClose: () => void;
}

const POS_KEY = "wanted-list-pos";
const SIZE_KEY = "wanted-list-size";

/** star art (replace paths if yours differ) */
const STAR_FULL = "../../icons/star-full.png";
const STAR_EMPTY = "../../icons/star-empty.png";

export const WantedListView: FC<WantedListViewProps> = ({ onClose }) => {
    const [wantedUsers, setWantedUsers] = useState<WantedUser[]>([]);
    const [closing, setClosing] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);

    // position (draggable)
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 120,
        y: 120,
    });
    const dragging = useRef(false);
    const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // size (resizable)
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

    // load persisted pos/size
    useLayoutEffect(() => {
        try {
            const p = localStorage.getItem(POS_KEY);
            if (p) {
                const parsed = JSON.parse(p);
                const x = Number(parsed?.x);
                const y = Number(parsed?.y);
                setPosition({
                    x: Number.isFinite(x) ? x : 120,
                    y: Number.isFinite(y) ? y : 120,
                });
            }
            const s = localStorage.getItem(SIZE_KEY);
            if (s) {
                const parsed = JSON.parse(s);
                const w = Number(parsed?.width);
                const h = Number(parsed?.height);
                setSize({
                    width: Math.max(280, Number.isFinite(w) ? w : 340),
                    height: Math.max(300, Number.isFinite(h) ? h : 420),
                });
            }
        } catch {
            // ignore bad localStorage values
        }
    }, []);

    // request a fresh snapshot on mount (best-effort, safe if not available)
    useEffect(() => {
        try {
            // If you have a real composer, use it here:
            // GetConnection().send(new WantedListRequestComposer());
            const anyWin = window as any;
            if (
                anyWin?.Nitro?.connection &&
                anyWin?.WantedListRequestComposer
            ) {
                anyWin.Nitro.connection.send(
                    new anyWin.WantedListRequestComposer()
                );
            } else {
                // Optional: broadcast a request event your app shell can intercept
                window.dispatchEvent(new CustomEvent("wanted_list_request"));
            }
        } catch {
            /* no-op */
        }
    }, []);

    // listen for wanted list updates (from parser / server)
    useEffect(() => {
        const onUpdate = (e: Event) => {
            const raw = (e as CustomEvent).detail as any[] | undefined;
            if (!Array.isArray(raw)) return;

            const normalizeCharges = (u: any): string[] => {
                // Prefer already parsed array from parser
                if (Array.isArray(u.chargesList))
                    return u.chargesList.filter(Boolean);

                // Accept array under 'charges'
                if (Array.isArray(u.charges)) return u.charges.filter(Boolean);

                // Fall back to string in either comma- or pipe-delimited form
                if (typeof u.charges === "string" && u.charges.length) {
                    return u.charges
                        .split(/[|,]/g)
                        .map((s: string) => s.trim())
                        .filter(Boolean);
                }
                return [];
            };

            const mapped: WantedUser[] = raw.map((u) => ({
                userId: Number(u.userId) || 0,
                username: String(u.username || ""),
                figure: String(u.figure || ""),
                wantedLevel: Number(u.wantedLevel) || 0,
                charges: normalizeCharges(u),
            }));

            setWantedUsers(mapped);
        };

        window.addEventListener(
            "wanted_list_update",
            onUpdate as EventListener
        );
        return () =>
            window.removeEventListener(
                "wanted_list_update",
                onUpdate as EventListener
            );
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

    // drag (mouse)
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
        try {
            localStorage.setItem(POS_KEY, JSON.stringify(position));
        } catch {}
    };

    // drag (touch)
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
        try {
            localStorage.setItem(POS_KEY, JSON.stringify(position));
        } catch {}
    };

    // resize
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
        try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(size));
        } catch {}
    };

    // global listeners (drag/resize)
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

    const handleClose = () => setClosing(true);

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

    const renderCharges = (charges: string[]) => {
        const list = Array.isArray(charges) ? charges : [];
        if (list.length === 0)
            return <div className="charges charges--empty">No charges</div>;

        return (
            <ul className="charges">
                {list.map((c, i) => (
                    <li key={i}>{c}</li>
                ))}
            </ul>
        );
    };

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
                <button
                    onClick={handleClose}
                    className="close-button"
                    aria-label="Close"
                />
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
                                    {renderCharges(u.charges)}
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
