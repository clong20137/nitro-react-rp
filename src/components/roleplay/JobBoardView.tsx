import React, { FC, useEffect, useRef, useState } from "react";
import "./JobBoardView.scss";

import { SendMessageComposer } from "../../api";
import {
    ICorpJobOpeningData,
    ICorpRankOption,
} from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/OpenCorpJobBoardParser";
import { JobBoardCreateOpeningComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JobBoardCreateOpeningComposer";
import { JobBoardApplyComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JobBoardApplyComposer";
import { JobBoardCloseOpeningComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JobBoardCloseOpeningComposer";

/* ---- Data coming from the parser + bridge ---- */
interface JobBoardData {
    corpId: number;
    corpName: string;
    isManager: boolean;
    openings: ICorpJobOpeningData[];
    ranks: ICorpRankOption[]; // <-- available ranks for this corp
}

export const JobBoardView: FC = () => {
    const [visible, setVisible] = useState(false);
    const [data, setData] = useState<JobBoardData | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    // manager create form
    const [selectedRankId, setSelectedRankId] = useState<number | null>(null);
    const [newSlots, setNewSlots] = useState<string>("1");

    /* ---- LISTEN FOR BRIDGE EVENT ---- */
    useEffect(() => {
        const onOpen = (e: CustomEvent<JobBoardData>) => {
            if (!e.detail) return;

            // Filter out Supervisor / Manager ranks (do not show them anywhere)
            const filteredRanks = (e.detail.ranks || []).filter(
                (r: any) => !r?.isSupervisor && !r?.isManager
            );

            const next: JobBoardData = {
                ...e.detail,
                ranks: filteredRanks,
            };

            setData(next);

            // default to first rank if manager & ranks exist
            if (next.isManager && next.ranks.length > 0) {
                setSelectedRankId(next.ranks[0].id);
            } else {
                setSelectedRankId(null);
            }

            setVisible(true);
        };

        window.addEventListener("corp_jobboard_open", onOpen as EventListener);

        return () =>
            window.removeEventListener(
                "corp_jobboard_open",
                onOpen as EventListener
            );
    }, []);

    /* ---- DRAGGABLE WINDOW ---- */
    useEffect(() => {
        if (!visible) return;

        const root = rootRef.current;
        if (!root) return;

        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const header = root.querySelector(".jobboard-header") as HTMLElement;
        if (!header) return;

        const onDown = (ev: MouseEvent) => {
            dragging = true;
            const rect = root.getBoundingClientRect();
            offsetX = ev.clientX - rect.left;
            offsetY = ev.clientY - rect.top;
            header.style.cursor = "grabbing";
        };

        const onMove = (ev: MouseEvent) => {
            if (!dragging) return;
            root.style.left = `${ev.clientX - offsetX}px`;
            root.style.top = `${ev.clientY - offsetY}px`;
        };

        const onUp = () => {
            dragging = false;
            header.style.cursor = "grab";
        };

        header.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        return () => {
            header.removeEventListener("mousedown", onDown);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [visible]);

    if (!visible || !data) return null;

    /* ----- ACTIONS ----- */
    const close = () => setVisible(false);

    const onApply = (id: number) => {
        SendMessageComposer(new JobBoardApplyComposer(id));
    };

    const onClose = (id: number, isOpen: boolean) => {
        if (!isOpen) return;
        SendMessageComposer(new JobBoardCloseOpeningComposer(id));
    };

    // Managers only: delete = close (server only has "close", UI labels as Delete)
    const onDelete = (id: number) => {
        SendMessageComposer(new JobBoardCloseOpeningComposer(id));
    };

    const onCreate = () => {
        if (!data || !data.isManager) return;
        if (selectedRankId === null) return;

        const rank = data.ranks.find((r) => r.id === selectedRankId);
        if (!rank) return;

        const slots = Math.max(1, parseInt(newSlots) || 1);

        // IMPORTANT: we send the rank name as the title, server stays the same
        SendMessageComposer(
            new JobBoardCreateOpeningComposer(rank.name, slots)
        );

        setNewSlots("1");
    };

    const totalOpenSlots = data.openings.reduce(
        (sum, o) => sum + (o.isOpen ? o.openSlots : 0),
        0
    );

    return (
        <div
            className="jobboard-view enter-br"
            ref={rootRef}
            style={{ left: 100, top: 400 }}
        >
            <div className="jobboard-header">
                <div className="jobboard-title">
                    {data.corpName} – Job Board
                </div>
                <div className="close-button" onClick={close}></div>
            </div>

            <div className="jobboard-content">
                <div className="jobboard-summary">
                    {data.isManager ? (
                        <>
                            <strong>Manager Mode</strong> — Manage job openings.
                        </>
                    ) : (
                        <>
                            <strong>Now Hiring</strong> — {totalOpenSlots} open
                            position{totalOpenSlots === 1 ? "" : "s"}.
                        </>
                    )}
                </div>

                {/* MANAGER CREATE FORM – rank dropdown ONLY */}
                {data.isManager && (
                    <div className="jobboard-create">
                        <select
                            className="jobboard-input rank-select"
                            value={selectedRankId ?? ""}
                            onChange={(e) =>
                                setSelectedRankId(
                                    e.target.value
                                        ? parseInt(e.target.value)
                                        : null
                                )
                            }
                        >
                            {data.ranks.length === 0 && (
                                <option value="">No ranks available</option>
                            )}

                            {data.ranks.length > 0 && (
                                <>
                                    <option value="">Select a rank…</option>
                                    {data.ranks.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.name}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>

                        <input
                            className="jobboard-input slots-input"
                            type="number"
                            min={1}
                            max={99}
                            value={newSlots}
                            onChange={(e) => setNewSlots(e.target.value)}
                        />

                        <button
                            className="jobboard-btn btn-create"
                            onClick={onCreate}
                            disabled={
                                selectedRankId === null ||
                                data.ranks.length === 0
                            }
                        >
                            Add
                        </button>
                    </div>
                )}

                {/* TABLE */}
                <div className="jobboard-table-wrapper">
                    <table className="jobboard-table">
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>Slots</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {data.openings.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="jobboard-empty-cell"
                                    >
                                        No job listings yet.
                                    </td>
                                </tr>
                            )}

                            {data.openings.map((o) => (
                                <tr key={o.id}>
                                    <td>
                                        {o.title}
                                        {!o.isOpen && (
                                            <span className="job-chip closed">
                                                Closed
                                            </span>
                                        )}
                                    </td>

                                    <td>{o.isOpen ? o.openSlots : 0}</td>

                                    <td>
                                        {data.isManager ? (
                                            <div className="jobboard-actions">
                                                <button
                                                    className="jobboard-btn btn-close"
                                                    disabled={!o.isOpen}
                                                    onClick={() =>
                                                        onClose(o.id, o.isOpen)
                                                    }
                                                >
                                                    Close
                                                </button>

                                                {/* Managers only: Delete button */}
                                                <button
                                                    className="jobboard-btn btn-delete"
                                                    onClick={() =>
                                                        onDelete(o.id)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="jobboard-btn btn-apply"
                                                disabled={
                                                    !o.isOpen ||
                                                    o.openSlots <= 0
                                                }
                                                onClick={() => onApply(o.id)}
                                            >
                                                Apply
                                            </button>
                                        )}
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
