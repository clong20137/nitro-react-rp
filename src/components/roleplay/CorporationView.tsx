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
    currentUserId: number;
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
    isManager?: boolean;
}

type Pos = { x: number; y: number };
const STORAGE_KEY = "olrp.corporations.pos";

// filters + persistence
const FILTERS_KEY = "olrp.corporations.memberFilters";

type MemberFilters = {
    showWeekly: boolean;
    showTotal: boolean;
    showLastOnline: boolean;
};

const DEFAULT_FILTERS: MemberFilters = {
    showWeekly: true,
    showTotal: true,
    showLastOnline: true,
};

const formatLastOnlineAgo = (lastOnlineUnix?: number) => {
    if (!lastOnlineUnix || lastOnlineUnix <= 0) return "";

    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - lastOnlineUnix);

    if (diff < 60) return "Just now";
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}hrs ago`;
    const days = Math.floor(hrs / 24);
    return `${days}days ago`;
};

export const CorporationsView: FC<CorporationsViewProps> = ({
    onClose,
    currentUserId,
    isStaff = false,
}) => {
    // entrance / exit
    const [opening, setOpening] = useState(true);
    const [closing, setClosing] = useState(false);
    const handleClose = () => setClosing(true);

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

    // storage helpers
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

    const [memberFilters, setMemberFilters] = useState<MemberFilters>(() => {
        const saved = safeGet<MemberFilters>(FILTERS_KEY);
        return saved ? { ...DEFAULT_FILTERS, ...saved } : DEFAULT_FILTERS;
    });

    useEffect(() => {
        safeSet(FILTERS_KEY, memberFilters);
    }, [memberFilters]);

    // search/hire
    const [memberSearch, setMemberSearch] = useState("");
    const [hiring, setHiring] = useState(false);

    // busy/flash
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
    const getCenteredPosition = (s: { w: number; h: number }): Pos => {
        const vw = window.innerWidth,
            vh = window.innerHeight;
        return {
            x: Math.max(0, Math.round((vw - s.w) / 2)),
            y: Math.max(0, Math.round((vh - s.h) / 2)),
        };
    };
    const clampToViewport = (p: Pos, s: { w: number; h: number }): Pos => {
        const maxX = Math.max(0, window.innerWidth - s.w);
        const maxY = Math.max(0, window.innerHeight - s.h);
        return {
            x: Math.min(Math.max(0, p.x), maxX),
            y: Math.min(Math.max(0, p.y), maxY),
        };
    };

    const getIconUrl = (icon?: string) =>
        icon
            ? /^https?:\/\//i.test(icon)
                ? icon
                : `/icons/corporations/${icon}`
            : "";

    const badgeTone = (stock?: number) => {
        if (typeof stock !== "number") return "neutral";
        if (stock <= 0) return "danger";
        if (stock <= 5) return "warn";
        return "success";
    };

    const avatarUrl = (figure: string) =>
        `https://imager.olympusrp.pw/?figure=${encodeURIComponent(
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

    // corporations list (DOM bridge)
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

        const cached = (window as any).__olrpCache?.corporations as
            | Corporation[]
            | undefined;
        if (cached?.length) {
            setCorporations(cached);
            setLoading(false);
        }

        const t = setTimeout(() => {
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

    // live stock updates
    useEffect(() => {
        const applyStockPatch = (
            id: number,
            patch: { stock?: number; delta?: number }
        ) => {
            setCorporations((prev) =>
                prev.map((c) => {
                    if (c.id !== id) return c;
                    const curr = typeof c.stock === "number" ? c.stock : 0;
                    const next =
                        typeof patch.stock === "number"
                            ? patch.stock
                            : Math.max(0, curr + (patch.delta ?? 0));
                    if (next === c.stock) return c;
                    return { ...c, stock: next };
                })
            );
        };

        const onOne = (ev: Event) => {
            const d: any = (ev as CustomEvent).detail || {};
            const corporationId = Number(d.corporationId ?? d.id);
            if (!corporationId) return;
            applyStockPatch(corporationId, { stock: d.stock, delta: d.delta });
        };

        const onBulk = (ev: Event) => {
            const d: any = (ev as CustomEvent).detail || {};
            const arr: any[] = Array.isArray(d)
                ? d
                : Array.isArray(d.updates)
                ? d.updates
                : [];
            if (!arr.length) return;
            setCorporations((prev) => {
                const patchMap = new Map<number, number>();
                for (const row of arr) {
                    const id = Number(row.id ?? row.corporationId);
                    if (!id) continue;
                    if (typeof row.stock === "number")
                        patchMap.set(id, row.stock);
                }
                if (!patchMap.size) return prev;
                let changed = false;
                const next = prev.map((c) => {
                    const v = patchMap.get(c.id);
                    if (typeof v !== "number" || v === c.stock) return c;
                    changed = true;
                    return { ...c, stock: v };
                });
                return changed ? next : prev;
            });
        };

        window.addEventListener(
            "corporation_stock_update",
            onOne as EventListener
        );
        document.addEventListener(
            "corporation_stock_update",
            onOne as EventListener
        );
        window.addEventListener(
            "corporations_stock_bulk",
            onBulk as EventListener
        );
        document.addEventListener(
            "corporations_stock_bulk",
            onBulk as EventListener
        );

        return () => {
            window.removeEventListener(
                "corporation_stock_update",
                onOne as EventListener
            );
            document.removeEventListener(
                "corporation_stock_update",
                onOne as EventListener
            );
            window.removeEventListener(
                "corporations_stock_bulk",
                onBulk as EventListener
            );
            document.removeEventListener(
                "corporations_stock_bulk",
                onBulk as EventListener
            );
        };
    }, []);

    // auto-select first
    useEffect(() => {
        if (!loading && selectedCorpId == null && corporations.length > 0) {
            handleSelectCorp(corporations[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, corporations, selectedCorpId]);

    // members result
    useEffect(() => {
        const onMembers = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const raw: any[] = (detail?.members ?? detail ?? []) as any[];

            const m: CorpMember[] = raw.map((row) => {
                const weekly =
                    row.weeklyShifts ??
                    row.weekly_shifts ??
                    row.weekly ??
                    undefined;

                const total =
                    row.totalShifts ??
                    row.total_shifts ??
                    row.shiftsCompleted ??
                    row.shifts_completed ??
                    undefined;

                const lastOnline =
                    row.lastOnline ??
                    row.last_online ??
                    row.lastOnlineUnix ??
                    undefined;

                const weeklyNum =
                    weekly === undefined || weekly === null
                        ? undefined
                        : Number(weekly);
                const totalNum =
                    total === undefined || total === null
                        ? undefined
                        : Number(total);
                const lastNum =
                    lastOnline === undefined || lastOnline === null
                        ? 0
                        : Number(lastOnline);

                return {
                    ...row,
                    figure: row.figure ?? row.look ?? "",
                    weeklyShifts: Number.isFinite(weeklyNum as number)
                        ? (weeklyNum as number)
                        : undefined,
                    totalShifts: Number.isFinite(totalNum as number)
                        ? (totalNum as number)
                        : undefined,
                    lastSeenAgo:
                        row.lastSeenAgo ??
                        row.last_seen_ago ??
                        formatLastOnlineAgo(lastNum),
                };
            });

            setMembers(m);
            setMembersLoading(false);

            setMembersReady(false);
            requestAnimationFrame(() => setMembersReady(true));

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

    // ranks result
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

    // refresh helpers
    const refreshCorpData = (corpId: number) => {
        try {
            setMembersLoading(true);
            setMembersReady(false);
            SendMessageComposer(new GetCorporationMembersComposer(corpId));
        } catch {}
        try {
            SendMessageComposer(new GetCorporationRanksComposer(corpId));
        } catch {}
        try {
            window.dispatchEvent(new CustomEvent("request_corporations_list"));
        } catch {}
    };

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
                    closing ? "exit-br" : opening ? "enter" : "entered"
                } ${refreshFlash ? "flash" : ""}`}
                onAnimationEnd={() => {
                    if (closing) onClose();
                }}
                style={{
                    position: "fixed",
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                }}
                role="dialog"
                aria-modal="true"
            >
                {/* HEADER */}
                <div
                    ref={headerRef}
                    className="corporations-header"
                    aria-grabbed={dragging}
                >
                    <div className="title">Corporations</div>
                    <button
                        className="close-button"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* BODY */}
                <div className="corporations-body">
                    {/* LEFT: corporation tiles */}
                    <div className="corporations-list">
                        <div className="corp-list-title">Corporations</div>

                        <div
                            className="corp-list"
                            role="list"
                            aria-label="Corporations"
                        >
                            {loading && <div className="loading">Loading…</div>}

                            {!loading && corporations.length === 0 && (
                                <div className="empty">
                                    No corporations found.
                                </div>
                            )}

                            {!loading &&
                                corporations.map((corp) => {
                                    const selected = selectedCorpId === corp.id;
                                    const stock =
                                        typeof corp.stock === "number"
                                            ? corp.stock
                                            : 0;
                                    const tone = badgeTone(stock);
                                    const iconUrl = getIconUrl(corp.icon);

                                    return (
                                        <button
                                            key={corp.id}
                                            role="listitem"
                                            className={`corp-tile ${
                                                selected ? "selected" : ""
                                            }`}
                                            onClick={() =>
                                                handleSelectCorp(corp.id)
                                            }
                                            aria-pressed={selected}
                                            aria-label={`${corp.name}, ${stock} in stock`}
                                        >
                                            <div className="tile-icon">
                                                {iconUrl ? (
                                                    <img
                                                        src={iconUrl}
                                                        alt=""
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <span
                                                        className="placeholder"
                                                        aria-hidden="true"
                                                    >
                                                        🏢
                                                    </span>
                                                )}
                                            </div>

                                            <div
                                                className="tile-name"
                                                title={corp.name}
                                            >
                                                {corp.name}
                                            </div>

                                            <div
                                                className={`tile-stock ${tone}`}
                                                aria-hidden="true"
                                            >
                                                {stock}
                                            </div>

                                            <div
                                                className="corp-tooltip"
                                                role="tooltip"
                                            >
                                                <span className="name">
                                                    {corp.name}
                                                </span>
                                                <span className="mini-badge">
                                                    {stock} in stock
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
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

                                {/* Options / Filters */}
                                <div className="corp-options">
                                    <div className="corp-options-title">
                                        Options
                                    </div>

                                    <label className="corp-option">
                                        <input
                                            type="checkbox"
                                            checked={memberFilters.showWeekly}
                                            onChange={(e) =>
                                                setMemberFilters((p) => ({
                                                    ...p,
                                                    showWeekly:
                                                        e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>Show weekly shifts</span>
                                    </label>

                                    <label className="corp-option">
                                        <input
                                            type="checkbox"
                                            checked={memberFilters.showTotal}
                                            onChange={(e) =>
                                                setMemberFilters((p) => ({
                                                    ...p,
                                                    showTotal: e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>Show total shifts</span>
                                    </label>

                                    <label className="corp-option">
                                        <input
                                            type="checkbox"
                                            checked={
                                                memberFilters.showLastOnline
                                            }
                                            onChange={(e) =>
                                                setMemberFilters((p) => ({
                                                    ...p,
                                                    showLastOnline:
                                                        e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>Show last online</span>
                                    </label>
                                </div>

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
                                            : (() => {
                                                  const by =
                                                      groupMembersByRankId(
                                                          members
                                                      );
                                                  return [...by.entries()]
                                                      .map(([rankId, arr]) => ({
                                                          rankId,
                                                          rankName:
                                                              arr[0]
                                                                  ?.rankName ??
                                                              `Rank ${rankId}`,
                                                          rankOrder:
                                                              arr[0]
                                                                  ?.rankOrder ??
                                                              0,
                                                          pay: arr[0]?.pay,
                                                      }))
                                                      .sort(
                                                          (a, b) =>
                                                              b.rankOrder -
                                                              a.rankOrder
                                                      );
                                              })()
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
                                                                                        "https://imager.olympusrp.pw/?figure=hd-180-1.lg-280-110.sh-290-64&size=b&headonly=0&gesture=sml";
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
                                                                                {memberFilters.showWeekly &&
                                                                                    typeof m.weeklyShifts ===
                                                                                        "number" && (
                                                                                        <span className="stat">
                                                                                            {
                                                                                                m.weeklyShifts
                                                                                            }{" "}
                                                                                            Weekly
                                                                                            Shifts
                                                                                        </span>
                                                                                    )}

                                                                                {memberFilters.showTotal &&
                                                                                    typeof m.totalShifts ===
                                                                                        "number" && (
                                                                                        <span className="stat">
                                                                                            {
                                                                                                m.totalShifts
                                                                                            }{" "}
                                                                                            Total
                                                                                            Shifts
                                                                                        </span>
                                                                                    )}

                                                                                {memberFilters.showLastOnline &&
                                                                                    m.lastSeenAgo && (
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
