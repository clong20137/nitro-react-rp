import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./GangsDetailView.scss";
import { Nitro } from "@nitrots/nitro-renderer";
import { SendMessageComposer } from "../../api";

/* ===== Packets ===== */
import { GangInviteComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GangInviteComposer";
import { CreateGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CreateGangRoleComposer";
import { DeleteGangMessageComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangMessageComposer";
import { DeleteGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangRoleComposer";
import { EditGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangRoleComposer";
import { LeaveGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/LeaveGangComposer";
import { ChangeGangRankComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeGangRankComposer";
import { EditGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangComposer";
import { GetPartPaletteHexesComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetPartPaletteHExesComposer";

/* lazy-optional composers so older builds don't explode */
let GetGangStatusComposer: any;
let GetGangMembersComposer: any;
let GetGangRanksComposer: any;
try {
    GetGangStatusComposer =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetGangStatusComposer").GetGangStatusComposer;
} catch {}
try {
    GetGangMembersComposer =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetGangMembersComposer").GetGangMembersComposer;
} catch {}
try {
    GetGangRanksComposer =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetGangRanksComposer").GetGangRanksComposer;
} catch {}

/* ===== Types ===== */
interface GangsDetailViewProps {
    onClose: () => void;
}

interface GangMemberRaw {
    userId: number;
    username: string;
    rankName?: string;
    rankId?: number | null;
    rankOrder?: number;
    figure?: string;
}

interface GangMemberNorm {
    userId: number;
    username: string;
    rankName: string;
    rankOrder: number; // -1 = unranked
    figure: string;
}

interface GangRank {
    id: number;
    name: string;
    position: number;
    canInvite: boolean;
    canKick: boolean;
    canPromote: boolean;
    canAlert: boolean;
    administrator: boolean;
    canAccessBank: boolean;
}

/* ===== Turf helpers ===== */
type TurfMask = number;

const applyTurfDataFactory = (setters: {
    setOwnsNorth: (v: boolean) => void;
    setOwnsSouth: (v: boolean) => void;
    setOwnsEast: (v: boolean) => void;
    setOwnsWest: (v: boolean) => void;
}) => {
    return (data: any): number => {
        const arr = Array.isArray(data?.turfsOwned) ? data.turfsOwned : [];
        const set = new Set(arr.map((s: any) => String(s).toLowerCase()));

        const mask: TurfMask = Number.isFinite(data?.turfsMask)
            ? Number(data.turfsMask)
            : 0;

        const north =
            (typeof data?.ownsNorth === "boolean" && data.ownsNorth) ||
            set.has("north") ||
            !!(mask & 1);
        const south =
            (typeof data?.ownsSouth === "boolean" && data.ownsSouth) ||
            set.has("south") ||
            !!(mask & 2);
        const east =
            (typeof data?.ownsEast === "boolean" && data.ownsEast) ||
            set.has("east") ||
            !!(mask & 4);
        const west =
            (typeof data?.ownsWest === "boolean" && data.ownsWest) ||
            set.has("west") ||
            !!(mask & 8);

        setters.setOwnsNorth(!!north);
        setters.setOwnsSouth(!!south);
        setters.setOwnsEast(!!east);
        setters.setOwnsWest(!!west);

        return [north, south, east, west].filter(Boolean).length;
    };
};

type TurfDef = {
    key: "north" | "south" | "east" | "west";
    name: string;
    bonus: string;
    img: string;
};

const TURFS: TurfDef[] = [
    {
        key: "north",
        name: "North Turf",
        bonus: "10% crit chance (+10 dmg)",
        img: "/icons/North.png",
    },
    {
        key: "south",
        name: "South Turf",
        bonus: "+10 Health per member",
        img: "/icons/South.png",
    },
    {
        key: "east",
        name: "East Turf",
        bonus: "½ Energy per hit",
        img: "/assets/turfs/east.png",
    },
    {
        key: "west",
        name: "West Turf",
        bonus: "Passive healing everywhere",
        img: "/assets/turfs/west.png",
    },
];

/* ===== Icon helpers ===== */
type IconOpt = { name: string; src: string; vip?: boolean };

const ICON_OPTIONS: IconOpt[] = [
    { name: "Swords", src: "/icons/badges/ALW09.gif" },
    { name: "Skull", src: "/icons/badges/DE10K.gif" },
    { name: "Fire", src: "/icons/badges/EFM19.gif" },
    { name: "Shield", src: "/icons/badges/FRK42.gif" },
    { name: "Target", src: "/icons/badges/TC913.gif" },
    { name: "Crown", src: "/icons/badges/TC944.gif" },
    { name: "Bomb", src: "/icons/badges/TC969.gif" },
    { name: "Snake", src: "/icons/badges/FRH52.gif" },
    { name: "Rocket Ship", src: "/icons/badges/BR815.gif" },
    { name: "Blue Snake", src: "/icons/badges/COM51.gif" },
    { name: "Pirate Flag", src: "/icons/badges/COM74.gif" },
    { name: "Bloody Duck", src: "/icons/badges/COM73.gif" },
    { name: "Blue Shield", src: "/icons/badges/CP001.gif" },
    { name: "Mexican Skull", src: "/icons/badges/NB067.gif" },
    { name: "Ghost", src: "/icons/badges/HNN06.gif" },
    { name: "Eyeball", src: "/icons/badges/DE51J.gif" },
    { name: "Star", src: "/icons/badges/ES08Q.gif" },
    { name: "Donkey", src: "/icons/badges/MIN22.gif" },
    { name: "Green Pumpkin", src: "/icons/badges/APC08.gif" },
    { name: "Mushroom", src: "/icons/badges/CAV06.gif" },
    { name: "Pride", src: "/icons/badges/ES64A.gif" },
    { name: "Fire Skull", src: "/icons/badges/FR189.gif" },
    { name: "Green Skull", src: "/icons/badges/HGH11.gif" },
    { name: "Green Monster", src: "/icons/badges/FV2.gif" },
    { name: "Dark Pickle", src: "/icons/badges/TC861.gif" },
    { name: "Basketball", src: "/icons/badges/TC825.gif" },
    { name: "Lips", src: "/icons/badges/PTD74.gif" },
    { name: "Cow", src: "/icons/badges/TC792.gif" },
    { name: "Boxing Gloves", src: "/icons/badges/ITH03.gif" },
    { name: "Black Cat", src: "/icons/badges/US530.gif" },
    { name: "Golden Crown", src: "/icons/badges/FRH44.gif" },
    { name: "Cowboy Hat", src: "/icons/badges/US515.gif" },
    { name: "Pink Heart", src: "/icons/badges/DE21H.gif", vip: true },
];

const iconKeyFromSrc = (src: string): string => {
    const m = src.match(/\/([^/]+)\.(gif|png)$/i);
    return m ? m[1] : "";
};

const keyToIconPath = (key?: string) =>
    key
        ? `/icons/badges/${key.toUpperCase()}.gif`
        : "/icons/badges/default.gif";

const stripHash = (hex: string) => hex.replace(/^#/, "");
const withHash = (hex?: string) =>
    hex
        ? hex.startsWith("#")
            ? hex.toUpperCase()
            : `#${hex.toUpperCase()}`
        : "";

declare global {
    interface Window {
        __lastGangStatus?: any;
    }
}

/* ===== 6×5 Paginated swatches ===== */
const PaginatedSwatchGrid: FC<{
    swatches: string[];
    value: string;
    onChange: (hex: string) => void;
}> = ({ swatches, value, onChange }) => {
    const COLS = 6;
    const ROWS = 5;
    const PAGE_SIZE = COLS * ROWS;
    const [page, setPage] = useState(0);

    const totalPages = Math.max(1, Math.ceil(swatches.length / PAGE_SIZE));
    const start = page * PAGE_SIZE;
    const current = swatches.slice(start, start + PAGE_SIZE);

    useEffect(() => {
        if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
    }, [swatches.length, page, totalPages]);

    return (
        <div className="gang-swatch-pager">
            <button
                className="pager-btn left"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous colors"
            >
                ◀
            </button>

            <div key={page} className="page-fade">
                <div className="swatch-page swatch-6x5">
                    {current.map((hex) => (
                        <button
                            key={`${hex}-${start}`}
                            className={
                                "swatch" + (hex === value ? " selected" : "")
                            }
                            style={{ backgroundColor: hex }}
                            onClick={() => onChange(hex)}
                            title={hex}
                        />
                    ))}
                    {!swatches.length && (
                        <div className="swatch-loading">Loading colors…</div>
                    )}
                </div>
            </div>

            <button
                className="pager-btn right"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Next colors"
            >
                ▶
            </button>

            <div className="page-indicator">
                {page + 1} / {totalPages}
            </div>
        </div>
    );
};

/* ========================================================= */

type TabKey = "general" | "members" | "settings";

export const GangsDetailView: FC<GangsDetailViewProps> = ({ onClose }) => {
    /* ---- core gang state ---- */
    const [gangName, setGangName] = useState("");
    const [gangRank, setGangRank] = useState(0);
    const [primaryColor, setPrimaryColor] = useState("#000000");
    const [secondaryColor, setSecondaryColor] = useState("#000000");
    const [gangIcon, setGangIcon] = useState("");

    const [activeTab, setActiveTab] = useState<TabKey>("general");

    /* ---- members & ranks ---- */
    const [membersRaw, setMembersRaw] = useState<GangMemberRaw[]>([]);
    const [membersNorm, setMembersNorm] = useState<GangMemberNorm[]>([]);
    const [gangRanks, setGangRanks] = useState<GangRank[]>([]);
    const [collapsedRanks, setCollapsedRanks] = useState<number[]>([]);

    /* ---- load state for reliability ---- */
    const [membersLoading, setMembersLoading] = useState(false);
    const [ranksLoading, setRanksLoading] = useState(false);
    const [membersError, setMembersError] = useState<string | null>(null);

    /* ---- modals / role editing ---- */
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [editRoleId, setEditRoleId] = useState<number | null>(null);
    const [roleName, setRoleName] = useState("");
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [showNewRoleModal, setShowNewRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [showConfirmRoleDeleteModal, setShowConfirmRoleDeleteModal] =
        useState(false);
    const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<
        number | null
    >(null);
    const [rolePermissions, setRolePermissions] = useState({
        bankAccess: false,
        kickMembers: false,
        inviteMembers: false,
        administrator: false,
    });

    /* ---- turfs ---- */
    const [ownsNorth, setOwnsNorth] = useState(false);
    const [ownsSouth, setOwnsSouth] = useState(false);
    const [ownsEast, setOwnsEast] = useState(false);
    const [ownsWest, setOwnsWest] = useState(false);

    const applyTurfData = useMemo(
        () =>
            applyTurfDataFactory({
                setOwnsNorth,
                setOwnsSouth,
                setOwnsEast,
                setOwnsWest,
            }),
        []
    );

    /* ---- stats ---- */
    const [gangXP, setGangXP] = useState(0);
    const [gangXPMax, setGangXPMax] = useState(100);
    const [gangKills, setGangKills] = useState(0);
    const [gangDeaths, setGangDeaths] = useState(0);
    const [gangRobberies, setGangRobberies] = useState(0);
    const [gangPickpockets, setGangPickpockets] = useState(0);
    const [gangDamage, setGangDamage] = useState(0);
    const [gangTurfCount, setGangTurfCount] = useState(0);

    /* ---- palettes / icons ---- */
    const [ccSwatches, setCcSwatches] = useState<string[]>([]);
    const ICONS_PER_PAGE = 16;
    const [iconsPage, setIconsPage] = useState(0);
    const totalIconPages = Math.ceil(ICON_OPTIONS.length / ICONS_PER_PAGE);
    const visibleIcons = ICON_OPTIONS.slice(
        iconsPage * ICONS_PER_PAGE,
        (iconsPage + 1) * ICONS_PER_PAGE
    );

    /* ---- viewer context ---- */
    const currentUsername = Nitro.instance.sessionDataManager.userName;
    const viewer = useMemo(
        () => membersNorm.find((m) => m.username === currentUsername),
        [membersNorm, currentUsername]
    );
    const [isGangAdmin, setIsGangAdmin] = useState(false);
    const [isGangOwner, setIsGangOwner] = useState(false);
    const ownerOrAdmin = isGangOwner || isGangAdmin;

    /* ---- draggable ---- */
    const rootRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(true);
    const [positionReady, setPositionReady] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            return (
                JSON.parse(
                    localStorage.getItem("gangs-detail-position") || ""
                ) || { x: 100, y: 100 }
            );
        } catch {
            return { x: 100, y: 100 };
        }
    });

    const getClampedPos = (x: number, y: number, node?: HTMLElement | null) => {
        const w = node?.offsetWidth ?? 650;
        const h = node?.offsetHeight ?? 420;
        const pad = 8;
        const maxX = window.innerWidth - w - pad;
        const maxY = window.innerHeight - h - pad;
        const clamp = (v: number, min: number, max: number) =>
            Math.min(Math.max(v, min), Math.max(min, max));
        return { x: clamp(x, pad, maxX), y: clamp(y, pad, maxY) };
    };

    const refreshAll = useCallback(() => {
        try {
            if (GetGangStatusComposer)
                SendMessageComposer(new GetGangStatusComposer());
        } catch {}
        try {
            if (GetGangMembersComposer)
                SendMessageComposer(new GetGangMembersComposer());
        } catch {}
        try {
            if (GetGangRanksComposer)
                SendMessageComposer(new GetGangRanksComposer());
        } catch {}

        window.dispatchEvent(new CustomEvent("request_gang_status"));
        window.dispatchEvent(new CustomEvent("request_gang_members"));
        window.dispatchEvent(new CustomEvent("request_gang_ranks"));
    }, []);

    /* ---- normalize members any time inputs change ---- */
    useEffect(() => {
        if (!membersRaw.length) {
            setMembersNorm([]);
            return;
        }

        const idToPos = new Map<number, number>();
        const nameToPos = new Map<string, number>();

        gangRanks.forEach((r) => {
            idToPos.set(r.id, r.position);
            nameToPos.set((r.name || "").toLowerCase(), r.position);
        });

        const normalized: GangMemberNorm[] = membersRaw.map((m) => {
            let rankOrder = -1;

            if (gangRanks.length) {
                const incomingOrder = Number(m.rankOrder);

                // only trust incoming order if it's non-negative.
                if (Number.isFinite(incomingOrder) && incomingOrder >= 0) {
                    rankOrder = incomingOrder;
                } else if (
                    m.rankId !== undefined &&
                    m.rankId !== null &&
                    idToPos.has(m.rankId)
                ) {
                    rankOrder = idToPos.get(m.rankId)!;
                } else if (m.rankName) {
                    const key = (m.rankName || "").toLowerCase();
                    if (nameToPos.has(key)) rankOrder = nameToPos.get(key)!;
                }
            }

            return {
                userId: m.userId,
                username: m.username,
                rankName: m.rankName ?? "",
                rankOrder,
                figure: m.figure ?? "",
            };
        });

        setMembersNorm(normalized);
    }, [membersRaw, gangRanks]);

    /* ---- compute admin/owner if server didn't set flags ---- */
    useEffect(() => {
        if (!viewer) return;

        const topPos = gangRanks.reduce(
            (max, r) => Math.max(max, r.position),
            -Infinity
        );
        const viewersRank =
            membersNorm.find((m) => m.userId === viewer.userId)?.rankOrder ??
            -1;

        const topIsAdmin =
            gangRanks.find((r) => r.position === topPos)?.administrator ??
            false;

        // treat highest admin rank as "owner" if server flag missing
        if (!isGangOwner && viewersRank === topPos && topIsAdmin)
            setIsGangOwner(true);

        const viewersAdmin =
            gangRanks.find((r) => r.position === viewersRank)?.administrator ??
            false;

        if (!isGangAdmin && (viewersAdmin || isGangOwner)) setIsGangAdmin(true);
    }, [viewer, membersNorm, gangRanks, isGangOwner, isGangAdmin]);

    /* ---- hydrate from last known ---- */
    useEffect(() => {
        const s = (window as any).__lastGangStatus;
        if (s && typeof s === "object") {
            if (s.gangName) setGangName(s.gangName);
            if (Number.isFinite(s.gangRank)) setGangRank(Number(s.gangRank));
            if (s.primaryColor)
                setPrimaryColor(withHash(s.primaryColor) || "#000000");
            if (s.secondaryColor)
                setSecondaryColor(withHash(s.secondaryColor) || "#000000");
            if (s.iconKey) setGangIcon(String(s.iconKey).toUpperCase());
            applyTurfData(s);
        }
    }, [applyTurfData]);

    /* ---- wire events ---- */
    useEffect(() => {
        const applyStatus = (data: any) => {
            if (!data) return;
            (window as any).__lastGangStatus = data;

            setGangName(data.gangName ?? "");
            setGangRank(Number(data.gangRank ?? 0) || 0);

            if (data.primaryColor)
                setPrimaryColor(withHash(data.primaryColor) || "#000000");
            if (data.secondaryColor)
                setSecondaryColor(withHash(data.secondaryColor) || "#000000");

            // icon key
            let key: string = (data.iconKey ?? data.icon ?? "")
                .toString()
                .trim();
            if (!key && typeof data.iconUrl === "string") {
                const m = data.iconUrl.match(/\/([A-Z0-9]+)\.(gif|png)$/i);
                if (m) key = m[1];
            }
            if (key) setGangIcon(key.toUpperCase());

            // stats
            setGangXP(Number(data.xp ?? 0));
            setGangXPMax(Number(data.maxXp ?? 100));
            setGangKills(Number(data.kills ?? 0));
            setGangDeaths(Number(data.deaths ?? 0));
            setGangRobberies(Number(data.robberies ?? 0));
            setGangPickpockets(Number(data.pickpockets ?? 0));
            setGangDamage(Number(data.totalDamage ?? 0));

            const tcount = Number(
                data.turfsControlled ?? data.turfCount ?? NaN
            );
            const ownedCount = applyTurfData(data);
            setGangTurfCount(Number.isNaN(tcount) ? ownedCount : tcount);

            setIsGangOwner(!!(data.isGangOwner || data.owner));
            setIsGangAdmin(
                !!(
                    data.isAdmin ||
                    data.isGangAdmin ||
                    data.admin ||
                    data.isGangOwner ||
                    data.owner
                )
            );
        };

        const handleStatus = (ev: Event) =>
            applyStatus((ev as CustomEvent).detail);

        const handleMembers = (ev: Event) => {
            let detail: any = (ev as CustomEvent).detail;

            if (detail?.gangMembers) detail = detail.gangMembers;
            if (detail?.members) detail = detail.members;
            if (detail?.list) detail = detail.list;
            if (detail?.data) detail = detail.data;

            if (!Array.isArray(detail)) {
                console.warn("Gang members payload malformed:", detail);
                return;
            }

            const mapped: GangMemberRaw[] = detail.map((m: any) => ({
                userId: Number(m.userId ?? m.id ?? m.user_id),
                username: String(m.username ?? m.name ?? ""),
                figure: String(m.figure ?? m.look ?? ""),
                rankName: String(m.rankName ?? m.roleName ?? ""),
                rankId: m.rankId ?? m.roleId ?? null,
                rankOrder: m.rankOrder ?? m.position ?? m.rank_pos ?? -1,
            }));

            setMembersRaw(mapped);
            setMembersLoading(false);
            setMembersError(null);
        };

        const handleRanks = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const ranks: any[] = Array.isArray(detail?.ranks)
                ? detail.ranks
                : Array.isArray(detail)
                ? detail
                : [];

            const mapped: GangRank[] = ranks.map((r: any) => ({
                id: Number(r.id),
                name: String(r.name ?? ""),
                position: Number(r.position ?? r.rankOrder ?? r.order ?? 0),
                canInvite: !!(r.canInvite ?? r.invite),
                canKick: !!(r.canKick ?? r.kick),
                canPromote: !!(r.canPromote ?? r.promote),
                canAlert: !!(r.canAlert ?? r.alert),
                administrator: !!(r.administrator ?? r.admin),
                canAccessBank: !!(r.canAccessBank ?? r.bank),
            }));

            setGangRanks(mapped);
            setRanksLoading(false);
        };

        window.addEventListener(
            "gang_status_result",
            handleStatus as EventListener
        );
        window.addEventListener(
            "gang_status_received",
            handleStatus as EventListener
        );
        window.addEventListener(
            "gang_members_result",
            handleMembers as EventListener
        );
        window.addEventListener(
            "gang_members_received",
            handleMembers as EventListener
        );
        window.addEventListener("gang_members", handleMembers as EventListener);
        window.addEventListener(
            "gang_member_list",
            handleMembers as EventListener
        );
        window.addEventListener(
            "gang_ranks_received",
            handleRanks as EventListener
        );
        window.addEventListener(
            "gang_ranks_result",
            handleRanks as EventListener
        );

        // palette
        SendMessageComposer(new GetPartPaletteHexesComposer("cc"));
        const onHexes = (ev: Event) => {
            const { part, hexes } = (ev as CustomEvent).detail || {};
            if (part !== "cc" || !Array.isArray(hexes)) return;
            setCcSwatches(
                hexes.map((h: string) => `#${String(h).toUpperCase()}`)
            );
        };
        window.addEventListener(
            "palette_hexes_result",
            onHexes as EventListener
        );

        // initial position
        const saved = localStorage.getItem("gangs-detail-position");
        if (saved) {
            try {
                const p = JSON.parse(saved);
                const clamped = getClampedPos(
                    p.x ?? 100,
                    p.y ?? 100,
                    rootRef.current
                );
                setPosition(clamped);
                localStorage.setItem(
                    "gangs-detail-position",
                    JSON.stringify(clamped)
                );
            } catch {}
        } else {
            const w = rootRef.current?.offsetWidth ?? 650;
            const h = rootRef.current?.offsetHeight ?? 420;
            const centered = getClampedPos(
                Math.round((window.innerWidth - w) / 2),
                Math.round((window.innerHeight - h) / 2),
                rootRef.current
            );
            setPosition(centered);
        }
        setPositionReady(true);
        refreshAll();

        return () => {
            window.removeEventListener(
                "gang_status_result",
                handleStatus as EventListener
            );
            window.removeEventListener(
                "gang_status_received",
                handleStatus as EventListener
            );
            window.removeEventListener(
                "gang_members_result",
                handleMembers as EventListener
            );
            window.removeEventListener(
                "gang_members_received",
                handleMembers as EventListener
            );
            window.removeEventListener(
                "gang_members",
                handleMembers as EventListener
            );
            window.removeEventListener(
                "gang_member_list",
                handleMembers as EventListener
            );
            window.removeEventListener(
                "gang_ranks_received",
                handleRanks as EventListener
            );
            window.removeEventListener(
                "gang_ranks_result",
                handleRanks as EventListener
            );
            window.removeEventListener(
                "palette_hexes_result",
                onHexes as EventListener
            );
        };
    }, [refreshAll, applyTurfData]);

    /* refresh ranks/members when switching to Members tab (with retry) */
    useEffect(() => {
        if (activeTab !== "members") return;

        setMembersLoading(true);
        setRanksLoading(true);
        setMembersError(null);

        const request = () => {
            try {
                if (GetGangMembersComposer)
                    SendMessageComposer(new GetGangMembersComposer());
            } catch {}
            try {
                if (GetGangRanksComposer)
                    SendMessageComposer(new GetGangRanksComposer());
            } catch {}

            window.dispatchEvent(new CustomEvent("request_gang_members"));
            window.dispatchEvent(new CustomEvent("request_gang_ranks"));
        };

        request();

        const retry = window.setTimeout(() => {
            const noMembers = membersRaw.length === 0;
            const noRanks = gangRanks.length === 0;

            if (noMembers || noRanks) request();

            window.setTimeout(() => {
                if (activeTab !== "members") return;
                if (membersRaw.length === 0 && gangRanks.length === 0) {
                    setMembersError("Couldn’t load gang data. Try Refresh.");
                    setMembersLoading(false);
                    setRanksLoading(false);
                }
            }, 650);
        }, 650);

        return () => window.clearTimeout(retry);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    /* clamp when resizing */
    useEffect(() => {
        const onResize = () =>
            setPosition((p) => getClampedPos(p.x, p.y, rootRef.current));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    /* grouped members by rank position */
    const groupedMembers = useMemo(() => {
        const map: Record<number, GangMemberNorm[]> = {};
        for (const m of membersNorm) {
            const k = Number.isFinite(m.rankOrder) ? m.rankOrder : -1;
            if (!map[k]) map[k] = [];
            map[k].push(m);
        }
        return map;
    }, [membersNorm]);

    const knownPositions = new Set(gangRanks.map((r) => r.position));
    const orphanPositions = Object.keys(groupedMembers)
        .map(Number)
        .filter(
            (p) =>
                p !== -1 && !knownPositions.has(p) && groupedMembers[p]?.length
        );

    const toggleCollapse = (rankOrder: number) => {
        setCollapsedRanks((prev) =>
            prev.includes(rankOrder)
                ? prev.filter((r) => r !== rankOrder)
                : [...prev, rankOrder]
        );
    };

    /* ---- actions ---- */
    const [inviteUsername, setInviteUsername] = useState("");
    const sendGangInvite = () => {
        const u = inviteUsername.trim();
        if (!u) return;
        SendMessageComposer(new GangInviteComposer(u));
        setInviteUsername("");
        setTimeout(refreshAll, 120);
    };

    const handleLeaveGangClick = () => {
        SendMessageComposer(new LeaveGangComposer());

        setMembersRaw([]);
        setMembersNorm([]);
        setIsGangOwner(false);
        setIsGangAdmin(false);

        setOwnsNorth(false);
        setOwnsSouth(false);
        setOwnsEast(false);
        setOwnsWest(false);

        (window as any).__lastGangStatus = {
            inGang: false,
            gangName: "",
            gangRank: 0,
            primaryColor: "",
            secondaryColor: "",
            xp: 0,
            maxXp: 0,
            kills: 0,
            deaths: 0,
            robberies: 0,
            pickpockets: 0,
            totalDamage: 0,
            turfsControlled: 0,
            isGangAdmin: false,
            iconKey: "",
        };

        setTimeout(() => {
            refreshAll();
            onClose();
        }, 120);
    };

    const handleEditRoleSubmit = () => {
        if (!editRoleId) return;
        SendMessageComposer(
            new EditGangRoleComposer(
                editRoleId,
                roleName,
                rolePermissions.bankAccess,
                rolePermissions.kickMembers,
                rolePermissions.inviteMembers,
                rolePermissions.administrator
            )
        );
        setShowEditRoleModal(false);
        setTimeout(refreshAll, 120);
    };

    const deleteRole = (rankId: number) => {
        setConfirmDeleteRoleId(rankId);
        setShowConfirmRoleDeleteModal(true);
    };

    const confirmDeleteRole = () => {
        if (confirmDeleteRoleId !== null) {
            SendMessageComposer(
                new DeleteGangRoleComposer(confirmDeleteRoleId)
            );
            setTimeout(refreshAll, 120);
        }
        setShowConfirmRoleDeleteModal(false);
        setConfirmDeleteRoleId(null);
    };

    const handleRankChange = (userId: number, newRankPosition: number) => {
        SendMessageComposer(
            new ChangeGangRankComposer(userId, newRankPosition)
        );
        setTimeout(refreshAll, 120);
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onClose(), 250);
    };

    if (!positionReady) return null;

    const selectedIconSrc =
        ICON_OPTIONS.find(
            (i) =>
                iconKeyFromSrc(i.src).toUpperCase() ===
                (gangIcon || "").toUpperCase()
        )?.src ?? (gangIcon ? keyToIconPath(gangIcon) : "");

    /* ===== Modal render helpers ===== */
    const renderConfirmDisband = () =>
        showConfirmDeleteModal && (
            <div className="gangs-modal-overlay">
                <div className="gangs-modal-popup scale-in">
                    <div className="popup-header">
                        <span>Confirm Disband</span>
                        <button
                            className="close-button"
                            onClick={() => setShowConfirmDeleteModal(false)}
                        />
                    </div>

                    <div className="popup-body">
                        <p>
                            Are you sure you want to disband your gang? This
                            cannot be undone.
                        </p>

                        <div className="popup-actions">
                            <button
                                className="gang-btn gang-btn--danger"
                                onClick={() => {
                                    SendMessageComposer(
                                        new DeleteGangMessageComposer()
                                    );
                                    setShowConfirmDeleteModal(false);
                                    setMembersRaw([]);
                                    setMembersNorm([]);
                                    setIsGangOwner(false);
                                    setIsGangAdmin(false);
                                    setTimeout(() => {
                                        refreshAll();
                                        handleClose();
                                    }, 120);
                                }}
                            >
                                Yes, Disband
                            </button>

                            <button
                                className="gang-btn gang-btn--default"
                                onClick={() => setShowConfirmDeleteModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );

    const renderNewRole = () =>
        showNewRoleModal && (
            <div className="gangs-modal-overlay">
                <div className="gangs-modal-popup scale-in">
                    <div className="popup-header">
                        <span>New Role</span>
                        <button
                            className="close-button"
                            onClick={() => setShowNewRoleModal(false)}
                        />
                    </div>

                    <div className="popup-body">
                        <input
                            type="text"
                            className="gangs-invite-input"
                            placeholder="Enter role name"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                        />

                        <div className="permission-checkboxes">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.bankAccess}
                                    onChange={() =>
                                        setRolePermissions((p) => ({
                                            ...p,
                                            bankAccess: !p.bankAccess,
                                        }))
                                    }
                                />{" "}
                                Bank Access
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.kickMembers}
                                    onChange={() =>
                                        setRolePermissions((p) => ({
                                            ...p,
                                            kickMembers: !p.kickMembers,
                                        }))
                                    }
                                />{" "}
                                Kick Members
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.inviteMembers}
                                    onChange={() =>
                                        setRolePermissions((p) => ({
                                            ...p,
                                            inviteMembers: !p.inviteMembers,
                                        }))
                                    }
                                />{" "}
                                Invite Members
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.administrator}
                                    onChange={() =>
                                        setRolePermissions((p) => ({
                                            ...p,
                                            administrator: !p.administrator,
                                        }))
                                    }
                                />{" "}
                                Administrator
                            </label>
                        </div>

                        <div className="popup-actions">
                            <button
                                className="gang-btn gang-btn--success"
                                onClick={() => {
                                    const name = newRoleName.trim();
                                    if (!name) return;
                                    SendMessageComposer(
                                        new CreateGangRoleComposer(
                                            name,
                                            rolePermissions.bankAccess,
                                            rolePermissions.kickMembers,
                                            rolePermissions.inviteMembers,
                                            rolePermissions.administrator
                                        )
                                    );
                                    setShowNewRoleModal(false);
                                    setNewRoleName("");
                                    setRolePermissions({
                                        bankAccess: false,
                                        kickMembers: false,
                                        inviteMembers: false,
                                        administrator: false,
                                    });
                                    setTimeout(refreshAll, 120);
                                }}
                            >
                                Save
                            </button>

                            <button
                                className="gang-btn gang-btn--danger"
                                onClick={() => setShowNewRoleModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );

    const renderEditRole = () =>
        showEditRoleModal && (
            <div className="gangs-modal-overlay">
                <div className="gangs-modal-popup scale-in">
                    <div className="popup-header">
                        <span>Edit Role</span>
                        <button
                            className="close-button"
                            onClick={() => setShowEditRoleModal(false)}
                        />
                    </div>

                    <div className="popup-body">
                        <label>Role Name</label>
                        <input
                            className="gangs-invite-input"
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                        />

                        <div className="permission-checkboxes">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.bankAccess}
                                    onChange={(e) =>
                                        setRolePermissions({
                                            ...rolePermissions,
                                            bankAccess: e.target.checked,
                                        })
                                    }
                                />{" "}
                                Bank Access
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.kickMembers}
                                    onChange={(e) =>
                                        setRolePermissions({
                                            ...rolePermissions,
                                            kickMembers: e.target.checked,
                                        })
                                    }
                                />{" "}
                                Kick Members
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.inviteMembers}
                                    onChange={(e) =>
                                        setRolePermissions({
                                            ...rolePermissions,
                                            inviteMembers: e.target.checked,
                                        })
                                    }
                                />{" "}
                                Invite Members
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.administrator}
                                    onChange={(e) =>
                                        setRolePermissions({
                                            ...rolePermissions,
                                            administrator: e.target.checked,
                                        })
                                    }
                                />{" "}
                                Administrator
                            </label>
                        </div>

                        <div className="popup-actions">
                            <button
                                className="gang-btn gang-btn--success"
                                onClick={handleEditRoleSubmit}
                            >
                                Save Changes
                            </button>

                            <button
                                className="gang-btn gang-btn--danger"
                                onClick={() => setShowEditRoleModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );

    const renderConfirmRoleDelete = () =>
        showConfirmRoleDeleteModal && (
            <div className="gangs-modal-overlay">
                <div className="gangs-modal-popup scale-in">
                    <div className="popup-header">
                        <span>Confirm Deletion</span>
                        <button
                            className="close-button"
                            onClick={() => setShowConfirmRoleDeleteModal(false)}
                        />
                    </div>

                    <div className="popup-body">
                        <p>Are you sure you want to delete this role?</p>

                        <div className="popup-actions">
                            <button
                                className="gang-btn gang-btn--danger"
                                onClick={confirmDeleteRole}
                            >
                                Yes, Delete
                            </button>

                            <button
                                className="gang-btn gang-btn--default"
                                onClick={() => {
                                    setShowConfirmRoleDeleteModal(false);
                                    setConfirmDeleteRoleId(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );

    /* ---- render ---- */
    return (
        <div
            ref={rootRef}
            className={`gangs-detail-view ${visible ? "fade-in" : "fade-out"}`}
            style={{ left: position.x, top: position.y }}
        >
            {/* Header / drag handle */}
            <div
                className="gangs-header"
                onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const start = {
                        x: e.clientX - position.x,
                        y: e.clientY - position.y,
                    };
                    const move = (me: MouseEvent) => {
                        const next = getClampedPos(
                            me.clientX - start.x,
                            me.clientY - start.y,
                            rootRef.current
                        );
                        setPosition(next);
                    };
                    const up = () => {
                        window.removeEventListener("mousemove", move);
                        window.removeEventListener("mouseup", up);
                        const clamped = getClampedPos(
                            position.x,
                            position.y,
                            rootRef.current
                        );
                        localStorage.setItem(
                            "gangs-detail-position",
                            JSON.stringify(clamped)
                        );
                    };
                    window.addEventListener("mousemove", move);
                    window.addEventListener("mouseup", up);
                }}
            >
                <div className="gang-name-header">
                    <div className="gang-color-split-box">
                        <div
                            className="color-half left"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <div
                            className="color-half right"
                            style={{ backgroundColor: secondaryColor }}
                        />

                        {(selectedIconSrc || gangIcon) && (
                            <img
                                className="gang-icon"
                                src={selectedIconSrc || keyToIconPath(gangIcon)}
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                            />
                        )}
                    </div>

                    <div className="gang-name-text">{gangName}</div>
                </div>

                <button className="close-button" onClick={handleClose} />
            </div>

            {/* Tabs */}
            <div className="gangs-tabs">
                <button
                    onClick={() => setActiveTab("general")}
                    className={activeTab === "general" ? "active" : ""}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab("members")}
                    className={activeTab === "members" ? "active" : ""}
                >
                    Members
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={activeTab === "settings" ? "active" : ""}
                >
                    Settings
                </button>
            </div>

            {/* Content */}
            <div className="gangs-content">
                <div className="tab-panel" key={activeTab}>
                    {/* ===== GENERAL TAB ===== */}
                    {activeTab === "general" && (
                        <div className="info-tab">
                            <div className="info-section gang-header">
                                <div className="gang-banner">
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <img
                                            src={
                                                selectedIconSrc ||
                                                keyToIconPath(gangIcon)
                                            }
                                            alt="Gang Logo"
                                            className="gang-banner-icon"
                                        />
                                        <div className="gang-banner-text">
                                            <div className="gang-banner-name">
                                                {gangName || "Gang Name"}
                                            </div>
                                            <div className="gang-banner-rank">
                                                Rank: {gangRank || "—"}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="gang-details"
                                    style={{ marginTop: 10 }}
                                >
                                    <div className="xp-bar-container">
                                        <div
                                            className="xp-bar-fill"
                                            style={{
                                                width: `${
                                                    (gangXP /
                                                        Math.max(
                                                            1,
                                                            gangXPMax
                                                        )) *
                                                    100
                                                }%`,
                                            }}
                                        />
                                    </div>
                                    <div className="xp-text">
                                        XP: {gangXP} / {gangXPMax}
                                    </div>
                                </div>
                            </div>

                            {/* Turfs */}
                            <div className="info-section">
                                <h3>Your Turfs</h3>
                                {(() => {
                                    const ownedMap: Record<string, boolean> = {
                                        north: ownsNorth,
                                        south: ownsSouth,
                                        east: ownsEast,
                                        west: ownsWest,
                                    };

                                    const owned = TURFS.filter(
                                        (t) => ownedMap[t.key]
                                    );

                                    if (!owned.length) {
                                        return (
                                            <div className="no-turfs">
                                                You don’t control any turfs yet.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="turf-grid two-col">
                                            {owned.map((t) => (
                                                <div
                                                    key={t.key}
                                                    className="turf-tile"
                                                >
                                                    <div className="turf-image-wrap">
                                                        <img
                                                            className="turf-image"
                                                            src={t.img}
                                                            alt={t.name}
                                                            draggable={false}
                                                        />
                                                    </div>
                                                    <div className="turf-meta">
                                                        <div className="turf-name">
                                                            {t.name}
                                                        </div>
                                                        <div className="turf-bonus">
                                                            {t.bonus}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Stats */}
                            <div className="info-section">
                                <h3>Gang Stats</h3>
                                <div className="stat-tiles">
                                    <div className="gang-stat">
                                        Total Members:
                                        <span>{membersNorm.length}</span>
                                    </div>
                                    <div className="gang-stat">
                                        Total Kills:<span>{gangKills}</span>
                                    </div>
                                    <div className="gang-stat">
                                        Total Deaths:<span>{gangDeaths}</span>
                                    </div>
                                    <div className="gang-stat">
                                        Robberies:<span>{gangRobberies}</span>
                                    </div>
                                    <div className="gang-stat">
                                        Pick Pockets:
                                        <span>{gangPickpockets}</span>
                                    </div>
                                    <div className="gang-stat">
                                        Total Damage:<span>{gangDamage}</span>
                                    </div>
                                    <div className="gang-stat">
                                        Turfs Controlled:
                                        <span>{gangTurfCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== MEMBERS TAB (OVERHAULED) ===== */}
                    {activeTab === "members" && (
                        <div className="manage-tab">
                            <div className="members-toolbar">
                                <div className="members-toolbar__left">
                                    <div className="members-title">
                                        <span className="name">
                                            {gangName || "Gang"}
                                        </span>
                                        <span className="meta">
                                            {membersLoading || ranksLoading
                                                ? "Loading…"
                                                : `${membersNorm.length} members`}
                                        </span>
                                    </div>
                                </div>

                                <div className="members-toolbar__right">
                                    <div className="invite-row">
                                        <input
                                            type="text"
                                            placeholder="Invite username…"
                                            value={inviteUsername}
                                            onChange={(e) =>
                                                setInviteUsername(
                                                    e.target.value
                                                )
                                            }
                                            className="gangs-invite-input"
                                        />

                                        <button
                                            className="gang-btn gang-btn--default"
                                            onClick={sendGangInvite}
                                            disabled={!inviteUsername.trim()}
                                            title="Send gang invite"
                                        >
                                            Invite
                                        </button>

                                        <button
                                            className="gang-btn gang-btn--default"
                                            onClick={() => {
                                                setMembersLoading(true);
                                                setRanksLoading(true);
                                                setMembersError(null);
                                                refreshAll();
                                            }}
                                            title="Refresh members & ranks"
                                        >
                                            Refresh
                                        </button>

                                        {!isGangOwner && (
                                            <button
                                                className="gang-btn gang-btn--danger"
                                                onClick={handleLeaveGangClick}
                                            >
                                                Leave
                                            </button>
                                        )}

                                        {isGangOwner && (
                                            <button
                                                className="gang-btn gang-btn--danger"
                                                onClick={() =>
                                                    setShowConfirmDeleteModal(
                                                        true
                                                    )
                                                }
                                            >
                                                Disband
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {membersError && (
                                <div className="members-error">
                                    {membersError}
                                </div>
                            )}

                            {(membersLoading || ranksLoading) && (
                                <div className="members-skeleton">
                                    <div className="s-row" />
                                    <div className="s-row" />
                                    <div className="s-row" />
                                </div>
                            )}

                            {!ranksLoading &&
                                gangRanks
                                    .slice()
                                    .sort((a, b) => a.position - b.position)
                                    .map((rank) => {
                                        const members =
                                            groupedMembers[rank.position] || [];
                                        const isCollapsed =
                                            collapsedRanks.includes(
                                                rank.position
                                            );

                                        return (
                                            <div
                                                key={rank.id}
                                                className="rank-group"
                                            >
                                                <button
                                                    type="button"
                                                    className={`rank-head ${
                                                        isCollapsed
                                                            ? "is-collapsed"
                                                            : "is-open"
                                                    }`}
                                                    onClick={() =>
                                                        toggleCollapse(
                                                            rank.position
                                                        )
                                                    }
                                                >
                                                    <div className="rank-head__left">
                                                        <span
                                                            className="rank-arrow"
                                                            aria-hidden="true"
                                                        >
                                                            ▼
                                                        </span>
                                                        <span className="rank-name">
                                                            {rank.name}
                                                        </span>

                                                        <div className="role-badges">
                                                            {rank.administrator && (
                                                                <span className="badge admin">
                                                                    ADMIN
                                                                </span>
                                                            )}
                                                            {rank.canAccessBank && (
                                                                <span className="badge bank">
                                                                    BANK
                                                                </span>
                                                            )}
                                                            {rank.canKick && (
                                                                <span className="badge kick">
                                                                    KICK
                                                                </span>
                                                            )}
                                                            {rank.canInvite && (
                                                                <span className="badge invite">
                                                                    INVITE
                                                                </span>
                                                            )}
                                                            {rank.canPromote && (
                                                                <span className="badge promote">
                                                                    PROMOTE
                                                                </span>
                                                            )}
                                                            {rank.canAlert && (
                                                                <span className="badge alert">
                                                                    ALERT
                                                                </span>
                                                            )}
                                                        </div>

                                                        <span className="rank-count">
                                                            {members.length}
                                                        </span>
                                                    </div>

                                                    {ownerOrAdmin && (
                                                        <div
                                                            className="rank-head__right"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            <button
                                                                className="gang-btn gang-btn--default is-small"
                                                                onClick={() => {
                                                                    setEditRoleId(
                                                                        rank.id
                                                                    );
                                                                    setRoleName(
                                                                        rank.name
                                                                    );
                                                                    setRolePermissions(
                                                                        {
                                                                            bankAccess:
                                                                                !!rank.canAccessBank,
                                                                            kickMembers:
                                                                                !!rank.canKick,
                                                                            inviteMembers:
                                                                                !!rank.canInvite,
                                                                            administrator:
                                                                                !!rank.administrator,
                                                                        }
                                                                    );
                                                                    setShowEditRoleModal(
                                                                        true
                                                                    );
                                                                }}
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                className="gang-btn gang-btn--danger is-small"
                                                                onClick={() =>
                                                                    deleteRole(
                                                                        rank.id
                                                                    )
                                                                }
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </button>

                                                <div
                                                    className={`rank-body ${
                                                        isCollapsed
                                                            ? "is-collapsed"
                                                            : "is-open"
                                                    }`}
                                                >
                                                    <div className="rank-body__inner">
                                                        {members.length > 0 ? (
                                                            <div className="member-grid">
                                                                {members.map(
                                                                    (
                                                                        member
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                member.userId
                                                                            }
                                                                            className="member-card"
                                                                        >
                                                                            <img
                                                                                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                                                                                    member.figure
                                                                                )}&headonly=1&direction=2&gesture=sml`}
                                                                                alt={
                                                                                    member.username
                                                                                }
                                                                                draggable={
                                                                                    false
                                                                                }
                                                                            />

                                                                            <div
                                                                                className="member-name"
                                                                                title={
                                                                                    member.username
                                                                                }
                                                                            >
                                                                                {
                                                                                    member.username
                                                                                }
                                                                            </div>

                                                                            {ownerOrAdmin &&
                                                                                viewer?.userId !==
                                                                                    member.userId && (
                                                                                    <select
                                                                                        className="member-rank-select"
                                                                                        value={
                                                                                            member.rankOrder
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            handleRankChange(
                                                                                                member.userId,
                                                                                                parseInt(
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                                    10
                                                                                                )
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        {gangRanks
                                                                                            .slice()
                                                                                            .sort(
                                                                                                (
                                                                                                    a,
                                                                                                    b
                                                                                                ) =>
                                                                                                    a.position -
                                                                                                    b.position
                                                                                            )
                                                                                            .map(
                                                                                                (
                                                                                                    r
                                                                                                ) => (
                                                                                                    <option
                                                                                                        key={
                                                                                                            r.position
                                                                                                        }
                                                                                                        value={
                                                                                                            r.position
                                                                                                        }
                                                                                                    >
                                                                                                        {
                                                                                                            r.name
                                                                                                        }
                                                                                                    </option>
                                                                                                )
                                                                                            )}
                                                                                    </select>
                                                                                )}
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="members-empty">
                                                                No members in
                                                                this role.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                            {/* Orphan positions (no matching rank object) */}
                            {orphanPositions.map((pos) => (
                                <div
                                    key={`orphan-${pos}`}
                                    className="rank-group"
                                >
                                    <button
                                        type="button"
                                        className={`rank-head ${
                                            collapsedRanks.includes(pos)
                                                ? "is-collapsed"
                                                : "is-open"
                                        }`}
                                        onClick={() => toggleCollapse(pos)}
                                    >
                                        <div className="rank-head__left">
                                            <span
                                                className="rank-arrow"
                                                aria-hidden="true"
                                            >
                                                ▼
                                            </span>
                                            <span className="rank-name is-muted">
                                                Unknown Role (pos {pos})
                                            </span>
                                            <span className="rank-count">
                                                {groupedMembers[pos]?.length ??
                                                    0}
                                            </span>
                                        </div>
                                    </button>

                                    <div
                                        className={`rank-body ${
                                            collapsedRanks.includes(pos)
                                                ? "is-collapsed"
                                                : "is-open"
                                        }`}
                                    >
                                        <div className="rank-body__inner">
                                            <div className="member-grid">
                                                {groupedMembers[pos].map(
                                                    (member) => (
                                                        <div
                                                            key={member.userId}
                                                            className="member-card"
                                                        >
                                                            <img
                                                                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                                                                    member.figure
                                                                )}&headonly=1&direction=2&gesture=sml`}
                                                                alt={
                                                                    member.username
                                                                }
                                                                draggable={
                                                                    false
                                                                }
                                                            />
                                                            <div className="member-name">
                                                                {
                                                                    member.username
                                                                }
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Unranked */}
                            {groupedMembers[-1] && (
                                <div className="rank-group">
                                    <button
                                        type="button"
                                        className={`rank-head ${
                                            collapsedRanks.includes(-1)
                                                ? "is-collapsed"
                                                : "is-open"
                                        }`}
                                        onClick={() => toggleCollapse(-1)}
                                    >
                                        <div className="rank-head__left">
                                            <span
                                                className="rank-arrow"
                                                aria-hidden="true"
                                            >
                                                ▼
                                            </span>
                                            <span className="rank-name is-muted">
                                                No Role
                                            </span>
                                            <span className="rank-count">
                                                {groupedMembers[-1].length}
                                            </span>
                                        </div>
                                    </button>

                                    <div
                                        className={`rank-body ${
                                            collapsedRanks.includes(-1)
                                                ? "is-collapsed"
                                                : "is-open"
                                        }`}
                                    >
                                        <div className="rank-body__inner">
                                            {groupedMembers[-1].length > 0 ? (
                                                <div className="member-grid">
                                                    {groupedMembers[-1].map(
                                                        (member) => (
                                                            <div
                                                                key={
                                                                    member.userId
                                                                }
                                                                className="member-card"
                                                            >
                                                                <img
                                                                    src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                                                                        member.figure
                                                                    )}&headonly=1&direction=2&gesture=sml`}
                                                                    alt={
                                                                        member.username
                                                                    }
                                                                    draggable={
                                                                        false
                                                                    }
                                                                />
                                                                <div className="member-name">
                                                                    {
                                                                        member.username
                                                                    }
                                                                </div>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="members-empty">
                                                    No members without roles.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {ownerOrAdmin && (
                                <div className="members-footer">
                                    <button
                                        className="gang-btn gang-btn--success"
                                        onClick={() =>
                                            setShowNewRoleModal(true)
                                        }
                                    >
                                        + Add Role
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== SETTINGS TAB ===== */}
                    {activeTab === "settings" && (
                        <div className="settings-tab">
                            <div className="settings-row two-col">
                                <div className="settings-col">
                                    <h3>Primary Color</h3>
                                    <PaginatedSwatchGrid
                                        swatches={ccSwatches}
                                        value={primaryColor}
                                        onChange={setPrimaryColor}
                                    />
                                </div>
                                <div className="settings-col">
                                    <h3>Secondary Color</h3>
                                    <PaginatedSwatchGrid
                                        swatches={ccSwatches}
                                        value={secondaryColor}
                                        onChange={setSecondaryColor}
                                    />
                                </div>
                            </div>

                            <div className="settings-row two-col">
                                <div className="settings-col">
                                    <h3>Gang Icon</h3>
                                    <div className="icon-selector">
                                        {visibleIcons.map((icon) => {
                                            const key = iconKeyFromSrc(
                                                icon.src
                                            );
                                            const isSelected =
                                                key.toUpperCase() ===
                                                (gangIcon || "").toUpperCase();
                                            const isLocked =
                                                !!icon.vip && gangRank < 2;

                                            const clickIcon = () => {
                                                if (isLocked) {
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            "nitro_alert",
                                                            {
                                                                detail: "VIP icons unlock at Rank 2.",
                                                            }
                                                        )
                                                    );
                                                    return;
                                                }
                                                setGangIcon(key);
                                            };

                                            return (
                                                <div
                                                    key={icon.name}
                                                    className={`icon-option ${
                                                        isSelected
                                                            ? "selected"
                                                            : ""
                                                    } ${
                                                        isLocked ? "locked" : ""
                                                    }`}
                                                    onClick={clickIcon}
                                                    title={
                                                        isLocked
                                                            ? `${icon.name} (VIP – Rank 2+)`
                                                            : icon.name
                                                    }
                                                >
                                                    <img
                                                        src={icon.src}
                                                        alt={icon.name}
                                                    />
                                                    {isLocked && (
                                                        <span className="vip-tag">
                                                            VIP
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="pagination-controls">
                                        <button
                                            className="gang-btn gang-btn--default is-small"
                                            onClick={() =>
                                                setIconsPage((p) =>
                                                    Math.max(p - 1, 0)
                                                )
                                            }
                                            disabled={iconsPage === 0}
                                        >
                                            ◀
                                        </button>
                                        <span>
                                            {iconsPage + 1} / {totalIconPages}
                                        </span>
                                        <button
                                            className="gang-btn gang-btn--default is-small"
                                            onClick={() =>
                                                setIconsPage((p) =>
                                                    Math.min(
                                                        totalIconPages - 1,
                                                        p + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                iconsPage >= totalIconPages - 1
                                            }
                                        >
                                            ▶
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-col">
                                    <h3>Preview</h3>
                                    <div className="gang-preview settings">
                                        <div
                                            className="preview-colors"
                                            style={{
                                                background: `linear-gradient(to right, ${primaryColor} 50%, ${secondaryColor} 50%)`,
                                            }}
                                        >
                                            {selectedIconSrc && (
                                                <img
                                                    className="icon-overlay"
                                                    src={selectedIconSrc}
                                                    alt="icon"
                                                />
                                            )}
                                        </div>
                                        <div className="gang-preview-name">
                                            {gangName || "Your Gang"}
                                        </div>
                                    </div>

                                    <div className="settings-actions right">
                                        <button
                                            className="gang-btn gang-btn--success"
                                            onClick={() => {
                                                SendMessageComposer(
                                                    new EditGangComposer(
                                                        stripHash(primaryColor),
                                                        stripHash(
                                                            secondaryColor
                                                        ),
                                                        gangIcon || ""
                                                    )
                                                );
                                                setTimeout(refreshAll, 120);
                                                onClose();
                                            }}
                                        >
                                            Save Appearance
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal layer */}
            <div className="gangs-modal-layer">
                {renderConfirmDisband()}
                {renderNewRole()}
                {renderEditRole()}
                {renderConfirmRoleDelete()}
            </div>
        </div>
    );
};

export default GangsDetailView;
