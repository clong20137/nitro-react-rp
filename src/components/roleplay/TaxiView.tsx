import React, {
    FC,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { SendMessageComposer } from "../../api";
import { TaxiRequestComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/TaxiRequestComposer";
import "./TaxiView.scss";

interface TaxiDestination {
    roomId: number;
    virtualRoomId: number;
    name: string;
    roomName?: string;
    occupants?: number;
}

interface TaxiOpenListDetailNew {
    currentRoomId: number;
    currentVrid: number;
    destinations: {
        roomId: number;
        virtualRoomId: number;
        virtualName: string;
        userCount?: number;
        roomName?: string;
    }[];
}

interface TaxiOpenListDetailOld {
    destinations: {
        roomId: number;
        virtualRoomId: number;
        roomName?: string;
        virtualName?: string;
        displayName?: string;
        occupants?: number;
    }[];
    current?: {
        roomId: number;
        virtualRoomId: number;
        virtualName?: string;
    };
}

type TaxiOpenListDetail = TaxiOpenListDetailNew | TaxiOpenListDetailOld;

interface TaxiViewProps {
    onClose?: () => void;
}

const POPULATION_IMAGES = {
    low: "/icons/taxi/population-low.png",
    medium: "/icons/taxi/population-medium.png",
    active: "/icons/taxi/population-active.png",
    crowded: "/icons/taxi/population-crowded.png",
};

const getPopulationState = (occupants = 0) => {
    if (occupants >= 26) {
        return {
            image: POPULATION_IMAGES.crowded,
            className: "crowded",
        };
    }

    if (occupants >= 16) {
        return {
            image: POPULATION_IMAGES.active,
            className: "active",
        };
    }

    if (occupants >= 6) {
        return {
            image: POPULATION_IMAGES.medium,
            className: "medium",
        };
    }

    return {
        image: POPULATION_IMAGES.low,
        className: "low",
    };
};

export const TaxiView: FC<TaxiViewProps> = ({ onClose }) => {
    const [open, setOpen] = useState(false);
    const [destinations, setDestinations] = useState<TaxiDestination[]>([]);
    const [current, setCurrent] = useState<{
        roomId: number;
        virtualRoomId: number;
        virtualName?: string;
    } | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [headerGrabbing, setHeaderGrabbing] = useState(false);

    const winRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);

    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem("taxiModulePos");
            if (saved) return JSON.parse(saved);
        } catch {}
        return {
            x: Math.round(window.innerWidth * 0.18),
            y: 110,
        };
    });

    const clamp = useCallback((x: number, y: number) => {
        const w = winRef.current?.offsetWidth ?? 520;
        const h = winRef.current?.offsetHeight ?? 540;
        const pad = 8;
        const maxX = Math.max(pad, window.innerWidth - w - pad);
        const maxY = Math.max(pad, window.innerHeight - h - pad);

        return {
            x: Math.min(Math.max(pad, Math.round(x)), maxX),
            y: Math.min(Math.max(pad, Math.round(y)), maxY),
        };
    }, []);

    const startDrag = (cx: number, cy: number) => {
        if (isClosing) return;

        const rect = winRef.current?.getBoundingClientRect();
        const curX = rect?.left ?? position.x;
        const curY = rect?.top ?? position.y;

        dragRef.current = {
            dx: cx - curX,
            dy: cy - curY,
        };

        setHeaderGrabbing(true);
    };

    const moveDrag = (cx: number, cy: number) => {
        if (!dragRef.current || isClosing) return;

        const nx = cx - dragRef.current.dx;
        const ny = cy - dragRef.current.dy;
        const clamped = clamp(nx, ny);

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setPosition(clamped));
    };

    const stopDrag = () => {
        dragRef.current = null;
        setHeaderGrabbing(false);

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsOpen(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("taxiModulePos", JSON.stringify(position));
        } catch {}
    }, [position]);

    useEffect(() => {
        const onOpen = (e: Event) => {
            const ev = e as CustomEvent<TaxiOpenListDetail>;
            const data = ev.detail;

            const isNew = (x: any): x is TaxiOpenListDetailNew =>
                typeof x?.currentRoomId === "number" &&
                typeof x?.currentVrid === "number";

            let list: TaxiDestination[] = [];
            let cur: {
                roomId: number;
                virtualRoomId: number;
                virtualName?: string;
            } | null = null;

            if (isNew(data)) {
                cur = {
                    roomId: data.currentRoomId,
                    virtualRoomId: data.currentVrid,
                };

                list = (data.destinations || []).map((dest) => ({
                    roomId: dest.roomId,
                    virtualRoomId: dest.virtualRoomId,
                    name: (dest.virtualName || "").trim(),
                    roomName: dest.roomName?.trim(),
                    occupants:
                        typeof dest.userCount === "number" ? dest.userCount : 0,
                }));
            } else {
                const oldData = data as TaxiOpenListDetailOld;

                if (oldData.current) {
                    cur = {
                        roomId: oldData.current.roomId,
                        virtualRoomId: oldData.current.virtualRoomId,
                        virtualName: oldData.current.virtualName,
                    };
                }

                list = (oldData.destinations || []).map((dest) => ({
                    roomId: dest.roomId,
                    virtualRoomId: dest.virtualRoomId,
                    name:
                        dest.virtualName?.trim() ||
                        dest.displayName?.trim() ||
                        "",
                    roomName: dest.roomName?.trim(),
                    occupants:
                        typeof dest.occupants === "number" ? dest.occupants : 0,
                }));
            }

            setDestinations(list);
            setCurrent(cur);
            setOpen(true);
            setIsClosing(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (open && e.key === "Escape") handleClose();
        };

        window.addEventListener("taxi_open_list", onOpen as EventListener);
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener(
                "taxi_open_list",
                onOpen as EventListener,
            );
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        moveDrag(e.clientX, e.clientY);
    }, []);

    const onMouseUp = useCallback(() => {
        stopDrag();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    }, [onMouseMove]);

    const onTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        if (t) moveDrag(t.clientX, t.clientY);
    }, []);

    const onTouchEnd = useCallback(() => {
        stopDrag();
        window.removeEventListener("touchmove", onTouchMove as EventListener);
        window.removeEventListener("touchend", onTouchEnd as EventListener);
    }, [onTouchMove]);

    const onHeaderMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    const onHeaderTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;

        startDrag(t.clientX, t.clientY);
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
    };

    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener(
                "touchmove",
                onTouchMove as EventListener,
            );
            window.removeEventListener("touchend", onTouchEnd as EventListener);

            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (closeTimerRef.current)
                window.clearTimeout(closeTimerRef.current);
        };
    }, [onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

    const isHere = useCallback(
        (destination: TaxiDestination) => {
            return (
                !!current &&
                destination.roomId === current.roomId &&
                destination.virtualRoomId === current.virtualRoomId
            );
        },
        [current],
    );

    const sortedDestinations = useMemo(() => {
        const list = [...destinations];

        list.sort((a, b) => {
            const aHere = isHere(a) ? 1 : 0;
            const bHere = isHere(b) ? 1 : 0;

            if (aHere !== bHere) return bHere - aHere;

            const aUsers = a.occupants || 0;
            const bUsers = b.occupants || 0;

            if (aUsers !== bUsers) return bUsers - aUsers;

            return a.name.localeCompare(b.name);
        });

        return list;
    }, [destinations, isHere]);

    const handleDestinationClick = (destination: TaxiDestination) => {
        if (isClosing) return;

        SendMessageComposer(
            new TaxiRequestComposer(
                destination.roomId,
                destination.virtualRoomId,
            ),
        );
        handleClose();
    };

    const handleClose = () => {
        if (isClosing) return;

        stopDrag();
        setIsOpen(false);
        setIsClosing(true);

        closeTimerRef.current = window.setTimeout(() => {
            setOpen(false);
            onClose?.();
        }, 190);
    };

    if (!open) return null;

    return (
        <div
            ref={winRef}
            className={`taxi-module ${isOpen ? "is-open" : ""} ${isClosing ? "is-closing" : ""}`}
            style={{ position: "absolute", left: position.x, top: position.y }}
            role="dialog"
            aria-label="Taxi"
        >
            <div
                className={`taxi-header ${headerGrabbing ? "is-grabbing" : ""}`}
                onMouseDown={onHeaderMouseDown}
                onTouchStart={onHeaderTouchStart}
                aria-grabbed={headerGrabbing}
            >
                Taxi
                <div className="taxi-header-buttons">
                    <button
                        type="button"
                        className="taxi-close"
                        aria-label="Close taxi"
                        onClick={handleClose}
                    />
                </div>
            </div>

            <div className="taxi-content">
                <div className="taxi-list">
                    {sortedDestinations.map((destination, index) => {
                        const population = getPopulationState(
                            destination.occupants || 0,
                        );
                        const here = isHere(destination);

                        return (
                            <button
                                key={`${destination.roomId}-${destination.virtualRoomId}-${index}`}
                                className={`taxi-row ${here ? "is-current" : ""}`}
                                onClick={() =>
                                    handleDestinationClick(destination)
                                }
                                type="button"
                            >
                                <div
                                    className={`taxi-row-population ${population.className}`}
                                >
                                    <img
                                        src={population.image}
                                        alt=""
                                        className="taxi-population-icon"
                                        draggable={false}
                                    />
                                    <div className="taxi-user-count">
                                        {destination.occupants || 0}
                                    </div>
                                </div>

                                <div className="taxi-row-main">
                                    <div className="taxi-room-title">
                                        {destination.name || "Unknown Location"}
                                        <span className="taxi-room-id">
                                            #{destination.virtualRoomId}
                                        </span>
                                    </div>

                                    {destination.roomName && (
                                        <div className="taxi-room-subtitle">
                                            {destination.roomName}
                                        </div>
                                    )}
                                </div>

                                {here && (
                                    <div className="taxi-current-pill">
                                        Current
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {!sortedDestinations.length && (
                        <div className="taxi-empty">
                            No taxi destinations available.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaxiView;
