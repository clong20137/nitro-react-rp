import React, { FC, useEffect, useRef, useState } from "react";
import { SendMessageComposer } from "../../api";
import { ReportPoliceCallComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ReportPoliceCallComposer";
import { AcceptPoliceCallComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/AcceptPoliceCallComposer";
import "./PoliceCallView.scss";

type PoliceCallPayload = {
    username: string;
    figure: string;
    message: string;
    virtualRoomId: number;
    virtualRoomName: string;
};

type Pos = { left: number; top: number };
type CallStatus = "pending" | "accepted" | "closed";

type TrackedCall = {
    id: number;
    payload: PoliceCallPayload;
    createdAt: number;
    status: CallStatus;
};

const POS_KEY = "police_call_view_pos";
const MODAL_W = 500;
const MODAL_H = 320;

const CALL_TTL_MS = 5 * 60 * 1000; // ✅ 5 minutes

export const PoliceCallView: FC = () => {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<PoliceCallPayload | null>(null);
    const [reportText, setReportText] = useState("");
    const [calls, setCalls] = useState<TrackedCall[]>([]);
    const [nowTs, setNowTs] = useState<number>(Date.now());

    const [pos, setPos] = useState<Pos | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef<{ on: boolean; dx: number; dy: number }>({
        on: false,
        dx: 0,
        dy: 0,
    });

    const clampPos = (left: number, top: number) => {
        const el = rootRef.current;
        const w = el ? el.offsetWidth : MODAL_W;
        const h = el ? el.offsetHeight : MODAL_H;
        return {
            left: Math.max(8, Math.min(window.innerWidth - w - 8, left)),
            top: Math.max(8, Math.min(window.innerHeight - h - 8, top)),
        };
    };

    const savePos = (p: Pos) => {
        try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {}
    };

    const loadOrCenter = () => {
        try {
            const saved = localStorage.getItem(POS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as Pos;
                return clampPos(parsed.left, parsed.top);
            }
        } catch {}
        const left = Math.round(window.innerWidth / 2 - MODAL_W / 2);
        const top = Math.round(window.innerHeight / 2 - MODAL_H / 2);
        return clampPos(left, top);
    };

    const formatElapsed = (createdAt: number): string => {
        let diffMs = nowTs - createdAt;
        if (diffMs < 0) diffMs = 0;
        const totalSec = Math.floor(diffMs / 1000);
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec % 60;
        return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    };

    // tick for elapsed + TTL checks
    useEffect(() => {
        const id = window.setInterval(() => setNowTs(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    // ✅ mark calls closed after 5 min
    useEffect(() => {
        setCalls((prev) =>
            prev.map((c) => {
                if (
                    c.status === "pending" &&
                    nowTs - c.createdAt > CALL_TTL_MS
                ) {
                    return { ...c, status: "closed" as CallStatus };
                }
                return c;
            })
        );

        // if currently open call is now expired, close the modal
        if (open && data) {
            const match = calls.find(
                (c) =>
                    c.payload.username === data.username &&
                    c.createdAt && // just in case
                    c.payload.virtualRoomId === data.virtualRoomId
            );
            if (match && match.status === "closed") {
                setOpen(false);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nowTs]);

    // ✅ open from LiveFeed button
    useEffect(() => {
        const onOpen = (e: Event) => {
            const { detail } = e as CustomEvent<any>;
            if (!detail) return;

            const normalized: PoliceCallPayload = {
                username: String(detail.username ?? ""),
                figure: String(detail.figure ?? ""),
                message: String(detail.message ?? ""),
                virtualRoomId: Number(detail.virtualRoomId) || 0,
                virtualRoomName: String(detail.virtualRoomName || ""),
            };

            const now = Date.now();
            const newCall: TrackedCall = {
                id: now,
                payload: normalized,
                createdAt: now,
                status: "pending",
            };

            setCalls((prev) => [newCall, ...prev]);
            setData(normalized);
            setReportText("");
            setOpen(true);
            setPos(loadOrCenter());
        };

        window.addEventListener("open_police_call", onOpen as EventListener);
        return () =>
            window.removeEventListener(
                "open_police_call",
                onOpen as EventListener
            );
    }, []);

    // Re-clamp on resize
    useEffect(() => {
        const onResize = () => {
            if (!pos) return;
            const next = clampPos(pos.left, pos.top);
            setPos(next);
            savePos(next);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [pos]);

    if (!open || !data) return null;

    const startDragAt = (clientX: number, clientY: number) => {
        const el = rootRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        dragState.current.on = true;
        dragState.current.dx = clientX - rect.left;
        dragState.current.dy = clientY - rect.top;
    };

    const moveDragTo = (clientX: number, clientY: number) => {
        if (!dragState.current.on) return;
        const left = clientX - dragState.current.dx;
        const top = clientY - dragState.current.dy;
        const next = clampPos(left, top);
        setPos(next);
        savePos(next);
    };

    const stopDrag = () => {
        dragState.current.on = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
    };

    const onMouseDown = (e: React.MouseEvent) => {
        startDragAt(e.clientX, e.clientY);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };
    const onMouseMove = (e: MouseEvent) => moveDragTo(e.clientX, e.clientY);
    const onMouseUp = () => stopDrag();

    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        startDragAt(t.clientX, t.clientY);
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
        window.addEventListener("touchcancel", onTouchEnd);
    };
    const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        e.preventDefault();
        moveDragTo(t.clientX, t.clientY);
    };
    const onTouchEnd = () => stopDrag();

    const acceptCall = (payload: PoliceCallPayload) => {
        try {
            SendMessageComposer(
                new AcceptPoliceCallComposer(
                    payload.username,
                    payload.virtualRoomId,
                    payload.virtualRoomName
                )
            );
        } catch (e) {
            console.warn("[PoliceCallView] Accept failed:", e);
        }

        setCalls((prev) =>
            prev.map((c) =>
                c.payload.username === payload.username &&
                c.payload.virtualRoomId === payload.virtualRoomId &&
                c.status === "pending"
                    ? { ...c, status: "accepted" }
                    : c
            )
        );

        setOpen(false);
    };

    const sendReport = () => {
        try {
            const msg = reportText.trim();
            SendMessageComposer(
                new ReportPoliceCallComposer(
                    data.username,
                    data.virtualRoomId,
                    msg
                )
            );
        } catch (e) {
            console.warn("[PoliceCallView] Report failed:", e);
        }
        setOpen(false);
    };

    const style: React.CSSProperties | undefined = pos
        ? { position: "fixed", left: pos.left, top: pos.top, transform: "none" }
        : undefined;

    return (
        <div
            ref={rootRef}
            className="police-call-view"
            role="dialog"
            aria-modal="true"
            aria-label="Police Call"
            style={style}
        >
            <div
                className="module-header"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                style={{ userSelect: "none", cursor: "move" }}
            >
                <span>Police Call</span>
                <button
                    className="close-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                    }}
                    aria-label="Close"
                />
            </div>

            <div className="call-body">
                <img
                    className="full-avatar"
                    src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                        data.figure
                    )}&direction=2&gesture=std&action=std&size=m`}
                    alt={`${data.username}'s avatar`}
                    draggable={false}
                />

                <div className="call-info">
                    <div className="username_request">{data.username}</div>
                    <div className="message_request">{data.message}</div>

                    {/* ✅ show the CALLER’s VR info (must come from packet) */}
                    <div
                        className="room-link"
                        title={`Virtual Room #${data.virtualRoomId || "?"}`}
                    >
                        #{data.virtualRoomId || "?"} —{" "}
                        {data.virtualRoomName || "Unknown"}
                    </div>

                    <textarea
                        className="call-report-input"
                        placeholder="Optional report / notes..."
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                    />

                    <div className="action-buttons">
                        <div className="police-call-buttons">
                            <button
                                className="habbo-action-button green"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    acceptCall(data);
                                }}
                            >
                                Accept
                            </button>
                            <button
                                className="habbo-action-button red"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    sendReport();
                                }}
                            >
                                Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="call-log">
                <div className="call-log-header">
                    <span>Active Calls</span>
                    <span className="count">({calls.length})</span>
                </div>

                <div className="call-log-table">
                    <div className="call-log-row call-log-row--head">
                        <div className="col-user">User</div>
                        <div className="col-room">Location</div>
                        <div className="col-time">Time</div>
                        <div className="col-status">Status</div>
                    </div>

                    {calls.map((c) => (
                        <div
                            key={c.id}
                            className={`call-log-row ${
                                data.username === c.payload.username &&
                                data.virtualRoomId === c.payload.virtualRoomId
                                    ? "is-selected"
                                    : ""
                            }`}
                            onClick={() => setData(c.payload)}
                        >
                            <div className="col-user">{c.payload.username}</div>
                            <div className="col-room">
                                #{c.payload.virtualRoomId || "?"} –{" "}
                                {c.payload.virtualRoomName || "Unknown"}
                            </div>
                            <div className="col-time">
                                {formatElapsed(c.createdAt)}
                            </div>

                            <div
                                className="col-status"
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    justifyContent: "flex-end",
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    className={`status-pill status-${c.status}`}
                                >
                                    {c.status === "pending"
                                        ? "Pending"
                                        : c.status === "accepted"
                                        ? "Accepted"
                                        : "Closed"}
                                </span>

                                {/* ✅ Respond button next to Pending */}
                                {c.status === "pending" && (
                                    <button
                                        className="habbo-action-button green"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            acceptCall(c.payload);
                                        }}
                                        style={{
                                            padding: "2px 8px",
                                            fontSize: 11,
                                        }}
                                    >
                                        Respond
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PoliceCallView;
