import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    GetNitroInstance,
    GetRoomObjectBounds,
    GetRoomObjectScreenLocation,
    GetRoomSession,
} from "../../api";
import "./TargetOutlineOverlay.scss";

declare global {
    interface Window {
        __rpTargetUserId?: number;
    }
}

interface IOutlineBounds {
    left: number;
    top: number;
    width: number;
    height: number;
}

const OUTLINE_PADDING = 14;
const ALPHA_THRESHOLD = 24;

export const TargetOutlineOverlay: FC = () => {
    const [targetUserId, setTargetUserId] = useState(0);
    const [bounds, setBounds] = useState<IOutlineBounds | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const workCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        workCanvasRef.current = document.createElement("canvas");

        return () => {
            workCanvasRef.current = null;
        };
    }, []);

    useEffect(() => {
        const syncTarget = (event?: Event) => {
            const detailUserId = (event as CustomEvent<{ userId?: number }>)?.detail?.userId;
            const nextUserId = Number((detailUserId ?? window.__rpTargetUserId) || 0);

            setTargetUserId(nextUserId > 0 ? nextUserId : 0);
        };

        syncTarget();

        window.addEventListener("rp_target_changed", syncTarget as EventListener);
        window.addEventListener("user_inspect_clear", syncTarget as EventListener);
        window.addEventListener("opponent_target_clear", syncTarget as EventListener);

        return () => {
            window.removeEventListener("rp_target_changed", syncTarget as EventListener);
            window.removeEventListener("user_inspect_clear", syncTarget as EventListener);
            window.removeEventListener("opponent_target_clear", syncTarget as EventListener);
        };
    }, []);

    const roomIndex = useMemo(() => {
        if (targetUserId <= 0) return -1;

        try {
            const roomSession = GetRoomSession();
            const userData = roomSession?.userDataManager?.getUserData?.(targetUserId);

            if (typeof userData?.roomIndex === "number" && userData.roomIndex >= 0) {
                return userData.roomIndex;
            }
        } catch {}

        return -1;
    }, [targetUserId]);

    useEffect(() => {
        if (roomIndex < 0) {
            setBounds(null);
            return;
        }

        const updateOverlay = () => {
            try {
                const roomSession = GetRoomSession();
                const nitro = GetNitroInstance();
                const rendererView = nitro?.renderer?.view as HTMLCanvasElement | undefined;
                const overlayCanvas = canvasRef.current;
                const workCanvas = workCanvasRef.current;

                if (!roomSession || !rendererView || !overlayCanvas || !workCanvas) {
                    setBounds(null);
                    return;
                }

                const objectBounds = GetRoomObjectBounds(roomSession.roomId, roomIndex, RoomObjectCategory.UNIT, 1);
                const screenLocation = GetRoomObjectScreenLocation(roomSession.roomId, roomIndex, RoomObjectCategory.UNIT, 1);

                if (!objectBounds || !screenLocation || objectBounds.width <= 0 || objectBounds.height <= 0) {
                    setBounds(null);
                    return;
                }

                const width = Math.max(28, Math.round(objectBounds.width + (OUTLINE_PADDING * 2)));
                const height = Math.max(56, Math.round(objectBounds.height + (OUTLINE_PADDING * 2)));
                const left = Math.round(screenLocation.x - (objectBounds.width / 2) - OUTLINE_PADDING);
                const top = Math.round(screenLocation.y - objectBounds.height - OUTLINE_PADDING + 6);

                setBounds((previous) => {
                    if (
                        previous &&
                        previous.left === left &&
                        previous.top === top &&
                        previous.width === width &&
                        previous.height === height
                    ) {
                        return previous;
                    }

                    return { left, top, width, height };
                });

                const canvasWidth = Math.max(1, width);
                const canvasHeight = Math.max(1, height);

                if (overlayCanvas.width !== canvasWidth || overlayCanvas.height !== canvasHeight) {
                    overlayCanvas.width = canvasWidth;
                    overlayCanvas.height = canvasHeight;
                }

                if (workCanvas.width !== canvasWidth || workCanvas.height !== canvasHeight) {
                    workCanvas.width = canvasWidth;
                    workCanvas.height = canvasHeight;
                }

                const overlayContext = overlayCanvas.getContext("2d");
                const workContext = workCanvas.getContext("2d", { willReadFrequently: true });

                if (!overlayContext || !workContext) return;

                overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
                workContext.clearRect(0, 0, canvasWidth, canvasHeight);

                const sourceScaleX = rendererView.width / Math.max(1, rendererView.clientWidth || rendererView.width);
                const sourceScaleY = rendererView.height / Math.max(1, rendererView.clientHeight || rendererView.height);
                const sourceX = Math.round(left * sourceScaleX);
                const sourceY = Math.round(top * sourceScaleY);
                const sourceWidth = Math.max(1, Math.round(width * sourceScaleX));
                const sourceHeight = Math.max(1, Math.round(height * sourceScaleY));

                workContext.imageSmoothingEnabled = false;
                workContext.drawImage(
                    rendererView,
                    sourceX,
                    sourceY,
                    sourceWidth,
                    sourceHeight,
                    0,
                    0,
                    canvasWidth,
                    canvasHeight,
                );

                const sourceImage = workContext.getImageData(0, 0, canvasWidth, canvasHeight);
                const sourceData = sourceImage.data;
                const outputImage = overlayContext.createImageData(canvasWidth, canvasHeight);
                const outputData = outputImage.data;

                const hasOpaqueNeighbor = (x: number, y: number, radius: number) => {
                    for (let ny = y - radius; ny <= y + radius; ny++) {
                        if (ny < 0 || ny >= canvasHeight) continue;

                        for (let nx = x - radius; nx <= x + radius; nx++) {
                            if (nx < 0 || nx >= canvasWidth) continue;
                            if (nx === x && ny === y) continue;

                            const neighborIndex = ((ny * canvasWidth) + nx) * 4;

                            if (sourceData[neighborIndex + 3] > ALPHA_THRESHOLD) return true;
                        }
                    }

                    return false;
                };

                for (let y = 0; y < canvasHeight; y++) {
                    for (let x = 0; x < canvasWidth; x++) {
                        const index = ((y * canvasWidth) + x) * 4;
                        const alpha = sourceData[index + 3];

                        if (alpha > ALPHA_THRESHOLD) continue;

                        const outerRing = hasOpaqueNeighbor(x, y, 2);
                        const innerRing = hasOpaqueNeighbor(x, y, 1);

                        if (!outerRing) continue;

                        if (innerRing) {
                            outputData[index] = 255;
                            outputData[index + 1] = 213;
                            outputData[index + 2] = 66;
                            outputData[index + 3] = 255;
                        } else {
                            outputData[index] = 91;
                            outputData[index + 1] = 59;
                            outputData[index + 2] = 0;
                            outputData[index + 3] = 230;
                        }
                    }
                }

                overlayContext.putImageData(outputImage, 0, 0);
            } catch {
                setBounds(null);
            }
        };

        updateOverlay();
        GetNitroInstance().ticker.add(updateOverlay);

        return () => {
            GetNitroInstance().ticker.remove(updateOverlay);
        };
    }, [roomIndex]);

    if (!bounds) return null;

    return createPortal(
        <div
            className="rp-target-outline-anchor"
            style={{
                left: `${bounds.left}px`,
                top: `${bounds.top}px`,
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
            }}
        >
            <canvas className="rp-target-outline-canvas" ref={canvasRef} />
        </div>,
        document.body,
    );
};

export default TargetOutlineOverlay;
