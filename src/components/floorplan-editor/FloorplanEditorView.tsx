import {
    FloorHeightMapEvent,
    ILinkEventTracker,
    NitroPoint,
    RoomEngineEvent,
    RoomVisualizationSettingsEvent,
    UpdateFloorPropertiesMessageComposer,
} from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useState } from "react";
import {
    AddEventLinkTracker,
    LocalizeText,
    RemoveLinkEventTracker,
    SendMessageComposer,
} from "../../api";
import {
    Button,
    ButtonGroup,
    Flex,
    NitroCardContentView,
    NitroCardHeaderView,
    NitroCardView,
} from "../../common";
import { useMessageEvent, useRoomEngineEvent } from "../../hooks";
import { FloorplanEditor } from "./common/FloorplanEditor";
import { IFloorplanSettings } from "./common/IFloorplanSettings";
import { IVisualizationSettings } from "./common/IVisualizationSettings";
import {
    convertNumbersForSaving,
    convertSettingToNumber,
} from "./common/Utils";
import { FloorplanEditorContextProvider } from "./FloorplanEditorContext";
import { FloorplanCanvasView } from "./views/FloorplanCanvasView";
import { FloorplanImportExportView } from "./views/FloorplanImportExportView";
import { FloorplanOptionsView } from "./views/FloorplanOptionsView";

/** Small helper toast */
const Toast: FC<{ kind: "ok" | "err"; text: string }> = ({ kind, text }) => (
    <div
        style={{
            position: "fixed",
            left: 16,
            bottom: 86,
            padding: "8px 12px",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 700,
            background:
                kind === "ok"
                    ? "rgba(45,153,72,.95)"
                    : "rgba(186, 44, 44, .95)",
            boxShadow: "0 6px 18px rgba(0,0,0,.35)",
            zIndex: 9999,
        }}
    >
        {text}
    </div>
);

export const FloorplanEditorView: FC<{}> = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [importExportVisible, setImportExportVisible] = useState(false);
    const [toast, setToast] = useState<{
        kind: "ok" | "err";
        text: string;
    } | null>(null);

    const [originalFloorplanSettings, setOriginalFloorplanSettings] =
        useState<IFloorplanSettings>({
            tilemap: "",
            reservedTiles: [],
            entryPoint: [0, 0],
            entryPointDir: 2,
            wallHeight: -1,
            thicknessWall: 1,
            thicknessFloor: 1,
        });

    const [visualizationSettings, setVisualizationSettings] =
        useState<IVisualizationSettings>({
            entryPointDir: 2,
            wallHeight: -1,
            thicknessWall: 1,
            thicknessFloor: 1,
        });

    /** Ensure editor is initialized exactly once when we open the view */
    useEffect(() => {
        try {
            if (!FloorplanEditor.instance) return;
            // Some builds expose a flag; if not, initialize anyway
            // @ts-ignore
            if (!FloorplanEditor.instance.isReady)
                FloorplanEditor.instance.initialize();
        } catch (e) {
            console.warn("[FloorplanEditor] initialize()", e);
            try {
                FloorplanEditor.instance?.initialize();
            } catch {}
        }
    }, [isVisible]);

    /** Close editor if room disposes */
    useRoomEngineEvent<RoomEngineEvent>(RoomEngineEvent.DISPOSED, () =>
        setIsVisible(false)
    );

    /** Load base data */
    useMessageEvent<FloorHeightMapEvent>(FloorHeightMapEvent, (event) => {
        const parser = event.getParser();

        setOriginalFloorplanSettings((prev) => ({
            ...prev,
            tilemap: parser.model,
            wallHeight: (parser.wallHeight ?? -2) + 1, // Nitro sends stored-1; we store human-facing
        }));

        setVisualizationSettings((prev) => ({
            ...prev,
            wallHeight: (parser.wallHeight ?? -2) + 1,
        }));
    });

    useMessageEvent<RoomVisualizationSettingsEvent>(
        RoomVisualizationSettingsEvent,
        (event) => {
            const parser = event.getParser();

            setOriginalFloorplanSettings((prev) => ({
                ...prev,
                thicknessFloor: convertSettingToNumber(parser.thicknessFloor),
                thicknessWall: convertSettingToNumber(parser.thicknessWall),
                entryPointDir: prev.entryPointDir, // unchanged here
            }));

            setVisualizationSettings((prev) => ({
                ...prev,
                thicknessFloor: convertSettingToNumber(parser.thicknessFloor),
                thicknessWall: convertSettingToNumber(parser.thicknessWall),
            }));
        }
    );

    /** Link tracker to open/close */
    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split("/");
                if (parts.length < 2) return;

                switch (parts[1]) {
                    case "show":
                        setIsVisible(true);
                        return;
                    case "hide":
                        setIsVisible(false);
                        return;
                    case "toggle":
                        setIsVisible((prev) => !prev);
                        return;
                }
            },
            eventUrlPrefix: "floor-editor/",
        };

        AddEventLinkTracker(linkTracker);
        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    /** SAVE — now with validation + normalization */
    const saveFloorChanges = () => {
        try {
            // 1) Ensure editor exists
            if (!FloorplanEditor.instance) {
                console.error("[FPE] instance not ready");
                return;
            }

            // 2) Pull current map + normalize to CR-only (server expects \r)
            let tilemap = (
                FloorplanEditor.instance.getCurrentTilemapString() || ""
            )
                .replace(/\r\n/g, "\n") // collapse CRLF
                .replace(/\n/g, "\r"); // LF -> CR

            // remove trailing \r that some generators add
            if (tilemap.endsWith("\r")) tilemap = tilemap.replace(/\r+$/g, "");

            // 3) Door
            const doorX = Number(
                FloorplanEditor.instance.doorLocation?.x ?? -1
            );
            const doorY = Number(
                FloorplanEditor.instance.doorLocation?.y ?? -1
            );

            // 4) Direction + thickness (server expects -2..1)
            const dir = Number(visualizationSettings.entryPointDir ?? 2);
            const thickWall = convertNumbersForSaving(
                visualizationSettings.thicknessWall ?? 1
            );
            const thickFloor = convertNumbersForSaving(
                visualizationSettings.thicknessFloor ?? 1
            );

            // clamp to server range just in case
            const clamp = (v: number) => Math.max(-2, Math.min(1, v));
            const wallSizeWire = clamp(thickWall);
            const floorSizeWire = clamp(thickFloor);

            // 5) Wall height wire value:
            // UI keeps human value; server expects (h-1) or -1 for auto
            const uiWall = Number(visualizationSettings.wallHeight ?? -1);
            const wallHeightWire = uiWall >= 0 ? uiWall - 1 : -1; // <-- never send -2

            // 6) Basic client-side validation to avoid silent drops
            if (!tilemap || !tilemap.length) {
                console.warn("[FPE] Empty tilemap");
                return;
            }
            const rows = tilemap.split("\r");
            const w = rows[0]?.length ?? 0;
            const h = rows.length;
            if (doorX < 0 || doorY < 0 || doorX >= w || doorY >= h) {
                console.warn("[FPE] Door outside map", { doorX, doorY, w, h });
                return;
            }
            if (dir < 0 || dir > 7) {
                console.warn("[FPE] Invalid door direction", dir);
                return;
            }

            // 7) Send composer (matches your server read order)
            SendMessageComposer(
                new UpdateFloorPropertiesMessageComposer(
                    tilemap, // String (CR-separated)
                    doorX, // int
                    doorY, // int
                    dir, // int (0..7)
                    wallSizeWire, // int (-2..1)
                    floorSizeWire, // int (-2..1)
                    wallHeightWire // int (-1..15) with -1 meaning auto
                )
            );

            console.debug("[FPE] Save sent", {
                doorX,
                doorY,
                dir,
                wallSizeWire,
                floorSizeWire,
                wallHeightWire,
                rows: h,
                cols: w,
                len: tilemap.length,
            });
        } catch (e) {
            console.error("[FPE] Save error", e);
        }
    };

    const revertChanges = () => {
        setVisualizationSettings({
            wallHeight: originalFloorplanSettings.wallHeight,
            thicknessWall: originalFloorplanSettings.thicknessWall,
            thicknessFloor: originalFloorplanSettings.thicknessFloor,
            entryPointDir: originalFloorplanSettings.entryPointDir,
        });

        if (FloorplanEditor.instance) {
            FloorplanEditor.instance.doorLocation = new NitroPoint(
                originalFloorplanSettings.entryPoint[0],
                originalFloorplanSettings.entryPoint[1]
            );
            FloorplanEditor.instance.setTilemap(
                originalFloorplanSettings.tilemap,
                originalFloorplanSettings.reservedTiles
            );
            FloorplanEditor.instance.renderTiles();
        }
    };

    return (
        <FloorplanEditorContextProvider
            value={{
                originalFloorplanSettings,
                setOriginalFloorplanSettings,
                visualizationSettings,
                setVisualizationSettings,
            }}
        >
            {isVisible && (
                <NitroCardView
                    uniqueKey="floorplan-editor"
                    className="nitro-floorplan-editor"
                    theme="primary-slim"
                >
                    <NitroCardHeaderView
                        headerText={LocalizeText("floor.plan.editor.title")}
                        onCloseClick={() => setIsVisible(false)}
                    />
                    <NitroCardContentView overflow="hidden">
                        <FloorplanOptionsView />
                        <FloorplanCanvasView overflow="hidden" />
                        <Flex justifyContent="between">
                            <Button onClick={revertChanges}>
                                {LocalizeText("floor.plan.editor.reload")}
                            </Button>
                            <ButtonGroup>
                                <Button disabled>
                                    {LocalizeText("floor.plan.editor.preview")}
                                </Button>
                                <Button
                                    onClick={() => setImportExportVisible(true)}
                                >
                                    {LocalizeText(
                                        "floor.plan.editor.import.export"
                                    )}
                                </Button>
                                <Button onClick={saveFloorChanges}>
                                    {LocalizeText("floor.plan.editor.save")}
                                </Button>
                            </ButtonGroup>
                        </Flex>
                    </NitroCardContentView>
                </NitroCardView>
            )}

            {importExportVisible && (
                <FloorplanImportExportView
                    onCloseClick={() => setImportExportVisible(false)}
                />
            )}

            {toast && <Toast kind={toast.kind} text={toast.text} />}
        </FloorplanEditorContextProvider>
    );
};
