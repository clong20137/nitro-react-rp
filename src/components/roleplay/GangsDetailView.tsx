import { FC, useEffect, useState, useRef } from "react";
import { SendMessageComposer } from "../../api";
import { GangInviteComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GangInviteComposer";
import "./GangsDetailView.scss";
import { CreateGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CreateGangRoleComposer";
import { DeleteGangMessageComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangMessageComposer";
import { DeleteGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DeleteGangRoleComposer";
import { EditGangRoleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EditGangRoleComposer";
import { LeaveGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/LeaveGangComposer";
import { ChangeGangRankComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeGangRankComposer";
import { Nitro } from "@nitrots/nitro-renderer";

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
interface Props {
    onConfirm: () => void;
    onCancel: () => void;
}

export const GangsDetailView: FC<GangsDetailViewProps> = ({ onClose }) => {
    const [gangName, setGangName] = useState("");
    const [gangRank, setGangRank] = useState(0);
    const [primaryColor, setPrimaryColor] = useState("#000000");
    const [secondaryColor, setSecondaryColor] = useState("#000000");
    const [activeTab, setActiveTab] = useState("info");
    const [inviteUsername, setInviteUsername] = useState("");
    const [gangMembers, setGangMembers] = useState<GangMember[]>([]);
    const [gangRanks, setGangRanks] = useState<GangRank[]>([]);
    const [collapsedRanks, setCollapsedRanks] = useState<number[]>([]);
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 100,
        y: 100,
    });
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [editRoleId, setEditRoleId] = useState<number | null>(null);
    const [roleName, setRoleName] = useState(""); // reuse if already defined

    const [positionReady, setPositionReady] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [showNewRoleModal, setShowNewRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [visible, setVisible] = useState(true);
    const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const currentUsername = Nitro.instance.sessionDataManager.userName;
    const viewer = gangMembers.find((m) => m.username === currentUsername);
    const viewerRank = gangRanks.find((r) => r.position === viewer?.rankOrder);

    const [isGangAdmin, setIsGangAdmin] = useState(false);
    const [gangMaxXP, setGangMaxXP] = useState(100);
    const [gangKills, setGangKills] = useState(0);
    const [gangDeaths, setGangDeaths] = useState(0);
    const [gangRobberies, setGangRobberies] = useState(0);
    const [gangPickpockets, setGangPickpockets] = useState(0);
    const [gangDamage, setGangDamage] = useState(0);
    const [gangTurfCount, setGangTurfCount] = useState(0);

    const [showConfirmRoleDeleteModal, setShowConfirmRoleDeleteModal] =
        useState(false);
    const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<
        number | null
    >(null);
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
            bankAccess: rank.bankAccess,
            kickMembers: rank.kickMembers,
            inviteMembers: rank.inviteMembers,
            administrator: rank.administrator,
        });
        setShowEditRoleModal(true);
    };

    const [rolePermissions, setRolePermissions] = useState({
        bankAccess: false,
        kickMembers: false,
        inviteMembers: false,
        administrator: false,
    });
    const [gangXP, setGangXP] = useState(15750);
    const [gangXPMax, setGangXPMax] = useState(16500);
    const [gangStats, setGangStats] = useState({
        totalMembers: 8,
        totalKills: 87,
        turfOwned: 3,
    });

    const [topKillers, setTopKillers] = useState([
        {
            userId: 1,
            username: "Caleb2",
            figure: "hr-3015-61.hd-190-1.ch-215-62.lg-285-62",
            kills: 44,
        },
        {
            userId: 2,
            username: "Gaz",
            figure: "hr-8025-45.hd-190-2.ch-215-62.lg-285-61",
            kills: 26,
        },
    ]);

    useEffect(() => {
        const handleStatus = (event: any) => {
            const data = event.detail;
            if (!data) return;

            console.log("📥 Received gang_status_result:", data);

            setGangName(data.gangName ?? "");
            setGangRank(data.gangRank ?? 0);

            // Colors
            const primary = data.primaryColor?.startsWith("#")
                ? data.primaryColor
                : `#${data.primaryColor}`;
            const secondary = data.secondaryColor?.startsWith("#")
                ? data.secondaryColor
                : `#${data.secondaryColor}`;
            setPrimaryColor(primary || "#000000");
            setSecondaryColor(secondary || "#000000");

            // Gang Stats
            setGangXP(data.xp ?? 0);
            setGangMaxXP(data.maxXp ?? 100); // Default to 100 if undefined
            setGangKills(data.kills ?? 0);
            setGangDeaths(data.deaths ?? 0);
            setGangRobberies(data.robberies ?? 0);
            setGangPickpockets(data.pickpockets ?? 0);
            setGangDamage(data.totalDamage ?? 0);
            setGangTurfCount(data.turfCount ?? 0);
            setIsGangAdmin(data.isGangAdmin);
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

        return () => {
            window.removeEventListener("gang_status_result", handleStatus);
            window.removeEventListener("gang_members_result", handleMembers);
            window.removeEventListener("gang_ranks_received", handleRanks);
        };
    }, []);

    useEffect(() => {
        if (showEditRoleModal && editRoleId !== null) {
            const rank = gangRanks.find((r) => r.id === editRoleId);
            if (rank) {
                setRolePermissions({
                    bankAccess: rank.canAccessBank,
                    kickMembers: rank.canKick,
                    inviteMembers: rank.canInvite,
                    administrator: rank.administrator,
                });
            }
        }
    }, [showEditRoleModal]);

    const handleDeleteGang = () => {
        setShowConfirmDeleteModal(true);
    };
    const deleteRole = (rankId: number) => {
        setConfirmDeleteRoleId(rankId);
        setShowConfirmRoleDeleteModal(true);
    };
    const handleLeaveGangClick = () => {
        SendMessageComposer(new LeaveGangComposer());
    };
    const confirmDeleteRole = () => {
        if (confirmDeleteRoleId !== null) {
            SendMessageComposer(
                new DeleteGangRoleComposer(confirmDeleteRoleId)
            );
        }
        setShowConfirmRoleDeleteModal(false);
        setConfirmDeleteRoleId(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
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

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onClose(), 250);
    };

    const sendGangInvite = () => {
        if (!inviteUsername.trim()) return;
        SendMessageComposer(new GangInviteComposer(inviteUsername.trim()));
        setInviteUsername("");
    };

    const groupedMembers = gangMembers.reduce((acc, member) => {
        // Fallback to -1 if rankOrder is null/undefined/invalid
        const groupKey =
            typeof member.rankOrder === "number" ? member.rankOrder : -1;

        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(member);
        return acc;
    }, {} as Record<number, GangMember[]>);
    const sortedRanks = Object.keys(groupedMembers)
        .map(Number)
        .sort((a, b) => a - b);

    const toggleCollapse = (rankOrder: number) => {
        setCollapsedRanks((prev) =>
            prev.includes(rankOrder)
                ? prev.filter((r) => r !== rankOrder)
                : [...prev, rankOrder]
        );
    };

    if (!positionReady) return null;
    return (
        <div
            className={`gangs-detail-view ${visible ? "fade-in" : "fade-out"}`}
            style={{ left: position.x, top: position.y, position: "absolute" }}
        >
            <div className="gangs-header" onMouseDown={handleMouseDown}>
                <div className="gang-name-header">
                    <div className="gang-color-split-box">
                        <div
                            className="color-half left"
                            style={{ backgroundColor: primaryColor }}
                        ></div>
                        <div
                            className="color-half right"
                            style={{ backgroundColor: secondaryColor }}
                        ></div>
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
                {activeTab === "info" && (
                    <div className="info-tab">
                        {/* Gang Name + Colors + XP Bar */}
                        <div className="info-section gang-header">
                            <div className="gang-colors-large">
                                <div
                                    className="primary-color"
                                    style={{
                                        backgroundColor: primaryColor,
                                    }}
                                />
                                <div
                                    className="secondary-color"
                                    style={{
                                        backgroundColor: secondaryColor,
                                    }}
                                />
                            </div>
                            <div className="gang-details">
                                <h2 className="gang-name">{gangName}</h2>
                                <div className="xp-bar-container">
                                    <div
                                        className="xp-bar-fill"
                                        style={{
                                            width: `${
                                                (gangXP / gangXPMax) * 100
                                            }%`,
                                        }}
                                    />
                                </div>
                                <div className="xp-text">
                                    XP: {gangXP} / {gangXPMax}
                                </div>
                            </div>
                        </div>

                        {/* Perk Boxes */}
                        <div className="info-section">
                            <h3>Perks</h3>
                            <div className="perk-grid">
                                <div className="perk-box" />
                                <div className="perk-box" />
                                <div className="perk-box" />
                                <div className="perk-box" />
                            </div>
                        </div>

                        {/* Gang Stats */}
                        <div className="info-section">
                            <h3>Gang Stats</h3>
                            <div className="gang-stat">
                                Total Members: <span>0</span>
                            </div>
                            <div className="gang-stat">
                                Total Kills: <span>0</span>
                            </div>
                            <div className="gang-stat">
                                Turf Controlled: <span>0</span>
                            </div>
                        </div>

                        {/* Top Members */}
                        <div className="info-section">
                            <h3>Top Gang Members</h3>
                            <div className="top-members"></div>
                        </div>
                    </div>
                )}
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
                                {!isGangAdmin && (
                                    <button
                                        className="habbo-action-button red"
                                        onClick={handleLeaveGangClick}
                                    >
                                        Leave Gang
                                    </button>
                                )}

                                {isGangAdmin && (
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

                                        {showEditRoleModal && (
                                            <div className="gangs-modal-overlay">
                                                <div className="gangs-modal-popup scale-in">
                                                    <div className="popup-header">
                                                        <span>Edit Role</span>
                                                        <button
                                                            className="close-button"
                                                            onClick={() =>
                                                                setShowEditRoleModal(
                                                                    false
                                                                )
                                                            }
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
                                                                setRoleName(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                        />

                                                        <div className="permission-checkboxes">
                                                            <label>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        rolePermissions.bankAccess
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setRolePermissions(
                                                                            {
                                                                                ...rolePermissions,
                                                                                bankAccess:
                                                                                    e
                                                                                        .target
                                                                                        .checked,
                                                                            }
                                                                        )
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
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setRolePermissions(
                                                                            {
                                                                                ...rolePermissions,
                                                                                kickMembers:
                                                                                    e
                                                                                        .target
                                                                                        .checked,
                                                                            }
                                                                        )
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
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setRolePermissions(
                                                                            {
                                                                                ...rolePermissions,
                                                                                inviteMembers:
                                                                                    e
                                                                                        .target
                                                                                        .checked,
                                                                            }
                                                                        )
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
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setRolePermissions(
                                                                            {
                                                                                ...rolePermissions,
                                                                                administrator:
                                                                                    e
                                                                                        .target
                                                                                        .checked,
                                                                            }
                                                                        )
                                                                    }
                                                                />
                                                                Administrator
                                                            </label>
                                                        </div>

                                                        <div className="popup-footer">
                                                            <button
                                                                className="habbo-action-button green"
                                                                onClick={
                                                                    handleEditRoleSubmit
                                                                } // implement this function
                                                            >
                                                                Save Changes
                                                            </button>
                                                            <button
                                                                className="habbo-action-button"
                                                                onClick={() =>
                                                                    setShowEditRoleModal(
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

                                        {showConfirmRoleDeleteModal && (
                                            <div className="gangs-modal-overlay">
                                                <div className="gangs-modal-popup scale-in">
                                                    <div className="popup-header">
                                                        <span>
                                                            Confirm Deletion
                                                        </span>
                                                        <button
                                                            className="close-button"
                                                            onClick={() =>
                                                                setShowConfirmDeleteModal(
                                                                    false
                                                                )
                                                            }
                                                        >
                                                            ✖
                                                        </button>
                                                    </div>
                                                    <div className="popup-body">
                                                        <p>
                                                            Are you sure you
                                                            want to delete this
                                                            role?
                                                        </p>
                                                        <div className="popup-actions">
                                                            <button
                                                                className="habbo-action-button red"
                                                                onClick={() => {
                                                                    if (
                                                                        confirmDeleteRoleId !==
                                                                        null
                                                                    ) {
                                                                        SendMessageComposer(
                                                                            new DeleteGangRoleComposer(
                                                                                confirmDeleteRoleId
                                                                            )
                                                                        );
                                                                    }
                                                                    setShowConfirmRoleDeleteModal(
                                                                        false
                                                                    );
                                                                    setConfirmDeleteRoleId(
                                                                        null
                                                                    );
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
                                                                    setConfirmDeleteRoleId(
                                                                        null
                                                                    );
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

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

                                                            {/* 🔽 Rank Change Dropdown */}
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
                                                                                rank
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        rank.position
                                                                                    }
                                                                                    value={
                                                                                        rank.position
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        rank.name
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
                                {/* Collapsible header */}
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

                                {/* Collapsible content */}
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

                        <div style={{ marginTop: 20 }}>
                            <button
                                className="habbo-action-button green"
                                onClick={() => setShowNewRoleModal(true)}
                            >
                                + Add Role
                            </button>
                        </div>
                    </div>
                )}
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
                {activeTab === "settings" && (
                    <div className="settings-tab">
                        <p>Settings coming soon...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GangsDetailView;
