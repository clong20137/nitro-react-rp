import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./CorporationsView.scss";

import { SendMessageComposer } from "../../api";

// GET packets
import { GetCorporationMembersComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetCorporationMembersComposer";
import { GetCorporationRanksComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetCorporationRanksComposer";

// Actions
import { HireCorporationMemberComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/HireCorporationMemberComposer";
import { PromoteCorporationMemberComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PromoteCorporationMemberComposer";
import { DemoteCorporationMemberComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DemoteCorporationMemberComposer";
import { FireCorporationMemberComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/FireCorporationMemberComposer";

interface CorporationsViewProps {
    onClose: () => void;
    /** logged-in user id (to detect if user is a manager of the selected corp) */
    currentUserId: number;
    /** optional global staff override */
    isStaff?: boolean;
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
    figure: string;
    rankId: number;
    rankName: string;
    rankOrder: number;
    pay?: number;
    weeklyShifts?: number;
    totalShifts?: number;
    lastSeenAgo?: string;
}

interface RankMeta {
    rankId: number;
    rankName: string;
    rankOrder: number;
    pay?: number;
    isManager?: boolean; // server should include this for visibility rules
}

type Pos = { x: number; y: number };
const STORAGE_KEY = "olrp.corporations.pos";

export const CorporationsView: FC<CorporationsViewProps> = ({
    onClose,
    currentUserId,
    isStaff = false,
}) => {
    // entrance animation
    const [opening, setOpening] = useState(true);

    // data
    const [loading, setLoading] = useState(true);
    const [corporations, setCorporations] = useState<Corporation[]>([]);
    const [selectedCorpId, setSelectedCorpId] = useState<number | null>(null);

    const [membersLoading, setMembersLoading] = useState(false);
    const [membersReady, setMembersReady] = useState(false);
    const [members, setMembers] = useState<CorpMember[]>([]);
    const [ranksByCorp, setRanksByCorp] = useState<Record<number, RankMeta[]>>(
        {}
    );

    // search/hire
    const [memberSearch, setMemberSearch] = useState("");
    const [hiring, setHiring] = useState(false);

    // per-user busy state + refresh flash
    const [busyUserIds, setBusyUserIds] = useState<Set<number>>(new Set());
    const [refreshFlash, setRefreshFlash] = useState(false);

    // drag/layout
    const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
    const posRef = useRef<Pos>(pos);
    useEffect(() => {
        posRef.current = pos;
    }, [pos]);

    const [dragging, setDragging] = useState(false);
    const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
    const sizeRef = useRef<{ w: number; h: number }>({ w: 1000, h: 540 });

    const rootRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);

    // helpers
    const getCenteredPosition = (size: { w: number; h: number }): Pos => {
        const vw = window.innerWidth,
            vh = window.innerHeight;
        return {
            x: Math.max(0, Math.round((vw - size.w) / 2)),
            y: Math.max(0, Math.round((vh - size.h) / 2)),
        };
    };
    const clampToViewport = (p: Pos, size: { w: number; h: number }): Pos => {
        const maxX = Math.max(0, window.innerWidth - size.w);
        const maxY = Math.max(0, window.innerHeight - size.h);
        return {
            x: Math.min(Math.max(0, p.x), maxX),
            y: Math.min(Math.max(0, p.y), maxY),
        };
    };
    const safeGet = <T,>(key: string): T | null => {
        try {
            return JSON.parse(localStorage.getItem(key) || "null");
        } catch {
            return null;
        }
    };
    const safeSet = <T,>(key: string, value: T) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {}
    };
    const getIconUrl = (icon: string) =>
        /^https?:\/\//i.test(icon) ? icon : `/icons/corporations/${icon}`;
    const badgeTone = (stock?: number) => {
        if (typeof stock !== "number") return "neutral";
        if (stock <= 0) return "danger";
        if (stock <= 5) return "warn";
        return "success";
    };
    const avatarUrl = (figure: string) =>
        `https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
            figure
        )}&size=b&headonly=0&gesture=sml`;

    const sortRanksDesc = (r: RankMeta[]) =>
        [...r].sort((a, b) => b.rankOrder - a.rankOrder);
    const groupMembersByRankId = (list: CorpMember[]) => {
        const map = new Map<number, CorpMember[]>();
        for (const m of list) {
            if (!map.has(m.rankId)) map.set(m.rankId, []);
            map.get(m.rankId)!.push(m);
        }
        return map;
    };

    // entrance flip
    useEffect(() => {
        const id = requestAnimationFrame(() => setOpening(false));
        return () => cancelAnimationFrame(id);
    }, []);

    // layout watchers
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

    useEffect(() => {
        requestAnimationFrame(() => {
            const saved = safeGet<Pos>(STORAGE_KEY);
            const target = saved ?? getCenteredPosition(sizeRef.current);
            setPos(clampToViewport(target, sizeRef.current));
        });
    }, []);

    useEffect(() => {
        const onResize = () =>
            setPos((p) => clampToViewport(p, sizeRef.current));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // corporations list (DOM bridge) — attach listeners, hydrate from cache, then request
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

        // hydrate from sticky cache if bridge saved it earlier
        const cached = (window as any).__olrpCache?.corporations as
            | Corporation[]
            | undefined;
        if (cached?.length) {
            setCorporations(cached);
            setLoading(false);
        }

        // then request on next tick so we never race the listener
        const t = setTimeout(() => {
            // Use whichever trigger your app expects. If you have a composer, call it here instead.
            window.dispatchEvent(new CustomEvent("request_corporations_list"));
        }, 0);

        return () => {
            clearTimeout(t);
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

    // auto-select first corporation once list arrives (prevents “click twice”)
    useEffect(() => {
        if (!loading && selectedCorpId == null && corporations.length > 0) {
            handleSelectCorp(corporations[0].id);
        }
    }, [loading, corporations, selectedCorpId]);

    // members result (DOM bridge)
    useEffect(() => {
        const onMembers = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const raw: any[] = (detail?.members ?? detail ?? []) as any[];
            const m: CorpMember[] = raw.map((row) => ({
                ...row,
                figure: row.figure ?? row.look ?? "",
            }));
            setMembers(m);
            setMembersLoading(false);

            // trigger list entrance on next paint
            setMembersReady(false);
            requestAnimationFrame(() => setMembersReady(true));

            // quick flash
            setRefreshFlash(true);
            setTimeout(() => setRefreshFlash(false), 180);
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

    // ranks result (DOM bridge)
    useEffect(() => {
        const onRanks = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const { corporationId, ranks } = detail || {};
            if (!corporationId || !Array.isArray(ranks)) return;
            setRanksByCorp((prev) => ({
                ...prev,
                [corporationId]: ranks as RankMeta[],
            }));
        };
        window.addEventListener(
            "corporation_ranks_result",
            onRanks as EventListener
        );
        document.addEventListener(
            "corporation_ranks_result",
            onRanks as EventListener
        );
        return () => {
            window.removeEventListener(
                "corporation_ranks_result",
                onRanks as EventListener
            );
            document.removeEventListener(
                "corporation_ranks_result",
                onRanks as EventListener
            );
        };
    }, []);

    // drag
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

    // request/refresh both lists
    const refreshCorpData = (corpId: number) => {
        try {
            setMembersLoading(true);
            setMembersReady(false);
            SendMessageComposer(new GetCorporationMembersComposer(corpId));
        } catch {}
        try {
            SendMessageComposer(new GetCorporationRanksComposer(corpId));
        } catch {}
    };

    // interactions
    const handleSelectCorp = (corpId: number) => {
        setSelectedCorpId(corpId);
        setMembersLoading(true);
        setMembersReady(false);
        setMembers([]);
        setMemberSearch("");
        refreshCorpData(corpId);
    };

    const handleHire = () => {
        if (!selectedCorpId) return;
        const username = memberSearch.trim();
        if (!username) return;
        setHiring(true);
        try {
            SendMessageComposer(
                new HireCorporationMemberComposer(selectedCorpId, username)
            );
        } finally {
            setMemberSearch("");
            setTimeout(() => setHiring(false), 180);
            refreshCorpData(selectedCorpId);
        }
    };

    const withUserBusy = (userId: number, fn: () => void) => {
        setBusyUserIds((prev) => new Set(prev).add(userId));
        try {
            fn();
        } finally {
            setTimeout(() => {
                setBusyUserIds((prev) => {
                    const next = new Set(prev);
                    next.delete(userId);
                    return next;
                });
            }, 180);
        }
    };

    const handlePromote = (userId: number) => {
        if (!selectedCorpId) return;
        withUserBusy(userId, () => {
            try {
                SendMessageComposer(
                    new PromoteCorporationMemberComposer(selectedCorpId, userId)
                );
            } finally {
                refreshCorpData(selectedCorpId);
            }
        });
    };
    const handleDemote = (userId: number) => {
        if (!selectedCorpId) return;
        withUserBusy(userId, () => {
            try {
                SendMessageComposer(
                    new DemoteCorporationMemberComposer(selectedCorpId, userId)
                );
            } finally {
                refreshCorpData(selectedCorpId);
            }
        });
    };
    const handleFire = (userId: number) => {
        if (!selectedCorpId) return;
        withUserBusy(userId, () => {
            try {
                SendMessageComposer(
                    new FireCorporationMemberComposer(selectedCorpId, userId)
                );
            } finally {
                refreshCorpData(selectedCorpId);
            }
        });
    };

    // permissions
    const currentRanks = selectedCorpId
        ? sortRanksDesc(ranksByCorp[selectedCorpId] || [])
        : [];
    const membersByRank = groupMembersByRankId(members);

    const userIsManagerInCorp = (() => {
        if (!selectedCorpId) return false;
        const my = members.find((m) => m.userId === currentUserId);
        if (!my) return false;
        const meta = (ranksByCorp[selectedCorpId] || []).find(
            (r) => r.rankId === my.rankId
        );
        return !!meta?.isManager;
    })();
    const canManage = isStaff || userIsManagerInCorp;

    return (
        <>
            <div
                ref={rootRef}
                className={`corporations-view ${dragging ? "dragging" : ""} ${
                    opening ? "enter" : "entered"
                } ${refreshFlash ? "flash" : ""}`}
                style={{
                    position: "fixed",
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                }}
                role="dialog"
                aria-modal="true"
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
                    {/* LEFT: corp list */}
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
                                        selectedCorpId === corp.id
                                            ? "selected"
                                            : ""
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
                                            <div className="placeholder">
                                                🏢
                                            </div>
                                        )}
                                    </div>
                                    <div className="info">
                                        <div className="name">{corp.name}</div>
                                        {!!corp.desc && (
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

                    {/* RIGHT: details */}
                    <div className="corporation-details">
                        {selectedCorpId === null ? (
                            <p className="no-corp-selected">
                                Select a corporation to view employees
                            </p>
                        ) : (
                            <>
                                {canManage && (
                                    <div className="corp-actions">
                                        <input
                                            type="text"
                                            className="corp-member-search"
                                            placeholder="Type a username, then Hire"
                                            value={memberSearch}
                                            onChange={(e) =>
                                                setMemberSearch(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter")
                                                    handleHire();
                                            }}
                                        />
                                        <button
                                            className="habbo-green-btn"
                                            onClick={handleHire}
                                            disabled={
                                                hiring || !memberSearch.trim()
                                            }
                                            title="Hire at lowest rank"
                                        >
                                            {hiring ? "Hiring…" : "Hire"}
                                        </button>
                                    </div>
                                )}

                                {membersLoading && currentRanks.length === 0 ? (
                                    <div className="members-skeleton">
                                        <div className="skel-card" />
                                        <div className="skel-card" />
                                        <div className="skel-card" />
                                        <div className="skel-card" />
                                    </div>
                                ) : currentRanks.length === 0 &&
                                  members.length === 0 ? (
                                    <div className="empty">
                                        No ranks data yet.
                                    </div>
                                ) : (
                                    <div
                                        className={`corp-members ${
                                            membersReady ? "ready" : ""
                                        }`}
                                    >
                                        {(currentRanks.length > 0
                                            ? currentRanks
                                            : sortRanksDesc(
                                                  Array.from(
                                                      groupMembersByRankId(
                                                          members
                                                      ).entries()
                                                  ).map(([rankId, arr]) => ({
                                                      rankId,
                                                      rankName:
                                                          arr[0]?.rankName ??
                                                          `Rank ${rankId}`,
                                                      rankOrder:
                                                          arr[0]?.rankOrder ??
                                                          0,
                                                      pay: arr[0]?.pay,
                                                  }))
                                              )
                                        ).map((rank, idx) => {
                                            const mlist =
                                                membersByRank.get(
                                                    rank.rankId
                                                ) || [];
                                            return (
                                                <div
                                                    key={rank.rankId}
                                                    className="rank-section"
                                                    style={{
                                                        ["--rank-stagger" as any]:
                                                            String(idx + 1),
                                                    }}
                                                >
                                                    <div className="rank-header">
                                                        <span className="rank-name">
                                                            {rank.rankName.toUpperCase()}
                                                        </span>
                                                        {typeof rank.pay ===
                                                            "number" && (
                                                            <span className="rank-pay">
                                                                ${rank.pay}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="rank-members">
                                                        {mlist.length === 0 ? (
                                                            <div className="no-rank-members dim">
                                                                No members in
                                                                this rank.
                                                            </div>
                                                        ) : (
                                                            mlist.map((m) => {
                                                                const busy =
                                                                    busyUserIds.has(
                                                                        m.userId
                                                                    );
                                                                const showActions =
                                                                    isStaff ||
                                                                    userIsManagerInCorp;
                                                                return (
                                                                    <div
                                                                        key={
                                                                            m.userId
                                                                        }
                                                                        className="member-card"
                                                                    >
                                                                        <div className="avatar">
                                                                            <img
                                                                                src={avatarUrl(
                                                                                    m.figure
                                                                                )}
                                                                                alt=""
                                                                                aria-hidden="true"
                                                                                onError={(
                                                                                    e
                                                                                ) => {
                                                                                    (
                                                                                        e.currentTarget as HTMLImageElement
                                                                                    ).src =
                                                                                        "https://www.habbo.com/habbo-imaging/avatarimage?figure=hd-180-1.lg-280-110.sh-290-64&size=b&headonly=0&gesture=sml";
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="member-info">
                                                                            <div className="member-top">
                                                                                <span className="member-name">
                                                                                    {
                                                                                        m.username
                                                                                    }
                                                                                </span>
                                                                                <span className="member-rank">
                                                                                    {
                                                                                        m.rankName
                                                                                    }
                                                                                </span>
                                                                            </div>

                                                                            <div className="member-stats">
                                                                                {typeof m.weeklyShifts ===
                                                                                    "number" && (
                                                                                    <span className="stat">
                                                                                        {
                                                                                            m.weeklyShifts
                                                                                        }{" "}
                                                                                        Weekly
                                                                                        Shifts
                                                                                    </span>
                                                                                )}
                                                                                {typeof m.totalShifts ===
                                                                                    "number" && (
                                                                                    <span className="stat">
                                                                                        {
                                                                                            m.totalShifts
                                                                                        }{" "}
                                                                                        Total
                                                                                        Shifts
                                                                                    </span>
                                                                                )}
                                                                                {m.lastSeenAgo && (
                                                                                    <span className="stat dim">
                                                                                        {
                                                                                            m.lastSeenAgo
                                                                                        }
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {showActions && (
                                                                                <div className="member-actions">
                                                                                    <button
                                                                                        className="habbo-green-btn"
                                                                                        onClick={() =>
                                                                                            handlePromote(
                                                                                                m.userId
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            busy
                                                                                        }
                                                                                    >
                                                                                        Promote
                                                                                    </button>
                                                                                    <button
                                                                                        className="habbo-white-btn"
                                                                                        onClick={() =>
                                                                                            handleDemote(
                                                                                                m.userId
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            busy
                                                                                        }
                                                                                    >
                                                                                        Demote
                                                                                    </button>
                                                                                    <button
                                                                                        className="habbo-red-btn"
                                                                                        onClick={() =>
                                                                                            handleFire(
                                                                                                m.userId
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            busy
                                                                                        }
                                                                                    >
                                                                                        Fire
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CorporationsView;
