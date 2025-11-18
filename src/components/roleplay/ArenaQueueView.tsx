import React, {
    FC,
    useCallback,
    useEffect,
    useState,
    MouseEvent as ReactMouseEvent,
} from "react";
import "./ArenaQueueView.scss";
import { SendMessageComposer } from "../../api";
import { ArenaJoinQueueComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ArenaJoinQueueComposer";
import { ArenaLeaveQueueComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ArenaLeaveQueueComposer";

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
    rank: number;
    wins: number;
    losses: number;
    rating: number;
}

type ArenaQueueStatus = "idle" | "queued" | "matched";

interface ArenaQueueViewProps {
    visible: boolean;
    onClose?: () => void;
    currentUser?: ArenaFighter;
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

    // ----- DRAG STATE -----
    const [position, setPosition] = useState<{ x: number; y: number } | null>(
        null
    );
    const [isDragging, setIsDragging] = useState(false);

    // Helper: build Habbo head-only avatar URL
    const getAvatarHeadUrl = (
        figure?: string,
        side: "left" | "right" = "left"
    ) => {
        if (!figure) return "";
        const direction = side === "left" ? 2 : 4; // face inward
        return `https://www.habbo.com/habbo-imaging/avatarimage?figure=${figure}&headonly=1&direction=${direction}`;
    };

    // Center once when it first shows; do NOT reset search/match when dragging
    useEffect(() => {
        if (!visible) return;

        // Only set self if we don't already have one
        setSelf((oldSelf) => oldSelf ?? currentUser);
        setActiveTab("match");

        if (!position) {
            try {
                const width = 750; // matches CSS width
                const x = (window.innerWidth - width) / 2;
                const y = 60;
                setPosition({ x, y });
            } catch {
                // ignore (SSR safety)
            }
        }
    }, [visible, currentUser, position]);

    // ----- ARENA STATUS BRIDGE -----
    useEffect(() => {
        const handleArenaStatus = (ev: Event) => {
            const custom = ev as CustomEvent<any>;
            const detail = custom.detail;
            if (!detail) return;

            // Personal queue state for THIS client
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
                    rating: 0,
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
                    rating: 0,
                });
            } else {
                setOpponent(undefined);
            }
        };

        window.addEventListener("arena_status", handleArenaStatus);
        return () => {
            window.removeEventListener("arena_status", handleArenaStatus);
        };
    }, []);

    const sendJoinQueue = useCallback(() => {
        SendMessageComposer(new ArenaJoinQueueComposer());
    }, []);

    const sendLeaveQueue = useCallback(() => {
        SendMessageComposer(new ArenaLeaveQueueComposer());
    }, []);

    const handleJoinClick = useCallback(() => {
        if (status === "idle") {
            // Enter queue → clear opponent, optimistic queued
            setOpponent(undefined);
            setStatus("queued");
            sendJoinQueue();
        } else if (status === "queued" || status === "matched") {
            // Leave queue / cancel match
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

    // Proper close button: leave queue if needed then close
    const handleCloseClick = useCallback(() => {
        if (status !== "idle") {
            sendLeaveQueue();
        }
        onClose && onClose();
    }, [status, sendLeaveQueue, onClose]);

    // ----- DRAG HANDLERS -----
    const handleHeaderMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // only left click

        // Don't initiate drag if they grabbed the close button
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

    if (!visible) return null;

    // NOW: searching/matched come from the server, not our personal status
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
        if (!fighter)
            return (
                <div className="arena-stats-row arena-stats-row--empty">
                    Waiting for player...
                </div>
            );

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
                {/* LEFT — BLUE (YOU / or blue fighter for spectators) */}
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

                {/* RIGHT — RED (OPPONENT) */}
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

    const renderLeaderboardTab = () => (
        <div className="arena-leaderboard">
            {leaderboard.length === 0 && (
                <div className="arena-leaderboard-empty">
                    No arena matches yet. Be the first to enter the ring!
                </div>
            )}

            {leaderboard.length > 0 && (
                <div className="arena-leaderboard-table">
                    <div className="arena-leaderboard-header-row">
                        <span className="col rank">#</span>
                        <span className="col name">Fighter</span>
                        <span className="col wl">W / L</span>
                        <span className="col rating">Rating</span>
                    </div>

                    {leaderboard.map((entry) => (
                        <div
                            className="arena-leaderboard-row"
                            key={entry.userId}
                        >
                            <span className="col rank">{entry.rank}</span>
                            <span className="col name">{entry.username}</span>
                            <span className="col wl">
                                {entry.wins} / {entry.losses}
                            </span>
                            <span className="col rating">{entry.rating}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const containerStyle =
        position != null
            ? {
                  left: position.x,
                  top: position.y,
                  transform: "none",
              }
            : undefined;

    return (
        <div className="arena-container" style={containerStyle}>
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

            {/* Tabs row */}
            <div className="arena-tabs">
                <button
                    className={`tab-btn ${
                        activeTab === "match" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("match")}
                >
                    Matchmaking
                </button>

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
                {/* LEFT COLUMN - lobby info */}
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
