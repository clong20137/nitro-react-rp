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
import { initClickThroughUsers } from "./components/roleplay/ClickThroughUsers";
import { CasinoJackpotWidget } from "./components/roleplay/CasinoJackpotWidget";
import { DiscordVerificationView } from "./components/roleplay/DiscordVerificationView";

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

    if (!GetNitroInstance()) {
        //@ts-ignore
        if (!NitroConfig) throw new Error("NitroConfig is not defined!");

        Nitro.bootstrap();
        const worker = new WorkerBuilder(IntervalWebWorker);
        Nitro.instance.setWorker(worker);
    }

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
    useEffect(() => {
        initClickThroughUsers();
        initEventBridge();
    }, []);

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

                <LiveFeed />
                <BlackjackView />
                <HighLowView />
                <SlotMachineView />
                <MarketplaceView />
                <HotelAlertView />
                <CasinoJackpotWidget></CasinoJackpotWidget>
                <DiscordVerificationView></DiscordVerificationView>
                <PoliceCallView />

              
            </Base>
        </PreloadProvider>
    );
};
