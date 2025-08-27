import { FC } from "react";
import { Base, Column, LayoutProgressBar, Text } from "../../common";
import "./LoadingView.scss";

interface LoadingViewProps {
    isError: boolean;
    message: string;
    percent: number;
    /** Optional: replace default logo path at runtime */
    logoSrc?: string;
}

export const LoadingView: FC<LoadingViewProps> = ({
    isError = false,
    message = "",
    percent = 0,
    logoSrc,
}) => {
    return (
        <Column
            fullHeight
            position="relative"
            className="nitro-loading olympus"
        >
            {/* Olympus background scene */}
            <div className="oly-sky" />
            <div className="oly-stars" />
            <div className="oly-clouds back" />
            <div className="oly-mount" />
            <div className="oly-temple" />
            <div className="oly-clouds front" />

            {/* Centerpiece logo */}
            <div className="oly-logo-wrap">
                <div className="oly-glow" />
                <div className="oly-logo" />
                <div className="oly-lightning" aria-hidden />
            </div>
            {/* HUD / progress */}
            <Base fullHeight className="container h-100">
                <Column fullHeight alignItems="center" justifyContent="end">
                    <Column size={6} className="oly-panel text-center py-4">
                        {isError && message ? (
                            <Base className="fs-4 text-shadow">{message}</Base>
                        ) : (
                            <>
                                <Text
                                    fontSize={4}
                                    variant="white"
                                    className="text-shadow"
                                >
                                    {Math.max(
                                        0,
                                        Math.min(100, percent)
                                    ).toFixed()}
                                    %
                                </Text>
                                <LayoutProgressBar
                                    progress={percent}
                                    className="mt-2 large oly-progress"
                                />
                            </>
                        )}
                    </Column>
                </Column>
            </Base>

            {/* Greek key border */}
            <div className="oly-border top" />
            <div className="oly-border right" />
            <div className="oly-border bottom" />
            <div className="oly-border left" />
        </Column>
    );
};

export default LoadingView;
