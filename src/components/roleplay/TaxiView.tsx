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
    name: string;
    thumbnailUrl?: string;
    roomName?: string;
    occupants?: number;
};

type TaxiOpenListDetailNew = {
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
    destinations: {
        roomId: number;
        virtualRoomId: number;
        roomName?: string;
        virtualName?: string;
        displayName?: string;
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

const THUMB_RESOLVER = (d: TaxiDestination) => d.thumbnailUrl || `/icons/taxi/${d.virtualRoomId}.png`;

function useDraggable<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const dragData = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!ref.current) return;
        const el = ref.current;
        const rect = el.getBoundingClientRect();
        dragData.current = { ox: e.clientX, oy: e.clientY, sx: rect.left, sy: rect.top };

        const onMove = (ev: MouseEvent) => {
            if (!dragData.current) return;
            const dx = ev.clientX - dragData.current.ox;
            const dy = ev.clientY - dragData.current.oy;
            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            const newLeft = Math.min(Math.max(dragData.current.sx + dx, 8), vw - rect.width - 8);
            const newTop = Math.min(Math.max(dragData.current.sy + dy, 8), vh - rect.height - 8);
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
    const [current, setCurrent] = useState<{ roomId: number; virtualRoomId: number; virtualName?: string } | null>(null);

    const { ref: dragRef, onMouseDown: startDrag } = useDraggable<HTMLDivElement>();

    useEffect(() => {
        const onOpen = (e: Event) => {
            const ev = e as CustomEvent<TaxiOpenListDetail>;
            const d = ev.detail;
            const isNew = (x: any): x is TaxiOpenListDetailNew => typeof (x as TaxiOpenListDetailNew)?.currentRoomId === "number" && typeof (x as TaxiOpenListDetailNew)?.currentVrid === "number";
            let list: TaxiDestination[] = [];
            let cur: { roomId: number; virtualRoomId: number; virtualName?: string } | null = null;

            if (isNew(d)) {
                cur = { roomId: d.currentRoomId, virtualRoomId: d.currentVrid };
                list = (d.destinations || []).map((it) => ({
                    roomId: it.roomId,
                    virtualRoomId: it.virtualRoomId,
                    name: (it.virtualName || "").trim(),
                    thumbnailUrl: it.thumbnailUrl,
                    roomName: it.roomName?.trim(),
                    occupants: typeof it.userCount === "number" ? it.userCount : undefined,
                }));
            } else {
                const old = d as TaxiOpenListDetailOld;
                if (old.current) cur = { roomId: old.current.roomId, virtualRoomId: old.current.virtualRoomId, virtualName: old.current.virtualName };
                list = (old.destinations || []).map((it) => ({
                    roomId: it.roomId,
                    virtualRoomId: it.virtualRoomId,
                    name: it.virtualName?.trim() || it.displayName?.trim() || "",
                    thumbnailUrl: it.thumbnailUrl,
                    roomName: it.roomName?.trim(),
                    occupants: it.occupants,
                }));
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
            window.removeEventListener("taxi_open_list", onOpen as EventListener);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return destinations;
        return destinations.filter((d) => d.name.toLowerCase().includes(q) || d.roomName?.toLowerCase().includes(q) || String(d.roomId).includes(q) || String(d.virtualRoomId).includes(q));
    }, [query, destinations]);

    const isHere = useCallback((d: TaxiDestination) => !!current && d.roomId === current.roomId && d.virtualRoomId === current.virtualRoomId, [current]);

    const onPick = (d: TaxiDestination) => {
        SendMessageComposer(new TaxiRequestComposer(d.roomId, d.virtualRoomId));
        setOpen(false);
    };

    const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("");

    if (!open) return null;

    return (
        <>
            <div className="taxi-backdrop" onClick={ () => setOpen(false) } />

            <div
                className="taxi-view enter"
                ref={ dragRef }
                style={ { left: "50%", top: "50%", transform: "translate(-50%, -50%)" } }
                role="dialog"
                aria-modal="true"
                aria-label="Taxi destinations"
            >
                <div className="taxi-header" onMouseDown={ startDrag }>
                    <div className="title">Call a Taxi</div>

                    <button className="close-button" onClick={ () => setOpen(false) } aria-label="Close" title="Close" />
                </div>

                <div className="taxi-toolbar">
                    <input
                        className="search"
                        placeholder="Search destinations..."
                        value={ query }
                        onChange={ (e) => setQuery(e.target.value) }
                        autoFocus
                    />

                    <div className="count">{ filtered.length } Stops</div>
                </div>

                {current && (
                    <div className="taxi-current-strip">
                        Current Location: <strong>{ current.virtualName || `#${current.virtualRoomId}` }</strong>
                    </div>
                )}

                <div className="taxi-body">
                    {filtered.length === 0 && <div className="empty">No matching destinations.</div>}

                    <div className="taxi-grid" role="list">
                        {filtered.map((d, idx) => {
                            const src = THUMB_RESOLVER(d);
                            const here = isHere(d);

                            return (
                                <button
                                    role="listitem"
                                    key={ `${d.roomId}:${d.virtualRoomId}:${idx}` }
                                    className={ `tile${here ? " here" : ""}` }
                                    title={ d.name }
                                    onClick={ () => onPick(d) }
                                >
                                    {here && <div className="badge">You are here</div>}
                                    {typeof d.occupants === "number" && <div className="count-badge">{ d.occupants }</div>}

                                    <div className="thumbWrap">
                                        <img
                                            className="thumb"
                                            src={ src }
                                            loading="lazy"
                                            alt=""
                                            onError={ (e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                                const host = (e.target as HTMLElement).parentElement;
                                                host?.classList.add("thumb-fallback");
                                                host?.setAttribute("data-initials", initials(d.name));
                                            } }
                                        />
                                    </div>

                                    <div className="tile-meta">
                                        <div className="tile-name">{ d.name || `Stop #${d.virtualRoomId}` }</div>
                                        <div className="tile-subtitle">{ d.roomName || `Virtual Room #${d.virtualRoomId}` }</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="taxi-footer">
                    <span className="hint">Tip: press <b>Esc</b> to close</span>
                </div>
            </div>
        </>
    );
};
