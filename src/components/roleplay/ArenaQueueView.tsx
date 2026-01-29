import React, {
    FC,
    useCallback,
    useEffect,
    useMemo,
    useState,
    MouseEvent as ReactMouseEvent,
} from "react";
import "./ArenaQueueView.scss";
import { SendMessageComposer } from "../../api";
import { ArenaJoinQueueComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ArenaJoinQueueComposer";
import { ArenaLeaveQueueComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ArenaLeaveQueueComposer";
import { ArenaRequestLeaderboardComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/ArenaRequestLeaderboardComposer";

// ✅ Assets
import trophy1 from "../../icons/1stplace.png";
import trophy2 from "../../icons/2ndplace.png";
import trophy3 from "../../icons/3rdplace.png";
import leaderboardPoster from "../../icons/leaderboard.png";

export interface ArenaFighter {
    userId: number;
    username: string;
    figure?: string;
    level?: number;
    wins?: number;
    losses?: number;
    rating?: number;
    health?: number;
    maxHealth?: number;
}

export interface ArenaLeaderboardEntry {
    userId: number;
    username: string;
    figure?: string;
    level?: number;
    rank?: number; // computed client-side
    wins: number;
    losses: number;
    rating: number;
}

type ArenaQueueStatus = "idle" | "queued" | "matched";

interface ArenaQueueViewProps {
    visible: boolean;
    onClose?: () => void;
    currentUser?: ArenaFighter;

    // optional prop fallback (we still support it, but live state wins)
    leaderboard?: ArenaLeaderboardEntry[];
}

export const ArenaQueueView: FC<ArenaQueueViewProps> = ({
    visible,
    onClose,
    currentUser,
    leaderboard = [],
}) => {
    const [status, setStatus] = useState<ArenaQueueStatus>("idle");
    const [self, setSelf] = useState<ArenaFighter | undefined>(currentUser);
    const [opponent, setOpponent] = useState<ArenaFighter | undefined>(
        undefined
    );
    const [activeTab, setActiveTab] = useState<"match" | "leaderboard">(
        "match"
    );

    // server-side match flag (separate from our personal queue state)
    const [serverIsMatched, setServerIsMatched] = useState<boolean>(false);

    // ✅ LEADERBOARD STATE (this is what renders)
    const [lbEntries, setLbEntries] = useState<ArenaLeaderboardEntry[]>(
        leaderboard ?? []
    );

    // ----- DRAG STATE -----
    const [position, setPosition] = useState<{ x: number; y: number } | null>(
        null
    );
    const [isDragging, setIsDragging] = useState(false);

    // Request LB packet from server
    const requestLeaderboard = useCallback(() => {
        SendMessageComposer(new ArenaRequestLeaderboardComposer());
    }, []);

    // Helper: build Habbo head-only avatar URL
    const getAvatarHeadUrl = (
        figure?: string,
        side: "left" | "right" = "left"
    ) => {
        if (!figure) return "";
        const direction = side === "left" ? 2 : 4; // face inward
        return `https://imager.olympusrp.pw/?figure=${figure}&headonly=1&direction=${direction}`;
    };

    // ✅ IMPORTANT: DO NOT unmount when hidden (prevents React hook crash / black screen)
    // We hide via CSS instead.
    useEffect(() => {
        if (!visible) return;

        setSelf((oldSelf) => oldSelf ?? currentUser);
        setActiveTab("match");

        if (!position) {
            try {
                const width = 750;
                const x = (window.innerWidth - width) / 2;
                const y = 60;
                setPosition({ x, y });
            } catch {
                // ignore
            }
        }
    }, [visible, currentUser, position]);

    // ----- ARENA STATUS BRIDGE -----
    useEffect(() => {
        const handleArenaStatus = (ev: Event) => {
            const custom = ev as CustomEvent<any>;
            const detail = custom.detail;
            if (!detail) return;

            const nextStatus: ArenaQueueStatus = detail.inQueue
                ? detail.isMatched
                    ? "matched"
                    : "queued"
                : "idle";

            setStatus(nextStatus);
            setServerIsMatched(!!detail.isMatched);

            if (detail.self) {
                setSelf({
                    userId: detail.self.userId,
                    username: detail.self.username,
                    figure: detail.self.figure,
                    level: detail.self.level,
                    wins: detail.self.wins,
                    losses: detail.self.losses,
                    rating: detail.self.rating ?? 0,
                    health: detail.self.health,
                    maxHealth: detail.self.maxHealth,
                });
            }

            if (detail.opponent) {
                setOpponent({
                    userId: detail.opponent.userId,
                    username: detail.opponent.username,
                    figure: detail.opponent.figure,
                    level: detail.opponent.level,
                    wins: detail.opponent.wins,
                    losses: detail.opponent.losses,
                    rating: detail.opponent.rating ?? 0,
                    health: detail.opponent.health,
                    maxHealth: detail.opponent.maxHealth,
                });
            } else {
                setOpponent(undefined);
            }
        };

        window.addEventListener("arena_status", handleArenaStatus);
        return () =>
            window.removeEventListener("arena_status", handleArenaStatus);
    }, []);

    // ✅ LEADERBOARD BRIDGE (server -> window event -> state)
    useEffect(() => {
        const handleLeaderboard = (ev: Event) => {
            const custom = ev as CustomEvent<any>;
            const detail = custom.detail;
            const entries = detail?.entries;

            if (!Array.isArray(entries)) return;

            const normalized: ArenaLeaderboardEntry[] = entries.map(
                (e: any) => ({
                    userId: Number(e.userId ?? e.id ?? 0),
                    username: String(e.username ?? ""),
                    figure: e.figure ?? "",
                    level: typeof e.level === "number" ? e.level : undefined,
                    wins: Number(e.wins ?? 0),
                    losses: Number(e.losses ?? 0),
                    rating: Number(e.rating ?? 0),
                })
            );

            setLbEntries(normalized);
        };

        window.addEventListener("arena_leaderboard", handleLeaderboard);
        return () =>
            window.removeEventListener("arena_leaderboard", handleLeaderboard);
    }, []);

    // ✅ Auto-request LB when leaderboard tab becomes active (ONLY ONCE per tab change)
    useEffect(() => {
        if (!visible) return;
        if (activeTab !== "leaderboard") return;
        requestLeaderboard();
    }, [visible, activeTab, requestLeaderboard]);

    const sendJoinQueue = useCallback(() => {
        SendMessageComposer(new ArenaJoinQueueComposer());
    }, []);

    const sendLeaveQueue = useCallback(() => {
        SendMessageComposer(new ArenaLeaveQueueComposer());
    }, []);

    const handleJoinClick = useCallback(() => {
        if (status === "idle") {
            setOpponent(undefined);
            setStatus("queued");
            sendJoinQueue();
        } else if (status === "queued" || status === "matched") {
            setStatus("idle");
            setOpponent(undefined);
            sendLeaveQueue();
        }
    }, [status, sendJoinQueue, sendLeaveQueue]);

    const handleForfeitClick = useCallback(() => {
        setStatus("idle");
        setOpponent(undefined);
        sendLeaveQueue();
        onClose && onClose();
    }, [onClose, sendLeaveQueue]);

    const handleCloseClick = useCallback(() => {
        if (status !== "idle") sendLeaveQueue();
        onClose && onClose();
    }, [status, sendLeaveQueue, onClose]);

    // ----- DRAG HANDLERS -----
    const handleHeaderMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest(".close-button")) return;

        e.preventDefault();

        const startPos = position ?? { x: 0, y: 60 };
        const startX = e.clientX;
        const startY = e.clientY;
        const offsetX = startX - startPos.x;
        const offsetY = startY - startPos.y;

        setIsDragging(true);

        const onMouseMove = (ev: MouseEvent) => {
            const newX = ev.clientX - offsetX;
            const newY = ev.clientY - offsetY;
            setPosition({ x: newX, y: newY });
        };

        const onMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    const isSearching = !serverIsMatched && !!self && !opponent;
    const isMatched = serverIsMatched && !!self && !!opponent;

    const renderHealthBar = (fighter?: ArenaFighter) => {
        if (!fighter || !fighter.maxHealth) {
            return (
                <div className="arena-healthbar">
                    <div className="arena-healthbar-fill arena-healthbar-fill--empty" />
                </div>
            );
        }

        const pct = Math.max(
            0,
            Math.min(
                100,
                ((fighter.health ?? fighter.maxHealth) / fighter.maxHealth) *
                    100
            )
        );

        return (
            <div className="arena-healthbar">
                <div
                    className="arena-healthbar-fill"
                    style={{ width: `${pct}%` }}
                />
            </div>
        );
    };

    const renderStatsRows = (fighter?: ArenaFighter) => {
        if (!fighter) {
            return (
                <div className="arena-stats-row arena-stats-row--empty">
                    Waiting for player...
                </div>
            );
        }

        return (
            <>
                <div className="arena-stats-row">
                    <span className="label">Level</span>
                    <span className="value">{fighter.level ?? "-"}</span>
                </div>

                <div className="arena-stats-row">
                    <span className="label">W / L</span>
                    <span className="value">
                        {fighter.wins ?? 0} / {fighter.losses ?? 0}
                    </span>
                </div>

                <div className="arena-stats-row">
                    <span className="label">Rating</span>
                    <span className="value">{fighter.rating ?? "-"}</span>
                </div>
            </>
        );
    };

    const renderMatchTab = () => (
        <div className="arena-matchmaking">
            <div className="arena-sides">
                {/* LEFT — YOU */}
                <div className="arena-side arena-side--blue">
                    <div className="arena-side-header">
                        <span className="side-label">YOU</span>
                    </div>

                    <div className="arena-avatar-wrapper">
                        {self?.figure ? (
                            <img
                                className="arena-avatar-image arena-avatar-image--blue"
                                src={getAvatarHeadUrl(self.figure, "left")}
                                alt={self.username}
                                draggable={false}
                            />
                        ) : (
                            <div className="arena-avatar-placeholder arena-avatar-placeholder--empty" />
                        )}
                    </div>

                    <div className="arena-username">
                        {self?.username ??
                            (status === "idle"
                                ? "Waiting to join..."
                                : "Unknown")}
                    </div>

                    {renderHealthBar(self)}
                    <div className="arena-stats">{renderStatsRows(self)}</div>
                </div>

                {/* RIGHT — OPPONENT */}
                <div className="arena-side arena-side--red">
                    <div className="arena-side-header">
                        <span className="side-label">OPPONENT</span>
                    </div>

                    <div className="arena-avatar-wrapper">
                        {isSearching && (
                            <div className="arena-spinner-wrapper">
                                <div className="arena-spinner" />
                                <span className="arena-spinner-text">
                                    Searching for opponent...
                                </span>
                            </div>
                        )}

                        {!isSearching && !isMatched && (
                            <div className="arena-avatar-placeholder arena-avatar-placeholder--empty" />
                        )}

                        {isMatched &&
                            opponent &&
                            (opponent.figure ? (
                                <img
                                    className="arena-avatar-image arena-avatar-image--red"
                                    src={getAvatarHeadUrl(
                                        opponent.figure,
                                        "right"
                                    )}
                                    alt={opponent.username}
                                    draggable={false}
                                />
                            ) : (
                                <div className="arena-avatar-placeholder" />
                            ))}
                    </div>

                    <div className="arena-username">
                        {opponent?.username ??
                            (isSearching ? "Searching..." : "Waiting")}
                    </div>

                    {renderHealthBar(opponent)}
                    <div className="arena-stats">
                        {renderStatsRows(opponent)}
                    </div>
                </div>
            </div>

            <div className="arena-footer">
                <div className="arena-footer-left">
                    <span className="arena-status-text">
                        {status === "idle" &&
                            "Click JOIN QUEUE to find a fight in the Bubble Juice arena."}
                        {status === "queued" &&
                            !serverIsMatched &&
                            "You are in queue. Waiting for another fighter..."}
                        {status === "matched" &&
                            serverIsMatched &&
                            "Match found! Get ready to fight."}
                    </span>
                </div>

                <div className="arena-footer-right">
                    {status !== "matched" && (
                        <button
                            className={`arena-button ${
                                status === "idle"
                                    ? "arena-button--primary"
                                    : "arena-button--danger"
                            }`}
                            onClick={handleJoinClick}
                        >
                            {status === "idle" ? "JOIN QUEUE" : "LEAVE QUEUE"}
                        </button>
                    )}

                    {status === "matched" && (
                        <button
                            className="arena-button arena-button--danger"
                            onClick={handleForfeitClick}
                        >
                            FORFEIT
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // ✅ sorted top 10: wins desc, losses asc, rating desc, then username
    const sortedLeaderboard = useMemo(() => {
        return [...(lbEntries ?? [])]
            .sort((a, b) => {
                const w = (b.wins ?? 0) - (a.wins ?? 0);
                if (w !== 0) return w;

                const l = (a.losses ?? 0) - (b.losses ?? 0);
                if (l !== 0) return l;

                const r = (b.rating ?? 0) - (a.rating ?? 0);
                if (r !== 0) return r;

                return (a.username ?? "").localeCompare(b.username ?? "");
            })
            .slice(0, 10)
            .map((e, i) => ({ ...e, rank: i + 1 }));
    }, [lbEntries]);

    const getTrophyForRank = (rank: number) => {
        if (rank === 1) return trophy1;
        if (rank === 2) return trophy2;
        if (rank === 3) return trophy3;
        return null;
    };

    const renderLeaderboardTab = () => (
        <div className="arena-leaderboard-layout">
            <div className="arena-leaderboard-art">
                <img
                    className="arena-leaderboard-art-img"
                    src={leaderboardPoster}
                    alt="Leaderboard"
                    draggable={false}
                />
            </div>

            <div className="arena-leaderboard-panel">
                {sortedLeaderboard.length === 0 && (
                    <div className="arena-leaderboard-empty">
                        No arena matches yet. Be the first to enter the ring!
                    </div>
                )}

                {sortedLeaderboard.length > 0 && (
                    <div className="arena-leaderboard-table">
                        <div className="arena-leaderboard-header-row">
                            <span className="col rank">#</span>
                            <span className="col fighter">Fighter</span>
                            <span className="col wl">W / L</span>
                            <span className="col rating">Rating</span>
                        </div>

                        {sortedLeaderboard.map((entry) => {
                            const trophy = getTrophyForRank(entry.rank!);

                            return (
                                <div
                                    className="arena-leaderboard-row"
                                    key={entry.userId}
                                >
                                    <span className="col rank">
                                        {entry.rank}
                                    </span>

                                    <span className="col fighter">
                                        <span className="arena-lb-fighter">
                                            <span className="arena-lb-avatar-wrap">
                                                {trophy && (
                                                    <img
                                                        className="arena-lb-trophy"
                                                        src={trophy}
                                                        alt={`${entry.rank} place`}
                                                        draggable={false}
                                                    />
                                                )}

                                                {entry.figure ? (
                                                    <img
                                                        className="arena-lb-avatar"
                                                        src={getAvatarHeadUrl(
                                                            entry.figure,
                                                            "left"
                                                        )}
                                                        alt={entry.username}
                                                        draggable={false}
                                                    />
                                                ) : (
                                                    <span className="arena-lb-avatar arena-lb-avatar--empty" />
                                                )}
                                            </span>

                                            <span className="arena-lb-name">
                                                {entry.username}
                                                {typeof entry.level ===
                                                    "number" && (
                                                    <span className="arena-lb-level">
                                                        Lv {entry.level}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </span>

                                    <span className="col wl">
                                        {entry.wins} / {entry.losses}
                                    </span>

                                    <span className="col rating">
                                        {entry.rating}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    const containerStyle =
        position != null
            ? { left: position.x, top: position.y, transform: "none" as const }
            : undefined;

    return (
        <div
            className={`arena-container${!visible ? " hidden" : ""}`}
            style={containerStyle}
        >
            <div
                className={`arena-header${isDragging ? " is-grabbing" : ""}`}
                onMouseDown={handleHeaderMouseDown}
            >
                <span className="title">BUBBLE JUICE ARENA</span>
                <button
                    className="close-button"
                    type="button"
                    onClick={handleCloseClick}
                />
            </div>

            <div className="arena-tabs">
                <button
                    className={`tab-btn ${
                        activeTab === "match" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("match")}
                >
                    Matchmaking
                </button>

                {/* ✅ Only switch tabs here. The useEffect will request leaderboard once. */}
                <button
                    className={`tab-btn ${
                        activeTab === "leaderboard" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("leaderboard")}
                >
                    Leaderboards
                </button>
            </div>

            <div className="arena-body">
                {/* LEFT COLUMN */}
                <div className="arena-left">
                    <div className="arena-avatar-section">
                        <div className="arena-avatar-frame">
                            {self?.figure ? (
                                <img
                                    className="arena-profile-avatar"
                                    src={getAvatarHeadUrl(self.figure, "left")}
                                    alt={self.username}
                                    draggable={false}
                                />
                            ) : (
                                <div className="arena-profile-avatar" />
                            )}

                            <div className="arena-avatar-meta">
                                <div className="arena-username-main">
                                    {self?.username ?? "You"}
                                </div>

                                <div className="arena-meta-row">
                                    <span className="label">Level</span>
                                    <span className="value">
                                        {self?.level ?? "-"}
                                    </span>
                                </div>

                                <div className="arena-meta-row">
                                    <span className="label">W / L</span>
                                    <span className="value">
                                        {self?.wins ?? 0} / {self?.losses ?? 0}
                                    </span>
                                </div>

                                <div className="arena-meta-row">
                                    <span className="label">Rating</span>
                                    <span className="value">
                                        {self?.rating ?? "-"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="arena-left-info">
                            <div className="arena-info-card">
                                <h5>Your Arena Status</h5>
                                <p className="arena-info-line">
                                    <strong>
                                        {status === "idle" && "Not in queue"}
                                        {status === "queued" && "Searching…"}
                                        {status === "matched" && "Match Ready!"}
                                    </strong>
                                </p>
                                <p className="arena-info-note">
                                    Arena deaths do NOT send you to the
                                    hospital.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="arena-right">
                    <div className="arena-tab-content">
                        {activeTab === "match"
                            ? renderMatchTab()
                            : renderLeaderboardTab()}
                    </div>
                </div>
            </div>
        </div>
    );
};
