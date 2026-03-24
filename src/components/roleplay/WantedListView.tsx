import React, { FC, useEffect, useRef, useState, useLayoutEffect } from "react";
import "./WantedListView.scss";

type Charge = {
    text: string;
};

interface WantedUser {
    userId: number;
    username: string;
    figure: string;
    wantedLevel: number;
    charges: Charge[];

    // ONE timer per user (derived from composer field #5)
    timerExpiresAt?: number; // unix ms
}

interface WantedListViewProps {
    onClose: () => void;
}

const POS_KEY = "wanted-list-pos";
const SIZE_KEY = "wanted-list-size";

const STAR_FULL = "../../icons/star-full.png";

const formatTime = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
};

export const WantedListView: FC<WantedListViewProps> = ({ onClose }) => {
    const [wantedUsers, setWantedUsers] = useState<WantedUser[]>([]);
    const [closing, setClosing] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);

    // position (draggable)
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 8,
        y: 96,
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

    // ticking clock for timers
    const [now, setNow] = useState<number>(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    // load persisted pos/size
    useLayoutEffect(() => {
        try {
            const p = localStorage.getItem(POS_KEY);
            if (p) {
                const parsed = JSON.parse(p);
                const x = Number(parsed?.x);
                const y = Number(parsed?.y);
                setPosition({
                    x: Number.isFinite(x) ? x : 8,
                    y: Number.isFinite(y) ? y : 96,
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
            // ignore
        }
    }, []);

    // request a fresh snapshot on mount
    useEffect(() => {
        try {
            const anyWin = window as any;
            if (
                anyWin?.Nitro?.connection &&
                anyWin?.WantedListRequestComposer
            ) {
                anyWin.Nitro.connection.send(
                    new anyWin.WantedListRequestComposer()
                );
            } else {
                window.dispatchEvent(new CustomEvent("wanted_list_request"));
            }
        } catch {}
    }, []);

    // normalize incoming charges (string list from parser)
    const normalizeCharges = (u: any): Charge[] => {
        const rawArr = Array.isArray(u?.chargesList)
            ? u.chargesList
            : Array.isArray(u?.charges)
            ? u.charges
            : null;

        if (rawArr) {
            return rawArr
                .map((c: any) => {
                    if (!c) return null;

                    if (typeof c === "object") {
                        const text = String(
                            c.text ?? c.charge ?? c.name ?? ""
                        ).trim();
                        if (!text) return null;
                        return { text };
                    }

                    if (typeof c === "string") {
                        const text = c.trim();
                        if (!text) return null;
                        return { text };
                    }

                    return null;
                })
                .filter(Boolean) as Charge[];
        }

        if (typeof u?.charges === "string" && u.charges.length) {
            return u.charges
                .split(/[|,]/g)
                .map((s: string) => s.trim())
                .filter(Boolean)
                .map((text: string) => ({ text }));
        }

        return [];
    };

    // listen for updates
    useEffect(() => {
        const onUpdate = (e: Event) => {
            const raw = (e as CustomEvent).detail as any[] | undefined;
            if (!Array.isArray(raw)) return;

            const nowMs = Date.now();

            // Keep previous timers if a refresh comes in with 0 seconds
            setWantedUsers((prev) => {
                const prevById = new Map<number, WantedUser>();
                for (const p of prev) prevById.set(p.userId, p);

                const mapped: WantedUser[] = raw
                    .map((u) => {
                        const userId = Number(u?.userId) || 0;
                        if (userId <= 0) return null;

                        // your parser field name:
                        const incomingSecs = Number(u?.maxRemainingSeconds);
                        const maxRemainingSeconds = Number.isFinite(
                            incomingSecs
                        )
                            ? Math.max(0, incomingSecs)
                            : 0;

                        const prevUser = prevById.get(userId);

                        const nextTimerExpiresAt =
                            maxRemainingSeconds > 0
                                ? nowMs + maxRemainingSeconds * 1000
                                : prevUser?.timerExpiresAt; // ✅ KEEP OLD TIMER if new packet says 0

                        return {
                            userId,
                            username: String(u?.username || ""),
                            figure: String(u?.figure || ""),
                            wantedLevel: Number(u?.wantedLevel) || 0,
                            charges: normalizeCharges(u),
                            timerExpiresAt: nextTimerExpiresAt,
                        };
                    })
                    .filter(Boolean) as WantedUser[];

                // Optional: don't drop rows just because charges list momentarily empty
                // Only hide truly invalid items
                return mapped.filter((u) => u.userId > 0);
            });
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

    const handleClose = () => setClosing(true);

    const renderStars = (level: number) => {
        const n = Math.max(0, Math.min(5, level));
        if (n === 0) return null;

        return (
            <div className="wanted-stars" role="img" aria-label={`${n} stars`}>
                {Array.from({ length: n }).map((_, i) => (
                    <img
                        key={i}
                        className="star filled"
                        src={STAR_FULL}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                    />
                ))}
            </div>
        );
    };

    const groupCharges = (charges: Charge[]) => {
        const map = new Map<string, { text: string; count: number }>();

        for (const c of charges) {
            const text = (c?.text || "").trim();
            if (!text) continue;

            const key = text.toLowerCase();
            const existing = map.get(key);

            if (!existing) map.set(key, { text, count: 1 });
            else existing.count++;
        }

        return Array.from(map.values()).sort((a, b) =>
            a.text.localeCompare(b.text)
        );
    };

    const renderCharges = (charges: Charge[]) => {
        const list = Array.isArray(charges) ? charges : [];
        const grouped = groupCharges(list);

        if (grouped.length === 0)
            return <div className="charges charges--empty">No charges</div>;

        return (
            <ul className="charges">
                {grouped.map((c) => (
                    <li key={c.text}>
                        <span className="charge-text">{c.text}</span>
                        {c.count > 1 && (
                            <span className="charge-mult"> x{c.count}</span>
                        )}
                    </li>
                ))}
            </ul>
        );
    };

    const getRemainingMs = (u: WantedUser) => {
        if (!u.timerExpiresAt) return 0;
        return Math.max(0, u.timerExpiresAt - now);
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
                    className="c-button close-button"
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

                        const remainMs = getRemainingMs(u);
                        const showTimer = remainMs > 0;

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
                                    <div className="wanted-top">
                                        <div className="username">
                                            {u.username}
                                        </div>

                                        {showTimer && (
                                            <div
                                                className="wanted-timer"
                                                title="Time remaining"
                                            >
                                                {formatTime(remainMs)}
                                            </div>
                                        )}
                                    </div>

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
