import { FC, useEffect, useState, useRef } from "react";
import "./GangsDetailView.scss";
import { Nitro } from "@nitrots/nitro-renderer";
import { SendMessageComposer } from "../../api";

import { GangInviteComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GangInviteComposer";
import { CreateGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CreateGangRoleComposer";
import { DeleteGangMessageComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangMessageComposer";
import { DeleteGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangRoleComposer";
import { EditGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangRoleComposer";
import { LeaveGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/LeaveGangComposer";
import { ChangeGangRankComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeGangRankComposer";

// NEW: for editing appearance
import { EditGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangComposer";
// Alias (your file name uses HExes)
import { GetPartPaletteHexesComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetPartPaletteHExesComposer";
interface GangsDetailViewProps {
    onClose: () => void;
}

interface GangMember {
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

// EXACT icon options you shared

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

export const GangsDetailView: FC<GangsDetailViewProps> = ({ onClose }) => {
    // Basic gang state
    const [gangName, setGangName] = useState("");
    const [gangRank, setGangRank] = useState(0);

    // Colors & icon key (key like "ALW09")
    const [primaryColor, setPrimaryColor] = useState("#000000");
    const [secondaryColor, setSecondaryColor] = useState("#000000");
    const [gangIcon, setGangIcon] = useState<string>(""); // store the key, e.g., "ALW09"

    // Tabs
    const [activeTab, setActiveTab] = useState<"info" | "manage" | "settings">(
        "info"
    );

    // Members / ranks
    const [inviteUsername, setInviteUsername] = useState("");
    const [gangMembers, setGangMembers] = useState<GangMember[]>([]);
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
    const viewer = gangMembers.find((m) => m.username === currentUsername);
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

    // ===== Palette & Icons (new) =====
    const [ccSwatches, setCcSwatches] = useState<string[]>([]);
    const ICONS_PER_PAGE = 16;
    const [iconsPage, setIconsPage] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const dragStart = useRef({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const totalIconPages = Math.ceil(ICON_OPTIONS.length / ICONS_PER_PAGE);
    const visibleIcons = ICON_OPTIONS.slice(
        iconsPage * ICONS_PER_PAGE,
        (iconsPage + 1) * ICONS_PER_PAGE
    );
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
    const iconKeyFromSrc = (src: string): string => {
        const m = src.match(/\/([^\/]+)\.(gif|png)$/i);
        return m ? m[1] : "";
    };

    const selectedIconSrc =
        ICON_OPTIONS.find(
            (i) =>
                iconKeyFromSrc(i.src).toUpperCase() ===
                (gangIcon || "").toUpperCase()
        )?.src ?? (gangIcon ? `/icons/badges/${gangIcon}.gif` : "");

    const stripHash = (hex: string) => hex.replace(/^#/, "");

    // ===== Listeners / bootstrap =====
    useEffect(() => {
        const handleStatus = (event: any) => {
            const data = event.detail;
            if (!data) return;

            setGangName(data.gangName ?? "");
            setGangRank(data.gangRank ?? 0);

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
            // Icon: prefer iconKey; fall back to extracting from a URL if given
            let key: string | undefined = (data.iconKey ?? data.icon ?? "")
                .toString()
                .trim();
            if (!key && typeof data.iconUrl === "string") {
                const m = data.iconUrl.match(/\/([A-Z0-9]+)\.(gif|png)$/i);
                if (m) key = m[1];
            }
            if (key) setGangIcon(key.toUpperCase());

            // Stats
            setGangXP(data.xp ?? 0);
            setGangXPMax(data.maxXp ?? 100);
            setGangKills(data.kills ?? 0);
            setGangDeaths(data.deaths ?? 0);
            setGangRobberies(data.robberies ?? 0);
            setGangPickpockets(data.pickpockets ?? 0);
            setGangDamage(data.totalDamage ?? 0);
            setGangTurfCount(data.turfsControlled ?? data.turfCount ?? 0);

            // Permissions
            setIsGangAdmin(!!data.isAdmin || !!data.isGangAdmin);
            setIsGangOwner(!!data.isGangOwner);
        };

        const handleMembers = (event: any) => {
            if (!event.detail || !Array.isArray(event.detail.members)) return;
            setGangMembers(event.detail.members);
        };

        const handleRanks = (event: any) => {
            if (!event.detail || !Array.isArray(event.detail.ranks)) return;
            setGangRanks(event.detail.ranks);
        };

        window.addEventListener("gang_status_result", handleStatus);
        window.addEventListener("gang_members_result", handleMembers);
        window.addEventListener("gang_ranks_received", handleRanks);

        const savedPos = localStorage.getItem("gangs-detail-position");
        if (savedPos) setPosition(JSON.parse(savedPos));
        setPositionReady(true);

        // Request the allowed palette (part "cc") once
        SendMessageComposer(new GetPartPaletteHexesComposer("cc"));
        const onHexes = (ev: Event) => {
            const { part, hexes } = (ev as CustomEvent).detail as {
                part: string;
                paletteId: number;
                hexes: string[];
            };
            if (part !== "cc") return;

            const withHash = hexes.map((h) => `#${h.toUpperCase()}`);
            setCcSwatches(withHash);

            if (withHash.length) {
                if (!withHash.includes(primaryColor))
                    setPrimaryColor(withHash[0]);
                if (!withHash.includes(secondaryColor))
                    setSecondaryColor(withHash[0]);
            }
        };
        window.addEventListener("palette_hexes_result", onHexes);

        return () => {
            window.removeEventListener("gang_status_result", handleStatus);
            window.removeEventListener("gang_members_result", handleMembers);
            window.removeEventListener("gang_ranks_received", handleRanks);
            window.removeEventListener("palette_hexes_result", onHexes);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== Dragging =====
    // start drag from header
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // left button only
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        document.body.classList.add("is-dragging");
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            const newPos = {
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y,
            };
            setPosition(newPos);
            localStorage.setItem(
                "gangs-detail-position",
                JSON.stringify(newPos)
            );
        }
    };
    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    // ===== Role editing helpers =====
    useEffect(() => {
        if (showEditRoleModal && editRoleId !== null) {
            const rank = gangRanks.find((r) => r.id === editRoleId);
            if (rank) {
                setRolePermissions({
                    bankAccess: !!rank.canAccessBank,
                    kickMembers: !!rank.canKick,
                    inviteMembers: !!rank.canInvite,
                    administrator: !!rank.administrator,
                });
            }
        }
    }, [showEditRoleModal, editRoleId, gangRanks]);

    const clamp = (v: number, min: number, max: number) =>
        Math.min(Math.max(v, min), max);

    const getClampedPos = (x: number, y: number, node?: HTMLElement | null) => {
        const w = node?.offsetWidth ?? 650; // your panel width fallback
        const h = node?.offsetHeight ?? 420; // fallback
        const maxX = window.innerWidth - w - 8;
        const maxY = window.innerHeight - h - 8;
        return {
            x: clamp(x, 8, Math.max(8, maxX)),
            y: clamp(y, 8, Math.max(8, maxY)),
        };
    };

    const [positionReady, setPositionReady] = useState(false);

    // sanitize saved pos on mount
    useEffect(() => {
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
            } catch {
                // ignore bad JSON
            }
        } else {
            // center once if no saved pos
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
    }, []);

    // single global move/up handler
    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: MouseEvent) => {
            const next = getClampedPos(
                e.clientX - dragStart.current.x,
                e.clientY - dragStart.current.y,
                rootRef.current
            );
            setPosition(next);
        };

        const onUp = () => {
            setIsDragging(false);
            document.body.classList.remove("is-dragging");
            // persist clamped position
            localStorage.setItem(
                "gangs-detail-position",
                JSON.stringify(position)
            );
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isDragging, position]);

    // keep within bounds on resize too
    useEffect(() => {
        const onResize = () => {
            setPosition((p) => getClampedPos(p.x, p.y, rootRef.current));
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

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
    };

    const handleRankChange = (userId: number, newRankPosition: number) => {
        SendMessageComposer(
            new ChangeGangRankComposer(userId, newRankPosition)
        );
    };

    const openEditModalForRank = (rank: any) => {
        setEditRoleId(rank.id);
        setRoleName(rank.name);
        setRolePermissions({
            bankAccess: !!rank.canAccessBank,
            kickMembers: !!rank.canKick,
            inviteMembers: !!rank.canInvite,
            administrator: !!rank.administrator,
        });
        setShowEditRoleModal(true);
    };

    // ===== Actions =====
    const handleDeleteGang = () => setShowConfirmDeleteModal(true);
    const deleteRole = (rankId: number) => {
        setConfirmDeleteRoleId(rankId);
        setShowConfirmRoleDeleteModal(true);
    };
    const handleLeaveGangClick = () =>
        SendMessageComposer(new LeaveGangComposer());
    const confirmDeleteRole = () => {
        if (confirmDeleteRoleId !== null) {
            SendMessageComposer(
                new DeleteGangRoleComposer(confirmDeleteRoleId)
            );
        }
        setShowConfirmRoleDeleteModal(false);
        setConfirmDeleteRoleId(null);
    };
    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onClose(), 250);
    };
    const sendGangInvite = () => {
        if (!inviteUsername.trim()) return;
        SendMessageComposer(new GangInviteComposer(inviteUsername.trim()));
        setInviteUsername("");
    };

    // ===== Group members by rank position =====
    const groupedMembers = gangMembers.reduce((acc, member) => {
        const groupKey =
            typeof member.rankOrder === "number" ? member.rankOrder : -1;
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(member);
        return acc;
    }, {} as Record<number, GangMember[]>);

    const toggleCollapse = (rankOrder: number) => {
        setCollapsedRanks((prev) =>
            prev.includes(rankOrder)
                ? prev.filter((r) => r !== rankOrder)
                : [...prev, rankOrder]
        );
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const newPos = {
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y,
            };
            setPosition(newPos);
            localStorage.setItem(
                "gangs-detail-position",
                JSON.stringify(newPos)
            );
        };
        const onUp = () => setIsDragging(false);
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
    }, [isDragging, position.x, position.y]);

    if (!positionReady) return null;

    // ===== Swatch grid component =====
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

    return (
        <div
            className={`gangs-detail-view ${visible ? "fade-in" : "fade-out"}`}
            style={{ position: "absolute", left: position.x, top: position.y }}
        >
            <div className="gangs-header" onMouseDown={handleMouseDown}>
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
                {/* ===== INFO TAB ===== */}
                {activeTab === "info" && (
                    <div className="info-tab">
                        <div className="info-section gang-header">
                            <div className="gang-banner">
                                <div className="gang-banner-left">
                                    <img
                                        src={
                                            gangIcon
                                                ? gangIcon
                                                : "/icons/badges/default.gif"
                                        }
                                        alt="Gang Logo"
                                        className="gang-banner-icon"
                                    />
                                    <div className="gang-banner-text">
                                        <div className="gang-banner-name">
                                            {gangName || "Gang Name"}
                                        </div>
                                        <div className="gang-banner-rank">
                                            Rank: {gangRank || "Placeholder"}
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
                                Total Members: <span>{gangMembers.length}</span>
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

                {/* ===== MANAGE TAB ===== */}
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

                                {/* owner => Delete; non-owner => Leave */}
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
                                        onClick={handleDeleteGang}
                                    >
                                        Delete Gang
                                    </button>
                                )}
                            </div>
                        </div>

                        {showConfirmDeleteModal && (
                            <div className="gangs-modal-overlay">
                                <div className="gangs-modal-popup scale-in">
                                    <div className="popup-header">
                                        <span>Confirm Deletion</span>
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
                                            Are you sure you want to delete your
                                            gang? This cannot be undone.
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
                                                    handleClose();
                                                }}
                                            >
                                                Yes, Delete
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
                                            <div>
                                                {isGangAdmin && (
                                                    <div className="role-actions">
                                                        <button
                                                            className="habbo-action-button"
                                                            onClick={() =>
                                                                openEditModalForRank(
                                                                    rank
                                                                )
                                                            }
                                                        >
                                                            Edit Role
                                                        </button>
                                                        <button
                                                            className="habbo-action-button red"
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
                                            </div>
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
                                                                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${member.figure}&headonly=1&direction=2&gesture=sml`}
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

                                                            {isGangAdmin &&
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
                                                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${member.figure}&headonly=1&direction=2&gesture=sml`}
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

                        {isGangAdmin && (
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

                {/* ===== NEW ROLE POPUP ===== */}
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
                                        SendMessageComposer(
                                            new CreateGangRoleComposer(
                                                newRoleName.trim(),
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

                {/* ===== EDIT ROLE POPUP ===== */}
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
                                        />
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
                                        />
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
                                        />
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
                                        />
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

                {/* ===== CONFIRM ROLE DELETE ===== */}
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
                                        onClick={() => {
                                            if (confirmDeleteRoleId !== null) {
                                                SendMessageComposer(
                                                    new DeleteGangRoleComposer(
                                                        confirmDeleteRoleId
                                                    )
                                                );
                                            }
                                            setShowConfirmRoleDeleteModal(
                                                false
                                            );
                                            setConfirmDeleteRoleId(null);
                                        }}
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

                {/* ===== SETTINGS TAB (PALETTE + ICONS) ===== */}
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
                                                // small toast-style notify via Nitro alert or your own:
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
                                            gangIcon || "" // key like "ALW09"
                                        )
                                    );
                                    // ✅ close after save
                                    onClose(); // or: setVisible(false); setTimeout(onClose, 250);
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
