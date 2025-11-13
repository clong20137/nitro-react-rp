import React, { FC, useEffect, useRef, useState } from "react";
import "./CommandsListView.scss";

export interface CommandEntry {
    command: string;
    parameters: string;
    description: string;
    category?: string; // <-- make optional; we default it later
}

export const CommandsListView: FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [commands, setCommands] = useState<CommandEntry[]>([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("All");

    // ---- drag state ----
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem("commands-list-pos");
            return saved ? JSON.parse(saved) : { x: 120, y: 120 };
        } catch {
            return { x: 120, y: 120 };
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

        window.addEventListener("open_commands_list", openHandler);
        return () =>
            window.removeEventListener("open_commands_list", openHandler);
    }, []);

    // update data from parser bridge
    useEffect(() => {
        const updateHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | CommandEntry[]
                | undefined;
            if (!detail) return;

            // ensure each entry has a category (fallback to "Generic")
            const normalized = detail.map((cmd) => ({
                ...cmd,
                category: cmd.category || "Generic",
            }));

            setCommands(normalized);
        };

        window.addEventListener(
            "commands_list_update",
            updateHandler as EventListener
        );
        return () =>
            window.removeEventListener(
                "commands_list_update",
                updateHandler as EventListener
            );
    }, []);

    // drag handlers
    const onHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rootRef.current) return;

        setDragging(true);
        dragOffsetRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };

        e.preventDefault();
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;

            const newPos = {
                x: e.clientX - dragOffsetRef.current.x,
                y: e.clientY - dragOffsetRef.current.y,
            };

            setPosition(newPos);
            localStorage.setItem("commands-list-pos", JSON.stringify(newPos));
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
        // match exit animation duration in SCSS (220ms)
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 230);
    };

    // don’t render when fully closed
    if (!isOpen && !isClosing) return null;

    // build category list
    const categories = [
        "All",
        ...Array.from(new Set(commands.map((c) => c.category || "Generic"))),
    ];

    const filtered = commands.filter((cmd) => {
        const cat = cmd.category || "Generic";

        if (categoryFilter !== "All" && cat !== categoryFilter) return false;

        if (!search.trim()) return true;

        const q = search.toLowerCase();

        return (
            cmd.command.toLowerCase().includes(q) ||
            cmd.parameters.toLowerCase().includes(q) ||
            cmd.description.toLowerCase().includes(q)
        );
    });

    return (
        <div
            ref={rootRef}
            className={`commands-list-view ${
                isClosing ? "exit-br" : "enter-br"
            }`}
            style={{ left: position.x, top: position.y }}
        >
            {/* HEADER */}
            <div className="commands-header" onMouseDown={onHeaderMouseDown}>
                <span className="commands-title">Commands List</span>

                {/* little "Generic" pill */}
                <span className="commands-pill">
                    {categoryFilter === "All" ? "Generic" : categoryFilter}
                </span>

                <button
                    className="close-button"
                    onClick={handleClose}
                    aria-label="Close"
                />
            </div>

            {/* CONTENT */}
            <div className="commands-content">
                {/* Search + filter row */}
                <div className="commands-toolbar">
                    <div className="commands-search">
                        <input
                            type="text"
                            placeholder="Search All..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="commands-filter">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="commands-table-wrapper">
                    <table className="commands-table">
                        <thead>
                            <tr>
                                <th className="col-command">COMMAND</th>
                                <th className="col-params">PARAMETERS</th>
                                <th className="col-desc">DESCRIPTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!filtered.length && (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="commands-empty-cell"
                                    >
                                        No commands match your search.
                                    </td>
                                </tr>
                            )}

                            {filtered.map((cmd, index) => (
                                <tr key={index}>
                                    <td className="col-command">
                                        <span className="cmd-name">
                                            {cmd.command}
                                        </span>
                                    </td>
                                    <td className="col-params">
                                        {cmd.parameters || "N/A"}
                                    </td>
                                    <td className="col-desc">
                                        {cmd.description}
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
