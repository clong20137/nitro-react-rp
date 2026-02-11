import React, { FC, useEffect, useRef, useState } from "react";
import "./DiscordVerificationView.scss";

interface DiscordVerifyDetail {
    code?: string;
    serverTag?: string;
}

export const DiscordVerificationView: FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const [code, setCode] = useState<string>("");
    const [serverTag, setServerTag] = useState<string>("our Discord");

    // ---- drag state ----
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem("discord-verify-pos");
            return saved ? JSON.parse(saved) : { x: 120, y: 120 };
        } catch {
            return { x: 120, y: 120 };
        }
    });

    const [dragging, setDragging] = useState(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Open from packet bridge: window.dispatchEvent(new CustomEvent('discord_verification_required', { detail: { code, serverTag } }))
    useEffect(() => {
        const openHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | DiscordVerifyDetail
                | undefined;

            setCode(detail?.code || "");
            setServerTag(detail?.serverTag || "our Discord");

            setIsClosing(false);
            setIsOpen(true);
        };

        window.addEventListener(
            "discord_verification_required",
            openHandler as EventListener
        );

        return () =>
            window.removeEventListener(
                "discord_verification_required",
                openHandler as EventListener
            );
    }, []);

    // drag handlers
    const onHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rootRef.current) return;

        setDragging(true);
        dragOffsetRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };

        e.preventDefault();
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;

            const newPos = {
                x: e.clientX - dragOffsetRef.current.x,
                y: e.clientY - dragOffsetRef.current.y,
            };

            setPosition(newPos);
            localStorage.setItem("discord-verify-pos", JSON.stringify(newPos));
        };

        const onMouseUp = () => setDragging(false);

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging, position]);

    const handleClose = () => {
        setIsClosing(true);

        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 230);
    };

    const onJoinDiscord = () => {
        window.open(
            "https://discord.gg/AbHcqGKJB",
            "_blank",
            "noopener,noreferrer"
        );
    };

    // don’t render when fully closed
    if (!isOpen && !isClosing) return null;

    return (
        <div
            ref={rootRef}
            className={`discord-verify-view ${
                isClosing ? "exit-br" : "enter-br"
            }`}
            style={{ left: position.x, top: position.y }}
        >
            {/* HEADER */}
            <div
                className="discord-verify-header"
                onMouseDown={onHeaderMouseDown}
            >
                <span className="discord-verify-title">
                    Discord Verification
                </span>
                <button
                    className="close-button"
                    onClick={handleClose}
                    aria-label="Close"
                />
            </div>

            {/* CONTENT */}
            <div className="discord-verify-content">
                <div className="discord-verify-body">
                    {/* LEFT: Discord Icon */}
                    <div className="discord-verify-left">
                        <div
                            className="discord-verify-icon"
                            aria-hidden="true"
                        />
                    </div>

                    {/* Divider */}
                    <div className="discord-verify-divider" />

                    {/* RIGHT: Text */}
                    <div className="discord-verify-right">
                        <div className="discord-verify-h1">
                            Verification Required!
                        </div>

                        <div className="discord-verify-p">
                            To play OlympusRP, your hotel account must be linked
                            to {serverTag}.<br />
                            Join our Discord and complete verification, then
                            reconnect to the hotel.
                        </div>

                        {/* OPTIONAL: show code if you want */}
                        {!!code && (
                            <div className="discord-verify-code">
                                <div className="discord-verify-code-label">
                                    Your Verification Code
                                </div>
                                <div className="discord-verify-code-box">
                                    {code}
                                </div>
                                <div className="discord-verify-code-hint">
                                    Use this in Discord: <b>/verify {code}</b>
                                </div>
                            </div>
                        )}

                        <div className="discord-verify-actions">
                            <button
                                className="discord-button"
                                onClick={onJoinDiscord}
                            >
                                Join Discord
                            </button>
                        </div>

                        <div className="discord-verify-footnote">
                            Once verified, close this window and reconnect.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
