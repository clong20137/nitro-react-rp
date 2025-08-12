import { FC, useState, useEffect, useRef } from "react";
import { GetSessionDataManager } from "../../api";
import { CreateGangView } from "../roleplay/CreateGangView";
import { GangsDetailView } from "../roleplay/GangsDetailView";
import { CorporationsView } from "./CorporationView";
import { InventoryView } from "./InventoryView";
import { WantedListView } from "./WantedListView";
import { CorporationData } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/CorporationsListParser";
import { SendMessageComposer } from "../../api";
import { CheckGangStatusComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CheckGangStatusComposer";
import "./LeftSideBarView.scss";
import { ToggleGangChatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ToggleGangChatComposer";
import { GetWantedListComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetWantedListComposer";
import { GetCorporationsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetCorporationsComposer";

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

    const userId = GetSessionDataManager().userId;

    useEffect(() => {
        gangModeRef.current = gangMode;
    }, [gangMode]);
    useEffect(() => {
        const handleCorporationsList = (event: any) => {
            const corporations = event.detail.corporations;
            setCorporations(corporations); // make sure this state is defined
            setShowCorporations(true); // 👈 this was missing
        };

        window.addEventListener(
            "corporations_list_result",
            handleCorporationsList
        );

        return () => {
            window.removeEventListener(
                "corporations_list_result",
                handleCorporationsList
            );
        };
    }, []);

    useEffect(() => {
        const handleCreate = () => {
            if (gangModeRef.current === "create") return;
            setGangMode("create");
        };

        const handleDetail = () => {
            if (gangModeRef.current === "details") return;
            setGangMode("details");
        };

        const handleGangStatus = (event: CustomEvent) => {
            const isInGang = event.detail?.inGang;
            if (isInGang) handleDetail();
            else handleCreate();
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

    const handleGangClick = () => {
        SendMessageComposer(new CheckGangStatusComposer());
    };

    const closeAll = () => {
        setShowInventory(false);
        setShowWantedList(false);
        setShowCorporations(false);
        setGangMode("none");
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
                                onClick={() => {
                                    setShowInventory((prev) => !prev);
                                }}
                            />
                            <span className="tooltip-text">Inventory</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon wanted"
                                title="Wanted"
                                onClick={() => {
                                    SendMessageComposer(
                                        new GetWantedListComposer()
                                    ); // 👈 Send request
                                    setShowWantedList((prev) => !prev);
                                }}
                            />
                            <span className="tooltip-text">Wanted List</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon corps"
                                title="Corporations"
                                onClick={() => {
                                    SendMessageComposer(
                                        new GetCorporationsComposer()
                                    );
                                }}
                            />
                            <span className="tooltip-text">Corporations</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon skull"
                                title="Gangs"
                                onClick={() => {
                                    handleGangClick();
                                }}
                            />
                            <span className="tooltip-text">Gangs</span>
                        </div>
                        <div className="sidebar-icon tooltip-container">
                            <div
                                className={`sidebar-icon message ${
                                    isGangChatEnabled ? "active" : ""
                                }`}
                                title="Gang Chat Toggle"
                                onClick={() => {
                                    setIsGangChatEnabled((prev) => {
                                        const newState = !prev;

                                        // Dispatch event for other components
                                        window.dispatchEvent(
                                            new CustomEvent(
                                                "gang-chat-toggle",
                                                {
                                                    detail: newState,
                                                }
                                            )
                                        );

                                        // Send to server
                                        SendMessageComposer(
                                            new ToggleGangChatComposer(newState)
                                        );

                                        return newState;
                                    });
                                }}
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
