import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./CorporationsView.scss";
// import { SendMessageComposer } from "../../api";
import { GetCorporationMembersComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetCorporationMembersComposer";
import { SendMessageComposer } from "../../api";



interface CorporationsViewProps {
    onClose: () => void;
}

interface Corporation {
    id: number;
    name: string;
    desc?: string;
    icon?: string;
    stock?: number;
}

interface CorpMember {
    userId: number;
    username: string;
    figure: string; // habbo figure string
    rankId: number;
    rankName: string;
    rankOrder: number; // bigger = higher
    pay?: number; // optional if you send it
    weeklyShifts?: number;
    totalShifts?: number;
    lastSeenAgo?: string; // optional e.g. "7hrs ago"
}

interface RankGroup {
    rankId: number;
    rankName: string;
    rankOrder: number;
    pay?: number;
    members: CorpMember[];
}

type Pos = { x: number; y: number };
const STORAGE_KEY = "olrp.corporations.pos";

export const CorporationsView: FC<CorporationsViewProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [corporations, setCorporations] = useState<Corporation[]>([]);
    const [selectedCorpId, setSelectedCorpId] = useState<number | null>(null);

    // members state
    const [membersLoading, setMembersLoading] = useState(false);
    const [rankGroups, setRankGroups] = useState<RankGroup[]>([]);

    // Dragging state
    const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
    const posRef = useRef<Pos>(pos);
    useEffect(() => {
        posRef.current = pos;
    }, [pos]);

    const [dragging, setDragging] = useState(false);
    const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
    const sizeRef = useRef<{ w: number; h: number }>({ w: 650, h: 420 });

    const rootRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);

    // Measure for clamping
    useLayoutEffect(() => {
        if (!rootRef.current) return;
        const ro = new ResizeObserver(([entry]) => {
            const cr = entry.contentRect;
            sizeRef.current = { w: cr.width, h: cr.height };
            setPos((p) => clampToViewport(p, sizeRef.current));
        });
        ro.observe(rootRef.current);
        return () => ro.disconnect();
    }, []);

    // Restore / center
    useEffect(() => {
        requestAnimationFrame(() => {
            const saved = safeGet<Pos>(STORAGE_KEY);
            const target = saved ?? getCenteredPosition(sizeRef.current);
            setPos(clampToViewport(target, sizeRef.current));
        });
    }, []);

    // Re-clamp on resize
    useEffect(() => {
        const onResize = () =>
            setPos((p) => clampToViewport(p, sizeRef.current));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Corporations list (already working in your app)
    useEffect(() => {
        const onCorps = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const corps: Corporation[] = detail?.corporations ?? detail ?? [];
            setCorporations(corps);
            setLoading(false);
        };
        window.addEventListener(
            "corporations_list_result",
            onCorps as EventListener
        );
        document.addEventListener(
            "corporations_list_result",
            onCorps as EventListener
        );
        return () => {
            window.removeEventListener(
                "corporations_list_result",
                onCorps as EventListener
            );
            document.removeEventListener(
                "corporations_list_result",
                onCorps as EventListener
            );
        };
    }, []);

    // Members result listener (DOM bridge version)
    useEffect(() => {
        const onMembers = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const members: CorpMember[] = detail?.members ?? detail ?? [];
            const grouped = groupMembersByRank(members);
            setRankGroups(grouped);
            setMembersLoading(false);
        };
        window.addEventListener(
            "corporation_members_result",
            onMembers as EventListener
        );
        document.addEventListener(
            "corporation_members_result",
            onMembers as EventListener
        );
        return () => {
            window.removeEventListener(
                "corporation_members_result",
                onMembers as EventListener
            );
            document.removeEventListener(
                "corporation_members_result",
                onMembers as EventListener
            );
        };
    }, []);

    // Drag
    useEffect(() => {
        const header = headerRef.current;
        if (!header || !rootRef.current) return;

        const onMouseDown = (e: MouseEvent) => {
            const rect = rootRef.current!.getBoundingClientRect();
            dragOffsetRef.current = {
                dx: e.clientX - rect.left,
                dy: e.clientY - rect.top,
            };
            setDragging(true);
            document.body.classList.add("no-select");
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };

        const onMouseMove = (e: MouseEvent) => {
            const next = {
                x: e.clientX - dragOffsetRef.current.dx,
                y: e.clientY - dragOffsetRef.current.dy,
            };
            setPos(clampToViewport(next, sizeRef.current));
        };

        const onMouseUp = () => {
            setDragging(false);
            document.body.classList.remove("no-select");
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            safeSet(STORAGE_KEY, posRef.current);
        };

        header.addEventListener("mousedown", onMouseDown);
        return () => {
            header.removeEventListener("mousedown", onMouseDown);
            document.body.classList.remove("no-select");
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, []);

    // Click corp: set selection + request members
    const handleSelectCorp = (corpId: number) => {
        setSelectedCorpId(corpId);
        setMembersLoading(true);
        setRankGroups([]);

        // Send the server request
        try {
           
            SendMessageComposer(new GetCorporationMembersComposer(corpId));
            console.log("[📤] GetCorporationMembersComposer sent:", corpId);
        } catch (e) {
            console.warn("Failed to send GetCorporationMembersComposer:", e);
        }

        // (optional) still fire your DOM bridge for any legacy listeners
        window.dispatchEvent(
            new CustomEvent("request_corporation_members", {
                detail: { corporationId: corpId },
            })
        );
    };

    return (
        <div
            ref={rootRef}
            className={`corporations-view ${dragging ? "dragging" : ""}`}
            style={{ position: "fixed", left: `${pos.x}px`, top: `${pos.y}px` }}
        >
            <div
                ref={headerRef}
                className="corporations-header"
                aria-grabbed={dragging}
            >
                <span>Corporations</span>
                <button
                    className="close-button"
                    onClick={onClose}
                    aria-label="Close"
                >
                    ×
                </button>
            </div>

            <div className="corporations-body">
                <div className="corporations-list">
                    <h3>Corporations</h3>

                    {loading && <div className="loading">Loading...</div>}
                    {!loading && corporations.length === 0 && (
                        <div className="empty">No corporations found.</div>
                    )}

                    {!loading &&
                        corporations.map((corp) => (
                            <div
                                key={corp.id}
                                className={`corporation-item ${
                                    selectedCorpId === corp.id ? "selected" : ""
                                }`}
                                onClick={() => handleSelectCorp(corp.id)}
                            >
                                <div className="icon">
                                    {corp.icon ? (
                                        <img
                                            src={getIconUrl(corp.icon)}
                                            alt=""
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <div className="placeholder">🏢</div>
                                    )}
                                </div>

                                <div className="info">
                                    <div className="name">{corp.name}</div>
                                    {corp.desc && (
                                        <div className="description">
                                            {corp.desc}
                                        </div>
                                    )}
                                    <div className="meta">
                                        <span
                                            className={`badge ${badgeTone(
                                                corp.stock
                                            )}`}
                                        >
                                            {corp.stock ?? 0} in stock
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>

                <div className="corp-divider" />

                <div className="corporation-details">
                    {selectedCorpId === null ? (
                        <p className="no-corp-selected">
                            Select a corporation to view employees
                        </p>
                    ) : membersLoading ? (
                        <div className="loading">Loading members…</div>
                    ) : rankGroups.length === 0 ? (
                        <div className="empty">No members found.</div>
                    ) : (
                        <div className="corp-members">
                            {rankGroups.map((group) => (
                                <div
                                    key={group.rankId}
                                    className="rank-section"
                                >
                                    <div className="rank-header">
                                        <span className="rank-name">
                                            {group.rankName.toUpperCase()}
                                        </span>
                                        {typeof group.pay === "number" && (
                                            <span className="rank-pay">
                                                ${group.pay}
                                            </span>
                                        )}
                                    </div>

                                    <div className="rank-members">
                                        {group.members.map((m) => (
                                            <div
                                                key={m.userId}
                                                className="member-card"
                                            >
                                                <div className="avatar">
                                                    <img
                                                        src={avatarUrl(
                                                            m.figure
                                                        )}
                                                        alt=""
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <div className="member-info">
                                                    <div className="member-top">
                                                        <span className="member-name">
                                                            {m.username}
                                                        </span>
                                                        <span className="member-rank">
                                                            {m.rankName}
                                                        </span>
                                                    </div>
                                                    <div className="member-stats">
                                                        {typeof m.weeklyShifts ===
                                                            "number" && (
                                                            <span className="stat">
                                                                {m.weeklyShifts}{" "}
                                                                Weekly Shifts
                                                            </span>
                                                        )}
                                                        {typeof m.totalShifts ===
                                                            "number" && (
                                                            <span className="stat">
                                                                {m.totalShifts}{" "}
                                                                Total Shifts
                                                            </span>
                                                        )}
                                                        {m.lastSeenAgo && (
                                                            <span className="stat dim">
                                                                {m.lastSeenAgo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ------------ helpers -------------
function getCenteredPosition(size: { w: number; h: number }): Pos {
    const vw = window.innerWidth,
        vh = window.innerHeight;
    return {
        x: Math.max(0, Math.round((vw - size.w) / 2)),
        y: Math.max(0, Math.round((vh - size.h) / 2)),
    };
}
function clampToViewport(p: Pos, size: { w: number; h: number }): Pos {
    const maxX = Math.max(0, window.innerWidth - size.w);
    const maxY = Math.max(0, window.innerHeight - size.h);
    return {
        x: Math.min(Math.max(0, p.x), maxX),
        y: Math.min(Math.max(0, p.y), maxY),
    };
}
function safeGet<T>(key: string): T | null {
    try {
        return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
        return null;
    }
}
function safeSet<T>(key: string, value: T) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

function getIconUrl(icon: string) {
    if (/^https?:\/\//i.test(icon)) return icon;
    return `/icons/corporations/${icon}`;
}
function badgeTone(stock?: number) {
    if (typeof stock !== "number") return "neutral";
    if (stock <= 0) return "danger";
    if (stock <= 5) return "warn";
    return "success";
}
function avatarUrl(figure: string) {
    // Nitro avatar endpoint; adjust if different in your stack
    return `/avatarimage?figure=${encodeURIComponent(
        figure
    )}&size=b&headonly=0&gesture=sml`;
}

function groupMembersByRank(members: CorpMember[]): RankGroup[] {
    const byRank = new Map<number, RankGroup>();
    for (const m of members) {
        const key = m.rankId;
        if (!byRank.has(key)) {
            byRank.set(key, {
                rankId: m.rankId,
                rankName: m.rankName,
                rankOrder: m.rankOrder,
                pay: m.pay,
                members: [],
            });
        }
        byRank.get(key)!.members.push(m);
    }
    // Highest rank first (largest rank_order)
    return Array.from(byRank.values()).sort(
        (a, b) => b.rankOrder - a.rankOrder
    );
}

export default CorporationsView;
