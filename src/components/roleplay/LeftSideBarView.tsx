import {
    FC,
    useEffect,
    useRef,
    useState,
    MutableRefObject,
    useLayoutEffect,
} from "react";
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

/** (optional) onboarding anchors omitted for brevity **/

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
    const [showMacros, setShowMacros] = useState(false);

    const userId = GetSessionDataManager().userId;

    useEffect(() => {
        const handleCorporationsList = (event: any) => {
            const corps = event.detail.corporations as CorporationData[];
            setCorporations(corps);
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

    useEffect(() => {
        const handleCreate = () => setGangMode("create");
        const handleDetail = () => setGangMode("details");
        const handleGangStatus = (event: CustomEvent) => {
            const isInGang = (event.detail as any)?.inGang;
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
    const onClickGangs = () => {
        setGangMode((m) =>
            m !== "none"
                ? "none"
                : (SendMessageComposer(new CheckGangStatusComposer()), m)
        );
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

    return (
        <>
            <div className="left-sidebar-wrapper">
                <div
                    className={`left-sidebar-container ${
                        sidebarOpen ? "open" : "closed"
                    }`}
                >
                    <div className="left-sidebar">
                        {/* Integrated toggle that flips left/right via CSS */}
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

                        {/* Stack of pills */}
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
