import React, { FC, useEffect, useRef, useState } from "react";
import "./JobBoardView.scss";

import { SendMessageComposer } from "../../api";
import { ICorpJobOpeningData } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/OpenCorpJobBoardParser";
import { JobBoardCreateOpeningComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JobBoardCreateOpeningComposer";
import { JobBoardApplyComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JobBoardApplyComposer";
import { JobBoardCloseOpeningComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/JobBoardCloseOpeningComposer";

/* ---- Data coming from the parser ---- */
interface JobBoardData {
    corpId: number;
    corpName: string;
    isManager: boolean;
    openings: ICorpJobOpeningData[];
}

export const JobBoardView: FC = () => {
    const [visible, setVisible] = useState(false);
    const [data, setData] = useState<JobBoardData | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const [newTitle, setNewTitle] = useState("");
    const [newSlots, setNewSlots] = useState<string>("1");

    /* ---- LISTEN FOR BRIDGE EVENT ---- */
    useEffect(() => {
        const onOpen = (e: CustomEvent<JobBoardData>) => {
            if (!e.detail) return;
            setData(e.detail);
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

    const onToggle = (id: number, isOpen: boolean) => {
        // if open → close
        SendMessageComposer(new JobBoardCloseOpeningComposer(id));
    };

    const onCreate = () => {
        const title = newTitle.trim();
        const slots = Math.max(1, parseInt(newSlots) || 1);

        if (!title) return;

        SendMessageComposer(new JobBoardCreateOpeningComposer(title, slots));
        setNewTitle("");
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
            style={{ left: 40, top: 40 }}
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

                {/* MANAGER CREATE FORM */}
                {data.isManager && (
                    <div className="jobboard-create">
                        <input
                            className="jobboard-input"
                            placeholder="Position title…"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                        />
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
                            disabled={!newTitle.trim()}
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
                                            <button
                                                className="jobboard-btn btn-close"
                                                disabled={!o.isOpen}
                                                onClick={() =>
                                                    onToggle(o.id, o.isOpen)
                                                }
                                            >
                                                Close
                                            </button>
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
