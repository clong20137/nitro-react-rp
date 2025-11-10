import {
    ConfigurationEvent,
    HabboWebTools,
    LegacyExternalInterface,
    Nitro,
    NitroCommunicationDemoEvent,
    NitroEvent,
    NitroLocalizationEvent,
    NitroVersion,
    RoomEngineEvent,
    WebGL,
} from "@nitrots/nitro-renderer";

import { FC, useCallback, useEffect, useState } from "react";
import {
    DispatchUiEvent,
    GetCommunication,
    GetConfiguration,
    GetNitroInstance,
    GetUIVersion,
} from "./api";

import {
    Base,
    TransitionAnimation,
    TransitionAnimationTypes,
    LayoutProgressBar,
    Text,
} from "./common";

import { LoadingView } from "./components/loading/LoadingView";
import { MainView } from "./components/main/MainView";
import { LeftSidebarView } from "./components/roleplay/LeftSideBarView";
import StatsBar from "./components/roleplay/StatsBar";
import { PreloadProvider } from "./contexts/PreloadContext";
import { initEventBridge } from "./events/EventBridge";

import {
    useConfigurationEvent,
    useLocalizationEvent,
    useMainEvent,
    useRoomEngineEvent,
} from "./hooks";

import IntervalWebWorker from "./workers/IntervalWebWorker";
import { WorkerBuilder } from "./workers/WorkerBuilder";

import { LiveFeed } from "./components/roleplay/LiveFeed";
import { PoliceCallView } from "./components/roleplay/PoliceCallView";
import BlackjackView from "./components/roleplay/BlackJackView";
import MarketplaceView from "./components/roleplay/MarketplaceView";
import HighLowView from "./components/roleplay/HighLowView";
import SlotMachineView from "./components/roleplay/SlotMachineView";
import { HotelAlertView } from "./components/roleplay/HotelAlertView";
import { OnboardingOverlay } from "./components/roleplay/OnboardingOverlay";
import { initClickThroughUsers } from "./components/roleplay/ClickThroughUsers";

// optional: if you later restore big wheel
// import BigWheelView from "./components/roleplay/BigWheelView";

NitroVersion.UI_VERSION = GetUIVersion();

export const App: FC = () => {
    const [isReady, setIsReady] = useState(false);
    const [isError, setIsError] = useState(false);
    const [message, setMessage] = useState("Getting Ready");
    const [percent, setPercent] = useState(0);
    const [imageRendering, setImageRendering] = useState<boolean>(true);

    /* Disconnect overlay */
    const [dcVisible, setDcVisible] = useState(false);
    const [dcSeconds, setDcSeconds] = useState(15);

    /* ==============================================
Bootstrap Nitro
===============================================*/
    if (!GetNitroInstance()) {
        //@ts-ignore
        if (!NitroConfig) throw new Error("NitroConfig is not defined!");

        Nitro.bootstrap();
        const worker = new WorkerBuilder(IntervalWebWorker);
        Nitro.instance.setWorker(worker);
    }

    /* ==============================================
Core init handler
===============================================*/
    const handler = useCallback((event: NitroEvent) => {
        switch (event.type) {
            case ConfigurationEvent.LOADED:
                GetNitroInstance().localization.init();
                setPercent((prev) => prev + 20);
                return;

            case ConfigurationEvent.FAILED:
                setIsError(true);
                setMessage("Configuration Failed");
                return;

            case Nitro.WEBGL_UNAVAILABLE:
                setIsError(true);
                setMessage("WebGL Required");
                return;

            case Nitro.WEBGL_CONTEXT_LOST:
                setIsError(true);
                setMessage("WebGL Context Lost - Reloading");
                setTimeout(() => window.location.reload(), 1500);
                return;

            case NitroCommunicationDemoEvent.CONNECTION_HANDSHAKING:
                setPercent((prev) => prev + 20);
                return;

            case NitroCommunicationDemoEvent.CONNECTION_HANDSHAKE_FAILED:
                setIsError(true);
                setMessage("Handshake Failed");
                return;

            case NitroCommunicationDemoEvent.CONNECTION_AUTHENTICATED:
                setPercent((prev) => prev + 20);
                GetNitroInstance().init();

                if (LegacyExternalInterface.available)
                    LegacyExternalInterface.call(
                        "legacyTrack",
                        "authentication",
                        "authok",
                        []
                    );
                return;

            case NitroCommunicationDemoEvent.CONNECTION_ERROR:
            case NitroCommunicationDemoEvent.CONNECTION_CLOSED:
                setIsError(true);
                setMessage("Connection Error");
                setDcVisible(true);
                setDcSeconds(15);
                return;

            case RoomEngineEvent.ENGINE_INITIALIZED:
                setPercent((prev) => prev + 20);
                setTimeout(() => setIsReady(true), 300);
                return;

            case NitroLocalizationEvent.LOADED: {
                const assetUrls = GetConfiguration<string[]>(
                    "preload.assets.urls"
                );
                const urls: string[] = [];

                if (assetUrls && assetUrls.length)
                    for (const url of assetUrls)
                        urls.push(
                            GetNitroInstance().core.configuration.interpolate(
                                url
                            )
                        );

                GetNitroInstance().core.asset.downloadAssets(
                    urls,
                    (status: boolean) => {
                        if (status) {
                            GetCommunication().init();
                            setPercent((prev) => prev + 20);
                        } else {
                            setIsError(true);
                            setMessage("Assets Failed");
                        }
                    }
                );
                return;
            }
        }
    }, []);

    /* Event bindings */
    useMainEvent(Nitro.WEBGL_UNAVAILABLE, handler);
    useMainEvent(Nitro.WEBGL_CONTEXT_LOST, handler);
    useMainEvent(NitroCommunicationDemoEvent.CONNECTION_HANDSHAKING, handler);
    useMainEvent(
        NitroCommunicationDemoEvent.CONNECTION_HANDSHAKE_FAILED,
        handler
    );
    useMainEvent(NitroCommunicationDemoEvent.CONNECTION_AUTHENTICATED, handler);
    useMainEvent(NitroCommunicationDemoEvent.CONNECTION_ERROR, handler);
    useMainEvent(NitroCommunicationDemoEvent.CONNECTION_CLOSED, handler);
    useRoomEngineEvent(RoomEngineEvent.ENGINE_INITIALIZED, handler);
    useLocalizationEvent(NitroLocalizationEvent.LOADED, handler);
    useConfigurationEvent(ConfigurationEvent.LOADED, handler);
    useConfigurationEvent(ConfigurationEvent.FAILED, handler);

    /* ==============================================
Init bridges (ClickThrough + EventBridge)
===============================================*/
    useEffect(() => {
        initClickThroughUsers(); // ✅ initializes click-through bridge once
        initEventBridge();
    }, []);

    /* ==============================================
WebGL check & resize
===============================================*/
    useEffect(() => {
        if (!WebGL.isWebGLAvailable()) {
            DispatchUiEvent(new NitroEvent(Nitro.WEBGL_UNAVAILABLE));
        } else {
            GetNitroInstance().core.configuration.init();
        }

        const resize = () => setImageRendering(!(window.devicePixelRatio % 1));
        window.addEventListener("resize", resize);
        resize();

        return () => window.removeEventListener("resize", resize);
    }, []);

    /* ==============================================
Disconnect overlay countdown
===============================================*/
    useEffect(() => {
        if (!dcVisible) return;
        if (dcSeconds <= 0) {
            window.location.reload();
            return;
        }
        const id = setTimeout(() => setDcSeconds((s) => s - 1), 1000);
        return () => clearTimeout(id);
    }, [dcVisible, dcSeconds]);

    const reloadNow = () => window.location.reload();

    /* ==============================================
Render
===============================================*/
    return (
        <PreloadProvider>
            <Base
                fit
                overflow="hidden"
                className={imageRendering ? "image-rendering-pixelated" : ""}
            >
                {(!isReady || isError) && (
                    <LoadingView
                        isError={isError}
                        message={message}
                        percent={percent}
                    />
                )}

                <TransitionAnimation
                    type={TransitionAnimationTypes.FADE_IN}
                    inProp={isReady}
                >
                    <MainView />
                </TransitionAnimation>

                <Base id="draggable-windows-container" />

                {isReady && <StatsBar />}

                <OnboardingOverlay />
                <LiveFeed />
                <BlackjackView />
                <HighLowView />
                <SlotMachineView />
                <MarketplaceView />
                <HotelAlertView />
                {/* <BigWheelView /> */}
                <PoliceCallView  />

                {/* Disconnect overlay */}
                {dcVisible && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 99999,
                            display: "grid",
                            placeItems: "center",
                            background: "rgba(0,0,0,.55)",
                            backdropFilter: "blur(2px)",
                        }}
                    >
                        <div
                            style={{
                                width: "min(640px, 80vw)",
                                padding: "18px 20px",
                                borderRadius: 10,
                                background:
                                    "linear-gradient(180deg, rgba(20,24,36,.6), rgba(20,24,36,.35))",
                                border: "2px solid rgba(138,107,46,.9)",
                                boxShadow:
                                    "0 8px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)",
                                textAlign: "center",
                                color: "#fff",
                            }}
                        >
                            <div
                                style={{
                                    marginBottom: 8,
                                    fontSize: 18,
                                    fontWeight: 700,
                                }}
                            >
                                Whoops! It seems like you have been
                                disconnected…
                            </div>

                            <Text variant="white">
                                Reloading in {dcSeconds}s
                            </Text>

                            <LayoutProgressBar
                                progress={((15 - dcSeconds) / 15) * 100}
                                className="mt-2 large oly-progress"
                            />

                            <div
                                style={{
                                    marginTop: 12,
                                    display: "flex",
                                    gap: 8,
                                    justifyContent: "center",
                                }}
                            >
                                <button
                                    onClick={reloadNow}
                                    style={{
                                        padding: "8px 14px",
                                        fontWeight: 700,
                                        borderRadius: 6,
                                        border: "none",
                                        cursor: "pointer",
                                        background:
                                            "linear-gradient(180deg,#bd9426,#bd9426 50%,#cdb267 0,#cdb267)",
                                        color: "#111",
                                    }}
                                >
                                    Reload now
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Base>
        </PreloadProvider>
    );
};
