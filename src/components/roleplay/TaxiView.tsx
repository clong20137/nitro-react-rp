import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import "./TaxiView.scss";
import { SendMessageComposer } from "../../api";
import { TaxiRequestComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TaxiRequestComposer";

type TaxiDestination = {
    roomId: number;
    virtualRoomId: number;
    /** virtual room display name */
    name: string;
    /** optional thumbnail URL */
    thumbnailUrl?: string;
    /** optional physical room name (meta only) */
    roomName?: string;
    /** number of users at destination */
    occupants?: number;
};

type TaxiOpenListDetailNew = {
    // NEW parser shape
    currentRoomId: number;
    currentVrid: number;
    destinations: {
        roomId: number;
        virtualRoomId: number;
        virtualName: string;
        userCount?: number;
        thumbnailUrl?: string;
        roomName?: string;
    }[];
};

type TaxiOpenListDetailOld = {
    // OLD shape (back-compat)
    destinations: {
        roomId: number;
        virtualRoomId: number;
        roomName?: string;
        virtualName?: string; // preferred
        displayName?: string; // fallback
        thumbnailUrl?: string;
        occupants?: number;
    }[];
    current?: {
        roomId: number;
        virtualRoomId: number;
        virtualName?: string;
    };
};

type TaxiOpenListDetail = TaxiOpenListDetailNew | TaxiOpenListDetailOld;

const THUMB_RESOLVER = (d: TaxiDestination) =>
    d.thumbnailUrl || `/icons/taxi/${d.virtualRoomId}.png`;

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
            el.style.transform = `translate(0,0)`;
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
    const [grid, setGrid] = useState(true);
    const [current, setCurrent] = useState<{
        roomId: number;
        virtualRoomId: number;
        virtualName?: string;
    } | null>(null);
    const { ref: dragRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    useEffect(() => {
        const onOpen = (e: Event) => {
            const ev = e as CustomEvent<TaxiOpenListDetail>;
            const d = ev.detail;

            // Normalize NEW vs OLD payloads
            const isNew = (x: any): x is TaxiOpenListDetailNew =>
                typeof (x as TaxiOpenListDetailNew)?.currentRoomId ===
                    "number" &&
                typeof (x as TaxiOpenListDetailNew)?.currentVrid === "number";

            let list: TaxiDestination[] = [];
            let cur: {
                roomId: number;
                virtualRoomId: number;
                virtualName?: string;
            } | null = null;

            if (isNew(d)) {
                // NEW FORMAT
                cur = { roomId: d.currentRoomId, virtualRoomId: d.currentVrid };
                list = (d.destinations || []).map((it) => ({
                    roomId: it.roomId,
                    virtualRoomId: it.virtualRoomId,
                    name: (it.virtualName || "").trim(),
                    thumbnailUrl: it.thumbnailUrl,
                    roomName: it.roomName?.trim(),
                    occupants:
                        typeof it.userCount === "number"
                            ? it.userCount
                            : undefined,
                }));
            } else {
                // OLD FORMAT
                const old = d as TaxiOpenListDetailOld;
                if (old.current) {
                    cur = {
                        roomId: old.current.roomId,
                        virtualRoomId: old.current.virtualRoomId,
                        virtualName: old.current.virtualName,
                    };
                }
                list = (old.destinations || []).map((it) => {
                    const name =
                        it.virtualName?.trim() || it.displayName?.trim() || "";
                    return {
                        roomId: it.roomId,
                        virtualRoomId: it.virtualRoomId,
                        name,
                        thumbnailUrl: it.thumbnailUrl,
                        roomName: it.roomName?.trim(),
                        occupants: it.occupants,
                    };
                });
            }

            setDestinations(list);
            setCurrent(cur);
            setQuery("");
            setOpen(true);
        };

        const onKey = (e: KeyboardEvent) => {
            if (open && e.key === "Escape") setOpen(false);
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
                d.roomName?.toLowerCase().includes(q) ||
                String(d.roomId).includes(q) ||
                String(d.virtualRoomId).includes(q)
        );
    }, [query, destinations]);

    const isHere = useCallback(
        (d: TaxiDestination) =>
            !!current &&
            d.roomId === current.roomId &&
            d.virtualRoomId === current.virtualRoomId,
        [current]
    );

    const onPick = (d: TaxiDestination) => {
        SendMessageComposer(new TaxiRequestComposer(d.roomId, d.virtualRoomId));
        setOpen(false);
    };

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
                            className={`toggle {!grid ? "active" : ""}`}
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
                        placeholder="Search virtual rooms, room names, or IDs…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {/* Current location chip */}
                    {current && (
                        <div
                            className="you-are-here"
                            title="Your current location"
                        >
                            You are here:{" "}
                            <b>
                                {current.virtualName ||
                                    `v${current.virtualRoomId}`}
                            </b>
                        </div>
                    )}
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
                                const here = isHere(d);
                                return (
                                    <button
                                        role="listitem"
                                        key={`${d.roomId}:${d.virtualRoomId}:${idx}`}
                                        className={`tile${here ? " here" : ""}`}
                                        // ⬇ Tooltip now shows virtual room id
                                        title={`${d.name} — v${d.virtualRoomId}`}
                                        onClick={() => onPick(d)}
                                    >
                                        {here && (
                                            <div className="badge">
                                                You are here
                                            </div>
                                        )}
                                        {typeof d.occupants === "number" && (
                                            <div className="count-badge">
                                                {d.occupants}
                                            </div>
                                        )}

                                        <div className="thumbWrap">
                                            <img
                                                className="thumb"
                                                src={src}
                                                loading="lazy"
                                                alt=""
                                                onError={(e) => {
                                                    (
                                                        e.target as HTMLImageElement
                                                    ).style.display = "none";
                                                    const host = (
                                                        e.target as HTMLElement
                                                    ).parentElement;
                                                    host?.classList.add(
                                                        "thumb-fallback"
                                                    );
                                                    host?.setAttribute(
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
                                                {/* ⬇ Show virtual room id instead of physical room id */}
                                                {d.roomName
                                                    ? d.roomName
                                                    : ""}{" "}
                                                v{d.virtualRoomId}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <ul className="taxi-list">
                            {filtered.map((d, idx) => {
                                const here = isHere(d);
                                return (
                                    <li
                                        key={`${d.roomId}:${d.virtualRoomId}:${idx}`}
                                        className={`taxi-row${
                                            here ? " here" : ""
                                        }`}
                                        onClick={() => onPick(d)}
                                        // ⬇ Tooltip uses virtual room id
                                        title={`${d.name} — v${d.virtualRoomId}`}
                                    >
                                        <div className="row-left">
                                            <div className="name">
                                                {d.name}
                                                {here && (
                                                    <span className="here-pill">
                                                        You are here
                                                    </span>
                                                )}
                                            </div>
                                            <div className="meta">
                                                {/* ⬇ Meta line shows VRID */}
                                                {d.roomName
                                                    ? d.roomName
                                                    : "Zone"}{" "}
                                                v{d.virtualRoomId}
                                                {typeof d.occupants ===
                                                    "number" && (
                                                    <> • {d.occupants} online</>
                                                )}
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
                                );
                            })}
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
