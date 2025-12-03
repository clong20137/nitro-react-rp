import React, { FC, useEffect, useRef, useState } from "react";
import "./HotRoomsView.scss";

export interface HotRoomEntry {
    virtualRoomId: number;
    name: string;
    userCount: number;
}

export const HotRoomsView: FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [rooms, setRooms] = useState<HotRoomEntry[]>([]);

    // drag state
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem("hot-rooms-pos");
            return saved ? JSON.parse(saved) : { x: 160, y: 140 };
        } catch {
            return { x: 160, y: 140 };
        }
    });

    const [dragging, setDragging] = useState(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    // open from command / packet
    useEffect(() => {
        const openHandler = () => {
            setIsClosing(false);
            setIsOpen(true);
        };

        window.addEventListener("open_hot_rooms", openHandler);
        return () => window.removeEventListener("open_hot_rooms", openHandler);
    }, []);

    // update list from parser bridge
    useEffect(() => {
        const updateHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | HotRoomEntry[]
                | undefined;
            if (!detail) return;

            // sort client-side (defensive) by userCount desc
            const sorted = [...detail].sort(
                (a, b) => b.userCount - a.userCount
            );
            setRooms(sorted);
        };

        window.addEventListener(
            "hot_rooms_update",
            updateHandler as EventListener
        );

        return () =>
            window.removeEventListener(
                "hot_rooms_update",
                updateHandler as EventListener
            );
    }, []);

    // drag start
    const onHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rootRef.current) return;

        setDragging(true);
        dragOffsetRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };

        e.preventDefault();
    };

    // drag move / end
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;

            const newPos = {
                x: e.clientX - dragOffsetRef.current.x,
                y: e.clientY - dragOffsetRef.current.y,
            };

            setPosition(newPos);
            localStorage.setItem("hot-rooms-pos", JSON.stringify(newPos));
        };

        const onMouseUp = () => setDragging(false);

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 230); // match exit animation
    };

    if (!isOpen && !isClosing) return null;

    const totalUsers = rooms.reduce((sum, r) => sum + r.userCount, 0);

    return (
        <div
            ref={rootRef}
            className={`hot-rooms-view ${isClosing ? "exit-br" : "enter-br"}`}
            style={{ left: position.x, top: position.y }}
        >
            {/* HEADER */}
            <div className="hot-rooms-header" onMouseDown={onHeaderMouseDown}>
                <span className="hot-rooms-title">Hot Rooms</span>

                <span className="hot-rooms-pill">
                    {totalUsers}{" "}
                    {totalUsers === 1 ? "User Online" : "Users Online"}
                </span>

                <button
                    className="close-button"
                    onClick={handleClose}
                    aria-label="Close"
                />
            </div>

            {/* CONTENT */}
            <div className="hot-rooms-content">
                {/* Small summary bar */}
                <div className="hot-rooms-summary">
                    <span>
                        Active Zones: <strong>{rooms.length}</strong>
                    </span>
                </div>

                {/* Table */}
                <div className="hot-rooms-table-wrapper">
                    <table className="hot-rooms-table">
                        <thead>
                            <tr>
                                <th className="col-id">Room ID:</th>
                                <th className="col-name">Location Name:</th>
                                <th className="col-users">Total Users:</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!rooms.length && (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="hot-rooms-empty-cell"
                                    >
                                        There are no active zones right now.
                                    </td>
                                </tr>
                            )}

                            {rooms.map((room, index) => (
                                <tr key={index}>
                                    <td className="col-id">
                                        <span className="vroom-id">
                                            #{room.virtualRoomId}
                                        </span>
                                    </td>
                                    <td className="col-name">
                                        <span className="vroom-name">
                                            {room.name}
                                        </span>
                                    </td>
                                    <td className="col-users">
                                        <span className="vroom-users">
                                            {room.userCount}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
