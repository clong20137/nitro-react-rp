import { FC, useState, useEffect, useRef } from "react";
import { GetSessionDataManager, SendMessageComposer } from "../../api";
import { CreateGangView } from "../roleplay/CreateGangView";
import { GangsDetailView } from "../roleplay/GangsDetailView";
import { CorporationsView } from "./CorporationView";
import { InventoryView } from "./InventoryView";
import { WantedListView } from "./WantedListView";
import { CorporationData } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/CorporationsListParser";
import { CheckGangStatusComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CheckGangStatusComposer";
import { ToggleGangChatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ToggleGangChatComposer";
import { GetWantedListComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetWantedListComposer";
import { GetCorporationsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetCorporationsComposer";
import "./LeftSideBarView.scss";

export const LeftSidebarView: FC = () => {
    const [showInventory, setShowInventory] = useState(false);
    const [showWantedList, setShowWantedList] = useState(false);
    const [corporations, setCorporations] = useState<CorporationData[]>([]);
    const [showCorporations, setShowCorporations] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isGangChatEnabled, setIsGangChatEnabled] = useState(false);
    const [gangMode, setGangMode] = useState<"none" | "create" | "details">(
        "none"
    );

    const gangModeRef = useRef<"none" | "create" | "details">("none");
    useEffect(() => {
        gangModeRef.current = gangMode;
    }, [gangMode]);

    const userId = GetSessionDataManager().userId;

    // ————— Corporations: open on event, but allow icon to close immediately —————
    useEffect(() => {
        const handleCorporationsList = (event: any) => {
            const corps = event.detail.corporations as CorporationData[];
            setCorporations(corps);

            // only auto-open if we're not already showing (prevents re-opening after manual close)
            setShowCorporations((prev) => prev || true);
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

    // ————— Gang: respond to server telling us which module to open —————
    useEffect(() => {
        const handleCreate = () =>
            setGangMode((prev) => (prev === "create" ? prev : "create"));
        const handleDetail = () =>
            setGangMode((prev) => (prev === "details" ? prev : "details"));

        const handleGangStatus = (event: CustomEvent) => {
            const isInGang = event.detail?.inGang;
            setGangMode(isInGang ? "details" : "create");
        };

        window.addEventListener("open-create-gang", handleCreate);
        window.addEventListener("open-gang-details", handleDetail);
        window.addEventListener(
            "gang_status_result",
            handleGangStatus as EventListener
        );

        return () => {
            window.removeEventListener("open-create-gang", handleCreate);
            window.removeEventListener("open-gang-details", handleDetail);
            window.removeEventListener(
                "gang_status_result",
                handleGangStatus as EventListener
            );
        };
    }, []);

    // ————— Icon handlers (toggle-to-close) —————
    const onClickInventory = () => setShowInventory((prev) => !prev);

    const onClickWanted = () => {
        // request fresh list each time you open
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

    const onClickGangs = () => {
        // If any gang module is open → close it. Otherwise ask server which to open.
        if (gangModeRef.current !== "none") {
            setGangMode("none");
            return;
        }
        SendMessageComposer(new CheckGangStatusComposer());
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

    return (
        <>
            <div className="left-sidebar-wrapper">
                <div
                    className={`left-sidebar-container ${
                        sidebarOpen ? "open" : "closed"
                    }`}
                >
                    <div className="left-sidebar">
                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon inventory"
                                title="Inventory"
                                onClick={onClickInventory}
                            />
                            <span className="tooltip-text">Inventory</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon wanted"
                                title="Wanted"
                                onClick={onClickWanted}
                            />
                            <span className="tooltip-text">Wanted List</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon corps"
                                title="Corporations"
                                onClick={onClickCorporations}
                            />
                            <span className="tooltip-text">Corporations</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon skull"
                                title="Gangs"
                                onClick={onClickGangs}
                            />
                            <span className="tooltip-text">Gangs</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className={`sidebar-icon message ${
                                    isGangChatEnabled ? "active" : ""
                                }`}
                                title="Gang Chat Toggle"
                                onClick={onClickGangChatToggle}
                            />
                            <span className="tooltip-text">
                                Gang Chat Toggle
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    className="sidebar-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                    {sidebarOpen ? "❮" : "❯"}
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

            {gangMode === "create" && (
                <CreateGangView onClose={() => setGangMode("none")} />
            )}
            {gangMode === "details" && (
                <GangsDetailView onClose={() => setGangMode("none")} />
            )}
        </>
    );
};
