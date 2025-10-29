import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import "./TaxiView.scss";

import { SendMessageComposer } from "../../api"; // adjust if needed
import { TaxiRequestComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TaxiRequestComposer";

type TaxiDestination = {
    roomId: number;
    virtualRoomId: number;
    name: string;
    /** optional; if not provided we derive a URL */
    thumbnailUrl?: string;
};

type TaxiOpenListDetail = {
    destinations: {
        roomId: number;
        virtualRoomId: number;
        displayName: string;
        thumbnailUrl?: string;
    }[];
};

const THUMB_RESOLVER = (d: TaxiDestination) =>
    d.thumbnailUrl || `/public/icons/taxi/${d.virtualRoomId}.png`; // customize path

/** Small, no-deps draggable hook (keeps window within viewport) */
function useDraggable<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const dragData = useRef<{
        ox: number;
        oy: number;
        sx: number;
        sy: number;
    } | null>(null);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!ref.current) return;
        const el = ref.current;
        const rect = el.getBoundingClientRect();
        dragData.current = {
            ox: e.clientX,
            oy: e.clientY,
            sx: rect.left,
            sy: rect.top,
        };

        const onMove = (ev: MouseEvent) => {
            if (!dragData.current) return;
            const dx = ev.clientX - dragData.current.ox;
            const dy = ev.clientY - dragData.current.oy;

            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            const newLeft = Math.min(
                Math.max(dragData.current.sx + dx, 8),
                vw - rect.width - 8
            );
            const newTop = Math.min(
                Math.max(dragData.current.sy + dy, 8),
                vh - rect.height - 8
            );

            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
            el.style.transform = `translate(0,0)`; // disable center transform after first drag
        };

        const onUp = () => {
            dragData.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, []);

    return { ref, onMouseDown };
}

export const TaxiView: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [destinations, setDestinations] = useState<TaxiDestination[]>([]);
    const [query, setQuery] = useState("");
    const [grid, setGrid] = useState(true); // tile mode (can add a toggle later)
    const { ref: dragRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    useEffect(() => {
        const onOpen = (e: Event) => {
            const ev = e as CustomEvent<TaxiOpenListDetail>;
            const list = (ev.detail?.destinations || []).map((d) => ({
                roomId: d.roomId,
                virtualRoomId: d.virtualRoomId,
                name: d.displayName,
                thumbnailUrl: d.thumbnailUrl,
            }));
            setDestinations(list);
            setQuery("");
            setOpen(true);
        };

        const onKey = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === "Escape") setOpen(false);
        };

        window.addEventListener("taxi_open_list", onOpen as EventListener);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener(
                "taxi_open_list",
                onOpen as EventListener
            );
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return destinations;
        return destinations.filter(
            (d) =>
                d.name.toLowerCase().includes(q) ||
                String(d.roomId).includes(q) ||
                String(d.virtualRoomId).includes(q)
        );
    }, [query, destinations]);

    const onPick = (d: TaxiDestination) => {
        SendMessageComposer(new TaxiRequestComposer(d.roomId, d.virtualRoomId));
        setOpen(false);
    };

    // derive initials for fallback tile
    const initials = (name: string) =>
        name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() || "")
            .join("");

    if (!open) return null;

    return (
        <>
            <div className="taxi-backdrop" onClick={() => setOpen(false)} />

            <div
                className="taxi-view enter"
                ref={dragRef}
                style={{
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Taxi destinations"
            >
                <div className="taxi-header" onMouseDown={startDrag}>
                    <div className="title">Call a Taxi</div>
                    <div className="header-actions">
                        <button
                            className={`toggle ${grid ? "active" : ""}`}
                            title="Tile view"
                            aria-pressed={grid}
                            onClick={() => setGrid(true)}
                        >
                            ▦
                        </button>
                        <button
                            className={`toggle ${!grid ? "active" : ""}`}
                            title="List view"
                            aria-pressed={!grid}
                            onClick={() => setGrid(false)}
                        >
                            ☰
                        </button>

                        <button
                            className="close"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="taxi-toolbar">
                    <input
                        className="search"
                        placeholder="Search rooms or vRoom IDs…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="count">
                        {filtered.length}/{destinations.length}
                    </div>
                </div>

                <div className="taxi-body">
                    {filtered.length === 0 && (
                        <div className="empty">No matching destinations.</div>
                    )}

                    {grid ? (
                        <div className="taxi-grid" role="list">
                            {filtered.map((d, idx) => {
                                const src = THUMB_RESOLVER(d);
                                return (
                                    <button
                                        role="listitem"
                                        key={`${d.roomId}:${d.virtualRoomId}:${idx}`}
                                        className="tile"
                                        title={`${d.name} — Room ${d.roomId} • v${d.virtualRoomId}`}
                                        onClick={() => onPick(d)}
                                    >
                                        <div className="thumbWrap">
                                            <img
                                                className="thumb"
                                                src={src}
                                                loading="lazy"
                                                alt=""
                                                onError={(e) => {
                                                    // fallback: remove src → CSS gradient will show
                                                    (
                                                        e.target as HTMLImageElement
                                                    ).style.display = "none";
                                                    const host = (
                                                        e.target as HTMLElement
                                                    ).parentElement;
                                                    host?.classList.add(
                                                        "thumb-fallback"
                                                    );
                                                    if (host)
                                                        host.setAttribute(
                                                            "data-initials",
                                                            initials(d.name)
                                                        );
                                                }}
                                            />
                                        </div>
                                        <div className="label">
                                            <span className="name">
                                                {d.name}
                                            </span>
                                            <span className="meta">
                                                Room {d.roomId} • v
                                                {d.virtualRoomId}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <ul className="taxi-list">
                            {filtered.map((d, idx) => (
                                <li
                                    key={`${d.roomId}:${d.virtualRoomId}:${idx}`}
                                    className="taxi-row"
                                    onClick={() => onPick(d)}
                                    title={`Room ${d.roomId} • v${d.virtualRoomId}`}
                                >
                                    <div className="row-left">
                                        <div className="name">{d.name}</div>
                                        <div className="meta">
                                            Room {d.roomId} • v{d.virtualRoomId}
                                        </div>
                                    </div>
                                    <div className="row-right">
                                        <button
                                            className="call-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onPick(d);
                                            }}
                                        >
                                            Take me
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="taxi-footer">
                    <span className="hint">
                        Tip: press <b>Esc</b> to close
                    </span>
                </div>
            </div>
        </>
    );
};
