import { FC } from "react";
import { Base, Column, LayoutProgressBar, Text } from "../../common";
import "./LoadingView.scss";

interface LoadingViewProps {
    isError: boolean;
    message: string;
    percent: number;
    logoSrc?: string;
}

export const LoadingView: FC<LoadingViewProps> = ({
    isError = false,
    message = "",
    percent = 0,
    logoSrc,
}) => {
    const safePercent = Math.max(0, Math.min(100, percent));

    return (
        <Column
            fullHeight
            position="relative"
            className="nitro-loading olympus"
        >
            <div className="oly-sky" />
            <div className="oly-stars" />
            <div className="oly-clouds back" />
            <div className="oly-mount" />
            <div className="oly-temple" />
            <div className="oly-clouds front" />

            <div className="oly-logo-wrap">
                <div className="oly-glow" />
                <div
                    className="oly-logo"
                    style={
                        logoSrc
                            ? { backgroundImage: `url(${logoSrc})` }
                            : undefined
                    }
                />
                <div className="oly-lightning" aria-hidden />
            </div>

            <Base fullHeight className="container h-100">
                <Column fullHeight alignItems="center" justifyContent="end">
                    <Column size={6} className="oly-panel text-center py-4">
                        {isError && message ? (
                            <>
                                <Text
                                    fontSize={4}
                                    variant="white"
                                    className="text-shadow oly-status"
                                >
                                    Connection Issue
                                </Text>
                                <Text
                                    fontSize={6}
                                    variant="white"
                                    className="text-shadow oly-substatus"
                                >
                                    {message}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text
                                    fontSize={4}
                                    variant="white"
                                    className="text-shadow oly-status"
                                >
                                    Entering OlympusRP
                                </Text>

                                <Text
                                    fontSize={6}
                                    variant="white"
                                    className="text-shadow oly-substatus"
                                >
                                    {safePercent < 100
                                        ? "Loading world assets..."
                                        : "Finalizing connection..."}
                                </Text>

                                <div className="oly-progress-wrap">
                                    <LayoutProgressBar
                                        progress={safePercent}
                                        className="oly-progress"
                                    />
                                </div>

                                <div className="oly-progress-meta">
                                    <span className="oly-progress-percent">
                                        {safePercent.toFixed()}%
                                    </span>
                                </div>
                            </>
                        )}
                    </Column>
                </Column>
            </Base>

            <div className="oly-border top" />
            <div className="oly-border right" />
            <div className="oly-border bottom" />
            <div className="oly-border left" />
        </Column>
    );
};

export default LoadingView;
