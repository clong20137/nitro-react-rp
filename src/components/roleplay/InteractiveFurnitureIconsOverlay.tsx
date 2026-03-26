import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useState } from "react";
import { GetFurnitureDataForRoomObject, GetRoomEngine } from "../../api";
import { useRoom } from "../../hooks";
import { ObjectLocationView } from "../room/widgets/object-location/ObjectLocationView";
import atmIcon from "../../icons/purse.png";
import infoIcon from "../../icons/info.png";
import "./InteractiveFurnitureIconsOverlay.scss";

type InteractiveFurnitureIconConfig = {
    key: string;
    icon: string;
    label: string;
    keywords: string[];
};

type InteractiveFurnitureIconEntry = {
    objectId: number;
    key: string;
    icon: string;
    label: string;
    isVisible: boolean;
};

const ICON_CONFIGS: InteractiveFurnitureIconConfig[] = [
    {
        key: "atm",
        icon: atmIcon,
        label: "ATM",
        keywords: ["atm", "cash_machine", "bank_machine", "bank atm"],
    },
    {
        key: "laptop",
        icon: infoIcon,
        label: "Info",
        keywords: ["laptop"],
    },
];

const FADE_OUT_DELAY = 220;

const getFurnitureSearchValue = (roomId: number, objectId: number) => {
    const furnitureData = GetFurnitureDataForRoomObject(
        roomId,
        objectId,
        RoomObjectCategory.FLOOR,
    );

    if (!furnitureData) return "";

    return [
        furnitureData.className,
        furnitureData.fullName,
        furnitureData.name,
        furnitureData.description,
    ]
        .filter((value) => !!value)
        .join(" ")
        .toLowerCase();
};

const getMatchingConfig = (searchValue: string) => {
    return ICON_CONFIGS.find((config) =>
        config.keywords.some((keyword) => searchValue.includes(keyword)),
    );
};

export const InteractiveFurnitureIconsOverlay: FC = () => {
    const { roomSession = null } = useRoom();
    const [entries, setEntries] = useState<InteractiveFurnitureIconEntry[]>([]);

    useEffect(() => {
        if (!roomSession) {
            setEntries([]);
            return;
        }

        let isDisposed = false;
        const removalTimeouts = new Map<string, number>();

        const refreshEntries = () => {
            const roomObjects =
                GetRoomEngine().getRoomObjects(
                    roomSession.roomId,
                    RoomObjectCategory.FLOOR,
                ) || [];
            const detectedEntries: InteractiveFurnitureIconEntry[] = [];

            for (const roomObject of roomObjects) {
                if (!roomObject) continue;

                const searchValue = getFurnitureSearchValue(
                    roomSession.roomId,
                    roomObject.id,
                );
                const config = getMatchingConfig(searchValue);

                if (!config) continue;

                detectedEntries.push({
                    objectId: roomObject.id,
                    key: `${config.key}-${roomObject.id}`,
                    icon: config.icon,
                    label: config.label,
                    isVisible: true,
                });
            }

            if (isDisposed) return;

            setEntries((prevEntries) => {
                const nextMap = new Map<
                    string,
                    InteractiveFurnitureIconEntry
                >();
                const detectedKeys = new Set(
                    detectedEntries.map((entry) => entry.key),
                );

                for (const entry of detectedEntries) {
                    const existing = prevEntries.find(
                        (prev) => prev.key === entry.key,
                    );

                    if (removalTimeouts.has(entry.key)) {
                        window.clearTimeout(removalTimeouts.get(entry.key));
                        removalTimeouts.delete(entry.key);
                    }

                    nextMap.set(entry.key, {
                        ...entry,
                        isVisible: true,
                    });

                    if (existing && !existing.isVisible) {
                        nextMap.set(entry.key, {
                            ...entry,
                            isVisible: true,
                        });
                    }
                }

                for (const prevEntry of prevEntries) {
                    if (detectedKeys.has(prevEntry.key)) continue;

                    if (!nextMap.has(prevEntry.key)) {
                        nextMap.set(prevEntry.key, {
                            ...prevEntry,
                            isVisible: false,
                        });
                    }

                    if (!removalTimeouts.has(prevEntry.key)) {
                        const timeout = window.setTimeout(() => {
                            setEntries((current) =>
                                current.filter(
                                    (entry) => entry.key !== prevEntry.key,
                                ),
                            );
                            removalTimeouts.delete(prevEntry.key);
                        }, FADE_OUT_DELAY);

                        removalTimeouts.set(prevEntry.key, timeout);
                    }
                }

                return Array.from(nextMap.values());
            });
        };

        refreshEntries();

        const interval = window.setInterval(refreshEntries, 1000);

        return () => {
            isDisposed = true;
            window.clearInterval(interval);

            for (const timeout of removalTimeouts.values()) {
                window.clearTimeout(timeout);
            }

            removalTimeouts.clear();
        };
    }, [roomSession]);

    const content = useMemo(() => {
        if (!entries.length) return null;

        return entries.map((entry) => (
            <ObjectLocationView
                key={entry.key}
                objectId={entry.objectId}
                category={RoomObjectCategory.FLOOR}
                className={`interactive-furniture-icon-anchor ${entry.isVisible ? "is-visible" : "is-hidden"}`}
                noFollow={false}
            >
                <div
                    className="interactive-furniture-icon-badge"
                    title={entry.label}
                >
                    <div className="interactive-furniture-icon-pulse-ring"></div>
                    <div className="interactive-furniture-icon-pulse-ring interactive-furniture-icon-pulse-ring-secondary"></div>
                    <img
                        className="interactive-furniture-icon-image"
                        src={entry.icon}
                        alt={entry.label}
                    />
                </div>
            </ObjectLocationView>
        ));
    }, [entries]);

    if (!roomSession) return null;

    return <>{content}</>;
};

export default InteractiveFurnitureIconsOverlay;
