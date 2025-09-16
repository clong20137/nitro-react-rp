import { FC, useEffect, useMemo, useRef, useState } from "react";
import "./GangsDetailView.scss";
import { Nitro } from "@nitrots/nitro-renderer";
import { SendMessageComposer } from "../../api";

// Actions
import { GangInviteComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GangInviteComposer";
import { CreateGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CreateGangRoleComposer";
import { DeleteGangMessageComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangMessageComposer";
import { DeleteGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangRoleComposer";
import { EditGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangRoleComposer";
import { LeaveGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/LeaveGangComposer";
import { ChangeGangRankComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeGangRankComposer";
import { EditGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangComposer";
import { GetPartPaletteHexesComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetPartPaletteHExesComposer";

// Optional getters (guarded)
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

interface GangsDetailViewProps {
    onClose: () => void;
}

interface GangMemberRaw {
    userId: number;
    username: string;
    rankName?: string;
    rankId?: number;
    rankOrder?: number;
    figure?: string;
}

interface GangMemberNorm {
    userId: number;
    username: string;
    rankName: string;
    rankOrder: number;
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
    { name: "Golden Crown", src: "/icons/badges/FRH44.gif", vip: false },
    { name: "Cowboy Hat", src: "/icons/badges/US515.gif", vip: false },
    { name: "Pink Heart", src: "/icons/badges/DE21H.gif", vip: true },
];

const iconKeyFromSrc = (src: string): string => {
    const m = src.match(/\/([^\/]+)\.(gif|png)$/i);
    return m ? m[1] : "";
};
const keyToIconPath = (key?: string) =>
    key
        ? `/icons/badges/${key.toUpperCase()}.gif`
        : "/icons/badges/default.gif";
const stripHash = (hex: string) => hex.replace(/^#/, "");

export const GangsDetailView: FC<GangsDetailViewProps> = ({ onClose }) => {
    // Basic gang state
    const [gangName, setGangName] = useState("");
    const [gangRank, setGangRank] = useState(0);

    // Colors & icon key
    const [primaryColor, setPrimaryColor] = useState("#000000");
    const [secondaryColor, setSecondaryColor] = useState("#000000");
    const [gangIcon, setGangIcon] = useState<string>("");

    // Tabs
    const [activeTab, setActiveTab] = useState<"info" | "manage" | "settings">(
        "info"
    );

    // Members / ranks
    const [inviteUsername, setInviteUsername] = useState("");
    const [membersRaw, setMembersRaw] = useState<GangMemberRaw[]>([]);
    const [membersNorm, setMembersNorm] = useState<GangMemberNorm[]>([]);
    const [gangRanks, setGangRanks] = useState<GangRank[]>([]);
    const [collapsedRanks, setCollapsedRanks] = useState<number[]>([]);

    // UI state
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [editRoleId, setEditRoleId] = useState<number | null>(null);
    const [roleName, setRoleName] = useState("");
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [showNewRoleModal, setShowNewRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [visible, setVisible] = useState(true);
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

    // Viewer / permissions
    const currentUsername = Nitro.instance.sessionDataManager.userName;
    const viewer = useMemo(
        () => membersNorm.find((m) => m.username === currentUsername),
        [membersNorm, currentUsername]
    );
    const [isGangAdmin, setIsGangAdmin] = useState(false);
    const [isGangOwner, setIsGangOwner] = useState(false);

    // Stats
    const [gangXP, setGangXP] = useState(0);
    const [gangXPMax, setGangXPMax] = useState(100);
    const [gangKills, setGangKills] = useState(0);
    const [gangDeaths, setGangDeaths] = useState(0);
    const [gangRobberies, setGangRobberies] = useState(0);
    const [gangPickpockets, setGangPickpockets] = useState(0);
    const [gangDamage, setGangDamage] = useState(0);
    const [gangTurfCount, setGangTurfCount] = useState(0);

    // Palette & Icons
    const [ccSwatches, setCcSwatches] = useState<string[]>([]);
    const ICONS_PER_PAGE = 16;
    const [iconsPage, setIconsPage] = useState(0);
    const totalIconPages = Math.ceil(ICON_OPTIONS.length / ICONS_PER_PAGE);
    const visibleIcons = ICON_OPTIONS.slice(
        iconsPage * ICONS_PER_PAGE,
        (iconsPage + 1) * ICONS_PER_PAGE
    );

    // Dragging/position
    const rootRef = useRef<HTMLDivElement>(null);
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

    const selectedIconSrc =
        ICON_OPTIONS.find(
            (i) =>
                iconKeyFromSrc(i.src).toUpperCase() ===
                (gangIcon || "").toUpperCase()
        )?.src ?? (gangIcon ? keyToIconPath(gangIcon) : "");

    // Helpers
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

    const refreshAll = () => {
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
        // DOM bridge fallbacks
        window.dispatchEvent(new CustomEvent("request_gang_status"));
        window.dispatchEvent(new CustomEvent("request_gang_members"));
        window.dispatchEvent(new CustomEvent("request_gang_ranks"));
    };

    // Normalize members whenever raw members or ranks change
    useEffect(() => {
        if (!membersRaw.length) {
            setMembersNorm([]);
            return;
        }
        const idToPos = new Map<number, number>();
        for (const r of gangRanks) idToPos.set(r.id, r.position);

        const normalized: GangMemberNorm[] = membersRaw.map((m) => ({
            userId: m.userId,
            username: m.username,
            rankName: m.rankName ?? "",
            rankOrder:
                (Number.isFinite(m.rankOrder)
                    ? (m.rankOrder as number)
                    : undefined) ??
                (m.rankId !== undefined ? idToPos.get(m.rankId) : undefined) ??
                -1,
            figure: m.figure ?? "",
        }));

        setMembersNorm(normalized);
    }, [membersRaw, gangRanks]);

    // Compute admin/owner if server didn't set flags
    useEffect(() => {
        if (!viewer) return;

        // If owner not explicitly set, guess by top position + administrator flag
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
        if (!isGangOwner && viewersRank === topPos && topIsAdmin)
            setIsGangOwner(true);

        // Admin if rank has administrator OR if already owner
        const viewersAdmin =
            gangRanks.find((r) => r.position === viewersRank)?.administrator ??
            false;
        if (!isGangAdmin && (viewersAdmin || isGangOwner)) setIsGangAdmin(true);
    }, [viewer, membersNorm, gangRanks, isGangOwner, isGangAdmin]);

    // Listeners/bootstrap
    useEffect(() => {
        const handleStatus = (ev: Event) => {
            const data: any = (ev as CustomEvent).detail;
            if (!data) return;

            setGangName(data.gangName ?? "");
            setGangRank(Number(data.gangRank ?? 0) || 0);

            const primary = data.primaryColor?.startsWith("#")
                ? data.primaryColor
                : data.primaryColor
                ? `#${data.primaryColor}`
                : "#000000";
            const secondary = data.secondaryColor?.startsWith("#")
                ? data.secondaryColor
                : data.secondaryColor
                ? `#${data.secondaryColor}`
                : "#000000";
            setPrimaryColor(primary);
            setSecondaryColor(secondary);

            let key: string = (data.iconKey ?? data.icon ?? "")
                .toString()
                .trim();
            if (!key && typeof data.iconUrl === "string") {
                const m = data.iconUrl.match(/\/([A-Z0-9]+)\.(gif|png)$/i);
                if (m) key = m[1];
            }
            if (key) setGangIcon(key.toUpperCase());

            // Stats
            setGangXP(Number(data.xp ?? 0));
            setGangXPMax(Number(data.maxXp ?? 100));
            setGangKills(Number(data.kills ?? 0));
            setGangDeaths(Number(data.deaths ?? 0));
            setGangRobberies(Number(data.robberies ?? 0));
            setGangPickpockets(Number(data.pickpockets ?? 0));
            setGangDamage(Number(data.totalDamage ?? 0));
            setGangTurfCount(
                Number(data.turfsControlled ?? data.turfCount ?? 0)
            );

            // Permissions (prefer server truth); owner implies admin
            const owner = !!(data.isGangOwner || data.owner);
            const admin = !!(
                data.isAdmin ||
                data.isGangAdmin ||
                data.admin ||
                owner
            );
            setIsGangOwner(owner);
            setIsGangAdmin(admin);
            // Debug
            console.debug("[Gangs] status:", { owner, admin, data });
        };

        const coerceMemberArray = (detail: any): any[] => {
            if (Array.isArray(detail)) return detail;
            if (Array.isArray(detail?.members)) return detail.members;
            if (Array.isArray(detail?.list)) return detail.list;
            if (Array.isArray(detail?.data)) return detail.data;
            return [];
        };

        const handleMembers = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const src = coerceMemberArray(detail);
            console.debug("[Gangs] members payload →", detail);
            const mapped: GangMemberRaw[] = src.map((m: any) => ({
                userId: Number(m.userId ?? m.id ?? m.user_id),
                username: String(m.username ?? m.name ?? m.userName ?? ""),
                rankName: m.rankName ?? m.roleName ?? m.rank ?? "",
                rankId:
                    m.rankId !== undefined
                        ? Number(m.rankId)
                        : m.roleId !== undefined
                        ? Number(m.roleId)
                        : undefined,
                rankOrder:
                    m.rankOrder !== undefined
                        ? Number(m.rankOrder)
                        : m.position !== undefined
                        ? Number(m.position)
                        : m.rank_pos !== undefined
                        ? Number(m.rank_pos)
                        : undefined,
                figure: String(m.figure ?? m.look ?? m.avatar ?? ""),
            }));
            setMembersRaw(mapped);
        };

        const handleRanks = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail;
            const ranks: any[] = Array.isArray(detail?.ranks)
                ? detail.ranks
                : Array.isArray(detail)
                ? detail
                : [];
            const mapped: GangRank[] = ranks.map((r) => ({
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
        };

        // Status / members / ranks events (include common aliases)
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

        // Palette
        SendMessageComposer(new GetPartPaletteHexesComposer("cc"));
        const onHexes = (ev: Event) => {
            const { part, hexes } = (ev as CustomEvent).detail || {};
            if (part !== "cc" || !Array.isArray(hexes)) return;
            const withHash = hexes.map(
                (h: string) => `#${String(h).toUpperCase()}`
            );
            setCcSwatches(withHash);
            if (withHash.length) {
                if (!withHash.includes(primaryColor))
                    setPrimaryColor(withHash[0]);
                if (!withHash.includes(secondaryColor))
                    setSecondaryColor(withHash[0]);
            }
        };
        window.addEventListener(
            "palette_hexes_result",
            onHexes as EventListener
        );

        // Position: use saved (clamped) or center once
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

        // Request AFTER listeners attach
        const t = setTimeout(refreshAll, 0);

        return () => {
            clearTimeout(t);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onResize = () =>
            setPosition((p) => getClampedPos(p.x, p.y, rootRef.current));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Group members by rank position
    const groupedMembers = useMemo(() => {
        const map: Record<number, GangMemberNorm[]> = {};
        for (const m of membersNorm) {
            const k = Number.isFinite(m.rankOrder) ? m.rankOrder : -1;
            if (!map[k]) map[k] = [];
            map[k].push(m);
        }
        return map;
    }, [membersNorm]);

    const toggleCollapse = (rankOrder: number) => {
        setCollapsedRanks((prev) =>
            prev.includes(rankOrder)
                ? prev.filter((r) => r !== rankOrder)
                : [...prev, rankOrder]
        );
    };

    // Actions
    const sendGangInvite = () => {
        const u = inviteUsername.trim();
        if (!u) return;
        SendMessageComposer(new GangInviteComposer(u));
        setInviteUsername("");
        setTimeout(refreshAll, 120);
    };

    const handleLeaveGangClick = () => {
        SendMessageComposer(new LeaveGangComposer());
        // Clear local UI quickly to avoid ghost state
        setMembersRaw([]);
        setMembersNorm([]);
        setIsGangOwner(false);
        setIsGangAdmin(false);
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

    const SwatchGrid: FC<{
        value: string;
        onChange: (hex: string) => void;
    }> = ({ value, onChange }) => (
        <div className="swatch-grid">
            {ccSwatches.map((hex) => (
                <button
                    key={hex}
                    className={"swatch" + (hex === value ? " selected" : "")}
                    style={{ backgroundColor: hex }}
                    onClick={() => onChange(hex)}
                    title={hex}
                />
            ))}
            {!ccSwatches.length && (
                <div className="swatch-loading">Loading colors…</div>
            )}
        </div>
    );

    const ownerOrAdmin = isGangOwner || isGangAdmin; // convenience

    return (
        <div
            ref={rootRef}
            className={`gangs-detail-view ${visible ? "fade-in" : "fade-out"}`}
            style={{ position: "absolute", left: position.x, top: position.y }}
        >
            <div
                className="gangs-header"
                onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const start = {
                        x: e.clientX - position.x,
                        y: e.clientY - position.y,
                    };
                    const move = (me: MouseEvent) =>
                        setPosition(
                            getClampedPos(
                                me.clientX - start.x,
                                me.clientY - start.y,
                                rootRef.current
                            )
                        );
                    const up = () => {
                        window.removeEventListener("mousemove", move);
                        window.removeEventListener("mouseup", up);
                        localStorage.setItem(
                            "gangs-detail-position",
                            JSON.stringify(position)
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
                        {selectedIconSrc && (
                            <img
                                className="gang-icon"
                                src={selectedIconSrc}
                                alt="gang icon"
                                draggable={false}
                            />
                        )}
                    </div>
                    <div className="gang-name-text">{gangName}</div>
                </div>
                <button className="close-button" onClick={onClose}>
                    ✖
                </button>
            </div>

            <div className="gangs-tabs">
                <button
                    onClick={() => setActiveTab("info")}
                    className={activeTab === "info" ? "active" : ""}
                >
                    Gang Information
                </button>
                <button
                    onClick={() => setActiveTab("manage")}
                    className={activeTab === "manage" ? "active" : ""}
                >
                    Manage Gang
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={activeTab === "settings" ? "active" : ""}
                >
                    Gang Settings
                </button>
            </div>

            <div className="gangs-content">
                {/* INFO */}
                {activeTab === "info" && (
                    <div className="info-tab">
                        <div className="info-section gang-header">
                            <div className="gang-banner">
                                <div className="gang-banner-left">
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

                            <div className="gang-colors-large">
                                <div
                                    className="primary-color"
                                    style={{ backgroundColor: primaryColor }}
                                />
                                <div
                                    className="secondary-color"
                                    style={{ backgroundColor: secondaryColor }}
                                />
                                {selectedIconSrc && (
                                    <img
                                        className="gang-icon-small"
                                        src={selectedIconSrc}
                                        alt="icon"
                                    />
                                )}
                            </div>

                            <div className="gang-details">
                                <h2 className="gang-name">{gangName}</h2>
                                <div className="xp-bar-container">
                                    <div
                                        className="xp-bar-fill"
                                        style={{
                                            width: `${
                                                (gangXP /
                                                    Math.max(1, gangXPMax)) *
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

                        <div className="info-section">
                            <h3>Perks</h3>
                            <div className="perk-grid">
                                <div className="perk-box" />
                                <div className="perk-box" />
                                <div className="perk-box" />
                                <div className="perk-box" />
                            </div>
                        </div>

                        <div className="info-section">
                            <h3>Gang Stats</h3>
                            <div className="gang-stat">
                                Total Members: <span>{membersNorm.length}</span>
                            </div>
                            <div className="gang-stat">
                                Total Kills: <span>{gangKills}</span>
                            </div>
                            <div className="gang-stat">
                                Turf Controlled: <span>{gangTurfCount}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* MANAGE */}
                {activeTab === "manage" && (
                    <div className="manage-tab">
                        <div className="gangs-subheader">
                            <div className="gangs-subheader-left">
                                <span className="gangs-subheader-title">
                                    {gangName || "Gang Name"}
                                </span>
                            </div>
                            <div className="gangs-subheader-right">
                                <input
                                    type="text"
                                    placeholder="Enter username to invite"
                                    value={inviteUsername}
                                    onChange={(e) =>
                                        setInviteUsername(e.target.value)
                                    }
                                    className="gangs-invite-input"
                                />
                                <button
                                    className="habbo-action-button green"
                                    onClick={sendGangInvite}
                                >
                                    Send Invite
                                </button>

                                {/* Owner sees Disband; others see Leave */}
                                {!isGangOwner && (
                                    <button
                                        className="habbo-action-button red"
                                        onClick={handleLeaveGangClick}
                                    >
                                        Leave Gang
                                    </button>
                                )}
                                {isGangOwner && (
                                    <button
                                        className="habbo-action-button red"
                                        onClick={() =>
                                            setShowConfirmDeleteModal(true)
                                        }
                                    >
                                        Disband Gang
                                    </button>
                                )}
                            </div>
                        </div>

                        {showConfirmDeleteModal && (
                            <div className="gangs-modal-overlay">
                                <div className="gangs-modal-popup scale-in">
                                    <div className="popup-header">
                                        <span>Confirm Disband</span>
                                        <button
                                            className="close-button"
                                            onClick={() =>
                                                setShowConfirmDeleteModal(false)
                                            }
                                        >
                                            ✖
                                        </button>
                                    </div>
                                    <div className="popup-body">
                                        <p>
                                            Are you sure you want to disband
                                            your gang? This cannot be undone.
                                        </p>
                                        <div className="popup-actions">
                                            <button
                                                className="habbo-action-button red"
                                                onClick={() => {
                                                    SendMessageComposer(
                                                        new DeleteGangMessageComposer()
                                                    );
                                                    setShowConfirmDeleteModal(
                                                        false
                                                    );
                                                    // Clean local state to avoid UI ghosts
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
                                                className="habbo-action-button"
                                                onClick={() =>
                                                    setShowConfirmDeleteModal(
                                                        false
                                                    )
                                                }
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {gangRanks
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((rank) => {
                                const members =
                                    groupedMembers[rank.position] || [];
                                return (
                                    <div
                                        key={rank.id}
                                        className="gang-rank-group"
                                        style={{ marginTop: 10 }}
                                    >
                                        <div
                                            className="rank-label"
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <div
                                                onClick={() =>
                                                    toggleCollapse(
                                                        rank.position
                                                    )
                                                }
                                                style={{
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <span
                                                    className={`rank-toggle-arrow ${
                                                        collapsedRanks.includes(
                                                            rank.position
                                                        )
                                                            ? "collapsed"
                                                            : "expanded"
                                                    }`}
                                                    style={{
                                                        transition:
                                                            "transform 0.2s ease",
                                                    }}
                                                >
                                                    ▼
                                                </span>

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontWeight: "bold",
                                                        }}
                                                    >
                                                        {rank.name}
                                                    </span>
                                                    <div
                                                        className="role-badges"
                                                        style={{
                                                            display: "flex",
                                                            gap: 4,
                                                        }}
                                                    >
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
                                                </div>
                                            </div>

                                            {ownerOrAdmin && (
                                                <div className="role-actions">
                                                    <button
                                                        className="habbo-action-button"
                                                        onClick={() => {
                                                            setEditRoleId(
                                                                rank.id
                                                            );
                                                            setRoleName(
                                                                rank.name
                                                            );
                                                            setRolePermissions({
                                                                bankAccess:
                                                                    !!rank.canAccessBank,
                                                                kickMembers:
                                                                    !!rank.canKick,
                                                                inviteMembers:
                                                                    !!rank.canInvite,
                                                                administrator:
                                                                    !!rank.administrator,
                                                            });
                                                            setShowEditRoleModal(
                                                                true
                                                            );
                                                        }}
                                                    >
                                                        Edit Role
                                                    </button>
                                                    <button
                                                        className="habbo-action-button red"
                                                        onClick={() =>
                                                            deleteRole(rank.id)
                                                        }
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!collapsedRanks.includes(
                                            rank.position
                                        ) && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: "12px",
                                                }}
                                            >
                                                {members.length > 0 ? (
                                                    members.map((member) => (
                                                        <div
                                                            key={member.userId}
                                                            className="gang-member-card"
                                                            style={{
                                                                width: "18%",
                                                                minWidth:
                                                                    "100px",
                                                                textAlign:
                                                                    "center",
                                                                display: "flex",
                                                                flexDirection:
                                                                    "column",
                                                                alignItems:
                                                                    "center",
                                                            }}
                                                        >
                                                            <img
                                                                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                                                                    member.figure
                                                                )}&headonly=1&direction=2&gesture=sml`}
                                                                alt={
                                                                    member.username
                                                                }
                                                                style={{
                                                                    width: 48,
                                                                    height: 48,
                                                                }}
                                                            />
                                                            <span
                                                                style={{
                                                                    fontSize: 12,
                                                                    color: "#fff",
                                                                }}
                                                            >
                                                                {
                                                                    member.username
                                                                }
                                                            </span>

                                                            {ownerOrAdmin &&
                                                                viewer?.userId !==
                                                                    member.userId && (
                                                                    <select
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
                                                                                        .value
                                                                                )
                                                                            )
                                                                        }
                                                                        style={{
                                                                            marginTop: 6,
                                                                        }}
                                                                    >
                                                                        {gangRanks.map(
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
                                                    ))
                                                ) : (
                                                    <span className="members-info">
                                                        No members in this role.
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                        {groupedMembers[-1] && (
                            <div
                                className="gang-rank-group"
                                style={{ marginTop: 20 }}
                            >
                                <div
                                    className="rank-label"
                                    onClick={() => toggleCollapse(-1)}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: "bold",
                                            fontStyle: "italic",
                                            color: "gray",
                                        }}
                                    >
                                        No Role
                                    </span>
                                </div>
                                {!collapsedRanks.includes(-1) && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "12px",
                                            marginTop: 10,
                                        }}
                                    >
                                        {groupedMembers[-1].length > 0 ? (
                                            groupedMembers[-1].map((member) => (
                                                <div
                                                    className="gang-member-card"
                                                    key={member.userId}
                                                    style={{
                                                        width: "18%",
                                                        minWidth: "100px",
                                                        textAlign: "center",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <img
                                                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(
                                                            member.figure
                                                        )}&headonly=1&direction=2&gesture=sml`}
                                                        alt={member.username}
                                                        style={{
                                                            width: 48,
                                                            height: 48,
                                                        }}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: "#fff",
                                                        }}
                                                    >
                                                        {member.username}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="members-info">
                                                No members without roles.
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {ownerOrAdmin && (
                            <div style={{ marginTop: 20 }}>
                                <button
                                    className="habbo-action-button green"
                                    onClick={() => setShowNewRoleModal(true)}
                                >
                                    + Add Role
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* NEW ROLE */}
                {showNewRoleModal && (
                    <div className="new-role-popup fade-in">
                        <div className="popup-header">
                            <span>New Role</span>
                            <button
                                className="close-button"
                                onClick={() => setShowNewRoleModal(false)}
                            >
                                ✖
                            </button>
                        </div>
                        <div className="popup-body">
                            <input
                                type="text"
                                placeholder="Enter role name"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="gangs-invite-input"
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
                                    className="habbo-action-button green"
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
                                    className="habbo-action-button red"
                                    onClick={() => setShowNewRoleModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* EDIT ROLE */}
                {showEditRoleModal && (
                    <div className="gangs-modal-overlay">
                        <div className="gangs-modal-popup scale-in">
                            <div className="popup-header">
                                <span>Edit Role</span>
                                <button
                                    className="close-button"
                                    onClick={() => setShowEditRoleModal(false)}
                                >
                                    ✖
                                </button>
                            </div>
                            <div className="popup-body">
                                <label>Role Name</label>
                                <input
                                    type="text"
                                    value={roleName}
                                    className="gangs-invite-input"
                                    onChange={(e) =>
                                        setRoleName(e.target.value)
                                    }
                                />
                                <div className="permission-checkboxes">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={rolePermissions.bankAccess}
                                            onChange={(e) =>
                                                setRolePermissions({
                                                    ...rolePermissions,
                                                    bankAccess:
                                                        e.target.checked,
                                                })
                                            }
                                        />{" "}
                                        Bank Access
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={
                                                rolePermissions.kickMembers
                                            }
                                            onChange={(e) =>
                                                setRolePermissions({
                                                    ...rolePermissions,
                                                    kickMembers:
                                                        e.target.checked,
                                                })
                                            }
                                        />{" "}
                                        Kick Members
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={
                                                rolePermissions.inviteMembers
                                            }
                                            onChange={(e) =>
                                                setRolePermissions({
                                                    ...rolePermissions,
                                                    inviteMembers:
                                                        e.target.checked,
                                                })
                                            }
                                        />{" "}
                                        Invite Members
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={
                                                rolePermissions.administrator
                                            }
                                            onChange={(e) =>
                                                setRolePermissions({
                                                    ...rolePermissions,
                                                    administrator:
                                                        e.target.checked,
                                                })
                                            }
                                        />{" "}
                                        Administrator
                                    </label>
                                </div>
                                <div className="popup-footer">
                                    <button
                                        className="habbo-action-button green"
                                        onClick={handleEditRoleSubmit}
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        className="habbo-action-button"
                                        onClick={() =>
                                            setShowEditRoleModal(false)
                                        }
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONFIRM ROLE DELETE */}
                {showConfirmRoleDeleteModal && (
                    <div className="gangs-modal-overlay">
                        <div className="gangs-modal-popup scale-in">
                            <div className="popup-header">
                                <span>Confirm Deletion</span>
                                <button
                                    className="close-button"
                                    onClick={() =>
                                        setShowConfirmRoleDeleteModal(false)
                                    }
                                >
                                    ✖
                                </button>
                            </div>
                            <div className="popup-body">
                                <p>
                                    Are you sure you want to delete this role?
                                </p>
                                <div className="popup-actions">
                                    <button
                                        className="habbo-action-button red"
                                        onClick={confirmDeleteRole}
                                    >
                                        Yes, Delete
                                    </button>
                                    <button
                                        className="habbo-action-button"
                                        onClick={() => {
                                            setShowConfirmRoleDeleteModal(
                                                false
                                            );
                                            setConfirmDeleteRoleId(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SETTINGS */}
                {activeTab === "settings" && (
                    <div className="settings-tab">
                        <div className="settings-row">
                            <div className="settings-col">
                                <h3>Primary Color</h3>
                                <SwatchGrid
                                    value={primaryColor}
                                    onChange={setPrimaryColor}
                                />
                            </div>
                            <div className="settings-col">
                                <h3>Secondary Color</h3>
                                <SwatchGrid
                                    value={secondaryColor}
                                    onChange={setSecondaryColor}
                                />
                            </div>
                        </div>

                        <div className="settings-row" style={{ marginTop: 12 }}>
                            <div className="settings-col full">
                                <h3>Select Icon</h3>
                                <div className="icon-selector">
                                    {visibleIcons.map((icon) => {
                                        const key = iconKeyFromSrc(icon.src);
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
                                                    isSelected ? "selected" : ""
                                                } ${isLocked ? "locked" : ""}`}
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
                                        className="habbo-action-button"
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
                                        className="habbo-action-button"
                                        onClick={() =>
                                            setIconsPage((p) =>
                                                Math.min(
                                                    p + 1,
                                                    totalIconPages - 1
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
                        </div>

                        {/* Preview */}
                        <div className="settings-row" style={{ marginTop: 12 }}>
                            <div className="settings-col full">
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
                            </div>
                        </div>

                        <div className="settings-actions">
                            <button
                                className="habbo-action-button green"
                                onClick={() => {
                                    SendMessageComposer(
                                        new EditGangComposer(
                                            stripHash(primaryColor),
                                            stripHash(secondaryColor),
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
                )}
            </div>
        </div>
    );
};

export default GangsDetailView;
