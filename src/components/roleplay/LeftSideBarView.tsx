import {
    FC,
    useState,
    useEffect,
    useRef,
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

/** ---- optional onboarding anchor hook (same as above) ---- */
type AnchorEventDetail = { id: string; el: HTMLElement | null };
const OB_REGISTER_EVT = "ob-register-anchor";
function useOnboardingAnchor(
    id: string,
    ref: MutableRefObject<HTMLElement | null>
) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        window.dispatchEvent(
            new CustomEvent<AnchorEventDetail>(OB_REGISTER_EVT, {
                detail: { id, el },
            })
        );
        const re = () =>
            window.dispatchEvent(
                new CustomEvent<AnchorEventDetail>(OB_REGISTER_EVT, {
                    detail: { id, el: ref.current },
                })
            );
        window.addEventListener("resize", re);
        return () => window.removeEventListener("resize", re);
    }, [id, ref]);
}
/** ------------------------------------------------------- */

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

    const gangModeRef = useRef<"none" | "create" | "details">("none");
    useEffect(() => {
        gangModeRef.current = gangMode;
    }, [gangMode]);

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

    const onClickInventory = () => setShowInventory((prev) => !prev);
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
    const onClickMacros = () => setShowMacros((prev) => !prev);

    // Example: if you ever want to force anchors for specific icons
    const skullRef = useRef<HTMLDivElement | null>(null);
    const messageRef = useRef<HTMLDivElement | null>(null);
    // (optional) register them — the overlay already finds them via CSS
    // useOnboardingAnchor('gangs', skullRef);
    // useOnboardingAnchor('gangchat', messageRef);

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
                                ref={skullRef}
                                className="sidebar-icon skull"
                                title="Gangs"
                                onClick={onClickGangs}
                            />
                            <span className="tooltip-text">Gangs</span>
                        </div>

                        <div className="sidebar-icon tooltip-container">
                            <div
                                ref={messageRef}
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

                        <div className="sidebar-icon tooltip-container">
                            <div
                                className="sidebar-icon macros"
                                title="Macros"
                                onClick={onClickMacros}
                            />
                            <span className="tooltip-text">Macros</span>
                        </div>
                    </div>
                </div>

                {/* NEW ARROW BUTTON */}
                <div
                    className={`sidebar-toggle ${
                        sidebarOpen ? "open" : "closed"
                    }`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                />
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
