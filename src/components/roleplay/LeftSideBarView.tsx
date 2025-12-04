import { FC, useEffect, useState } from "react";
import { GetSessionDataManager, SendMessageComposer } from "../../api";

import { CreateGangView } from "../roleplay/CreateGangView";
import { GangsDetailView } from "../roleplay/GangsDetailView";
import { CorporationsView } from "./CorporationView";
import { InventoryView } from "./InventoryView";
import { WantedListView } from "./WantedListView";
import { MacroView } from "./MacroView";

import { CorporationData } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/CorporationsListParser";
import { CheckGangStatusComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CheckGangStatusComposer";
import { ToggleGangChatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ToggleGangChatComposer";
import { GetWantedListComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetWantedListComposer";
import { GetCorporationsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetCorporationsComposer";

import "./LeftSideBarView.scss";

type GangMode = "none" | "loading" | "create" | "details";

export const LeftSidebarView: FC = () => {
    const [showInventory, setShowInventory] = useState(false);
    const [showWantedList, setShowWantedList] = useState(false);
    const [corporations, setCorporations] = useState<CorporationData[]>([]);
    const [showCorporations, setShowCorporations] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isGangChatEnabled, setIsGangChatEnabled] = useState(false);
    const [gangMode, setGangMode] = useState<GangMode>("none");
    const [showMacros, setShowMacros] = useState(false);

    const userId = GetSessionDataManager().userId;

    /* ----------------------- Corporations event listener ---------------------- */

    useEffect(() => {
        const handleCorporationsList = (event: any) => {
            const corps = event.detail.corporations as CorporationData[];
            setCorporations(corps);
            // ❌ previously: setShowCorporations((prev) => prev || true);
            // That can auto-open on login if this event fires.
            // ✅ Now we only open Corporations when user clicks the chip.
        };

        window.addEventListener(
            "corporations_list_result",
            handleCorporationsList
        );

        return () =>
            window.removeEventListener(
                "corporations_list_result",
                handleCorporationsList
            );
    }, []);

    /* -------------------------- Gangs bridge listeners ------------------------ */

    useEffect(() => {
        const handleCreate = () => setGangMode("create");
        const handleDetail = () => setGangMode("details");

        const decideFromPayload = (detail: any): boolean => {
            if (!detail) return false;
            if (typeof detail.inGang === "boolean") return detail.inGang;
            if (typeof detail.isInGang === "boolean") return detail.isInGang;
            if (detail.gangId) return true;
            if (detail.gangName) return true;
            return false;
        };

        const handleGangStatus = (event: Event) => {
            const detail = (event as CustomEvent).detail as any;
            const inGang = decideFromPayload(detail);

            // ⭐ Only change modes if we are currently "loading"
            setGangMode((prev) => {
                if (prev !== "loading") return prev;
                return inGang ? "details" : "create";
            });
        };

        window.addEventListener("open-create-gang", handleCreate);
        window.addEventListener("open-gang-details", handleDetail);
        window.addEventListener(
            "gang_status_result",
            handleGangStatus as EventListener
        );
        window.addEventListener(
            "gang_status_received",
            handleGangStatus as EventListener
        );

        // after create / edit / delete, some stacks fire these bridge events
        const refreshOnBridge = () => {
            // request status again
            try {
                SendMessageComposer(new CheckGangStatusComposer());
            } catch {}
            window.dispatchEvent(new CustomEvent("request_gang_status"));
        };

        window.addEventListener(
            "request_gang_refresh",
            refreshOnBridge as EventListener
        );
        window.addEventListener(
            "gang_changed",
            refreshOnBridge as EventListener
        );

        return () => {
            window.removeEventListener("open-create-gang", handleCreate);
            window.removeEventListener("open-gang-details", handleDetail);
            window.removeEventListener(
                "gang_status_result",
                handleGangStatus as EventListener
            );
            window.removeEventListener(
                "gang_status_received",
                handleGangStatus as EventListener
            );
            window.removeEventListener(
                "request_gang_refresh",
                refreshOnBridge as EventListener
            );
            window.removeEventListener(
                "gang_changed",
                refreshOnBridge as EventListener
            );
        };
    }, []);

    /* ---------------------------- Sidebar handlers ---------------------------- */

    const onClickInventory = () => setShowInventory((p) => !p);

    const onClickWanted = () => {
        setShowWantedList((prev) => {
            const next = !prev;
            if (next) SendMessageComposer(new GetWantedListComposer());
            return next;
        });
    };

    const onClickCorporations = () => {
        setShowCorporations((prev) => {
            const next = !prev;
            if (next) SendMessageComposer(new GetCorporationsComposer());
            return next;
        });
    };

    const askGangStatus = () => {
        try {
            SendMessageComposer(new CheckGangStatusComposer());
        } catch {}
        // for older bridges
        window.dispatchEvent(new CustomEvent("request_gang_status"));
    };

    // ❌ REMOVED: auto gang status on boot that could cause unintended UI opens
    //
    // useEffect(() => {
    // askGangStatus();
    // }, []);
    //
    // ✅ Now we only ask for status when the user actually clicks the Gangs chip.

    const onClickGangs = () => {
        setGangMode((m) => {
            if (m !== "none") return "none"; // close any open gang UI
            // open flow → show small loading shim then decide
            askGangStatus();
            return "loading";
        });
    };

    const onClickGangChatToggle = () => {
        setIsGangChatEnabled((prev) => {
            const next = !prev;
            window.dispatchEvent(
                new CustomEvent("gang-chat-toggle", { detail: next })
            );
            SendMessageComposer(new ToggleGangChatComposer(next));
            return next;
        });
    };

    const onClickMacros = () => setShowMacros((p) => !p);

    /* ----------------------------------- UI ----------------------------------- */

    return (
        <>
            <div className="left-sidebar-wrapper">
                <div
                    className={`left-sidebar-container ${
                        sidebarOpen ? "open" : "closed"
                    }`}
                >
                    <div className="left-sidebar">
                        <div
                            className="left-sidebar__toggle"
                            role="button"
                            aria-label={
                                sidebarOpen
                                    ? "Collapse sidebar"
                                    : "Expand sidebar"
                            }
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        />

                        <div
                            className="sidebar-chip chip-inventory"
                            data-tip="Inventory"
                            onClick={onClickInventory}
                            role="button"
                            aria-label="Inventory"
                        >
                            <div className="chip-icon" />
                        </div>

                        <div
                            className="sidebar-chip chip-wanted"
                            data-tip="Wanted List"
                            onClick={onClickWanted}
                            role="button"
                            aria-label="Wanted List"
                        >
                            <div className="chip-icon" />
                        </div>

                        <div
                            className="sidebar-chip chip-gangs"
                            data-tip="Gangs"
                            onClick={onClickGangs}
                            role="button"
                            aria-label="Gangs"
                        >
                            <div className="chip-icon" />
                        </div>

                        <div
                            className="sidebar-chip chip-corps"
                            data-tip="Corporations"
                            onClick={onClickCorporations}
                            role="button"
                            aria-label="Corporations"
                        >
                            <div className="chip-icon" />
                        </div>

                        <div
                            className={`sidebar-chip chip-chat ${
                                isGangChatEnabled ? "is-on" : ""
                            }`}
                            data-tip="Gang Chat Toggle"
                            onClick={onClickGangChatToggle}
                            role="button"
                            aria-label="Gang Chat Toggle"
                        >
                            <div className="chip-icon" />
                        </div>

                        <div
                            className="sidebar-chip chip-macros"
                            data-tip="Macros"
                            onClick={onClickMacros}
                            role="button"
                            aria-label="Macros"
                        >
                            <div className="chip-icon" />
                        </div>
                    </div>
                </div>
            </div>

            {showInventory && (
                <InventoryView onClose={() => setShowInventory(false)} />
            )}

            {showWantedList && (
                <WantedListView onClose={() => setShowWantedList(false)} />
            )}

            {showCorporations && (
                <CorporationsView
                    onClose={() => setShowCorporations(false)}
                    currentUserId={userId}
                />
            )}

            {gangMode === "loading" && (
                // tiny shim to avoid flicker while we wait for status
                <div
                    style={{
                        position: "fixed",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 2500,
                        padding: 12,
                        background: "rgba(0,0,0,.6)",
                        color: "#fff",
                        borderRadius: 6,
                        fontFamily: "var(--font, sans-serif)",
                    }}
                >
                    Checking gang status…
                </div>
            )}

            {gangMode === "create" && (
                <CreateGangView onClose={() => setGangMode("none")} />
            )}
            {gangMode === "details" && (
                <GangsDetailView onClose={() => setGangMode("none")} />
            )}

            {showMacros && <MacroView onClose={() => setShowMacros(false)} />}
        </>
    );
};
