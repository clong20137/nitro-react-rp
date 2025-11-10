import { FC, useEffect, useRef, useState } from "react";
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

const POS_KEY = "police_call_view_pos";
const MODAL_W = 500;
const MODAL_H = 220; // visual estimate for initial clamp

export const PoliceCallView: FC = () => {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<PoliceCallPayload | null>(null);
    const [reportText, setReportText] = useState("");

    // drag state
    const [pos, setPos] = useState<Pos | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef<{ on: boolean; dx: number; dy: number }>({
        on: false,
        dx: 0,
        dy: 0,
    });

    /* ---------------- helpers ---------------- */

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
        // center fallback
        const left = Math.round(window.innerWidth / 2 - MODAL_W / 2);
        const top = Math.round(window.innerHeight / 2 - MODAL_H / 2);
        return clampPos(left, top);
    };

    /* ---------------- event wiring ---------------- */

    // Listen for: window.dispatchEvent(new CustomEvent('open_police_call', { detail: {...} }))
    useEffect(() => {
        const onOpen = (e: Event) => {
            const { detail } = e as CustomEvent<PoliceCallPayload>;
            if (!detail) return;

            setData({
                username: detail.username ?? "",
                figure: detail.figure ?? "",
                message: detail.message ?? "",
                virtualRoomId: Number(detail.virtualRoomId ?? 0),
                virtualRoomName: detail.virtualRoomName ?? "",
            });
            setReportText("");
            setOpen(true);
            setPos(loadOrCenter());
        };

        window.addEventListener("open_police_call", onOpen as EventListener);
        return () => {
            window.removeEventListener(
                "open_police_call",
                onOpen as EventListener
            );
        };
    }, []);

    // Re-clamp on resize so the window never gets lost offscreen
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

    /* ---------------- drag (mouse + touch) ---------------- */

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

    /* ---------------- actions ---------------- */

    const accept = () => {
        try {
            SendMessageComposer(
                new AcceptPoliceCallComposer(
                    data.username,
                    data.virtualRoomId,
                    data.virtualRoomName
                )
            );
        } catch (e) {
            console.warn("[PoliceCallView] Accept failed:", e);
        }
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

    // Inline style to override the center-translate when draggable
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
            {/* Header (drag handle) */}
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
                >
                    ✕
                </button>
            </div>

            {/* Body */}
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

                    <div
                        className="room-link"
                        title={`Virtual Room #${data.virtualRoomId}`}
                    >
                        #{data.virtualRoomId} — {data.virtualRoomName}
                    </div>

                    <div className="action-buttons">
                        <div className="police-call-buttons">
                            <button
                                className="habbo-action-button green"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    accept();
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
        </div>
    );
};

export default PoliceCallView;
