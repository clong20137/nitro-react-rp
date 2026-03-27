import { RoomObjectCategory } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useState } from "react";
import { GetFurnitureDataForRoomObject, GetRoomEngine } from "../../api";
import { useRoom } from "../../hooks";
import { ObjectLocationView } from "../room/widgets/object-location/ObjectLocationView";
import atmIcon from "../../icons/purse.png";
import infoIcon from "../../icons/info.png";
import "./InteractiveFurnitureIconsOverlay.scss";

type InteractiveFurnitureIconVariant = "icon" | "stock-pill";

type InteractiveFurnitureIconConfig = {
    key: string;
    icon?: string;
    label: string;
    keywords: string[];
    variant?: InteractiveFurnitureIconVariant;
    corporationName?: string;
};

type InteractiveFurnitureIconEntry = {
    objectId: number;
    key: string;
    icon?: string;
    label: string;
    isVisible: boolean;
    variant: InteractiveFurnitureIconVariant;
    stockAmount?: number;
    corporationName?: string;
};

type CorporationCacheRow = {
    id: number;
    name: string;
    stock?: number;
};

const ICON_CONFIGS: InteractiveFurnitureIconConfig[] = [
    {
        key: "atm",
        icon: atmIcon,
        label: "ATM",
        keywords: ["atm", "cash_machine", "bank_machine", "bank atm"],
        variant: "icon",
    },
    {
        key: "laptop",
        icon: infoIcon,
        label: "Info",
        keywords: ["laptop"],
        variant: "icon",
    },
    {
        key: "pizza-stock",
        label: "Pizza Stock",
        keywords: ["opti_pizza_name", "pizza corporation", "pizza"],
        variant: "stock-pill",
        corporationName: "pizza",
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

const findCorporationByName = (name?: string): CorporationCacheRow | null => {
    if (!name) return null;

    const corporations = ((window as any).__olrpCache?.corporations ??
        []) as CorporationCacheRow[];

    const loweredName = name.trim().toLowerCase();

    return (
        corporations.find((corp) =>
            String(corp.name || "")
                .toLowerCase()
                .includes(loweredName),
        ) ?? null
    );
};

const getInitialStockForConfig = (config: InteractiveFurnitureIconConfig) => {
    if (!config.corporationName) return undefined;

    const corp = findCorporationByName(config.corporationName);

    if (!corp) return 0;

    return typeof corp.stock === "number" ? corp.stock : 0;
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
                    variant: config.variant ?? "icon",
                    stockAmount:
                        config.variant === "stock-pill"
                            ? getInitialStockForConfig(config)
                            : undefined,
                    corporationName: config.corporationName,
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
                        stockAmount:
                            entry.variant === "stock-pill"
                                ? (existing?.stockAmount ??
                                  entry.stockAmount ??
                                  0)
                                : undefined,
                        isVisible: true,
                    });

                    if (existing && !existing.isVisible) {
                        nextMap.set(entry.key, {
                            ...entry,
                            stockAmount:
                                entry.variant === "stock-pill"
                                    ? (existing?.stockAmount ??
                                      entry.stockAmount ??
                                      0)
                                    : undefined,
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

    useEffect(() => {
        const updatePizzaStock = (nextStock: number) => {
            setEntries((prev) =>
                prev.map((entry) => {
                    if (
                        entry.variant !== "stock-pill" ||
                        entry.corporationName !== "pizza"
                    ) {
                        return entry;
                    }

                    if (entry.stockAmount === nextStock) return entry;

                    return {
                        ...entry,
                        stockAmount: Math.max(0, nextStock),
                    };
                }),
            );
        };

        const onCorporationStockUpdate = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail || {};
            const corporationName = String(
                detail.corporationName ?? detail.name ?? "",
            ).toLowerCase();
            const corporationId = Number(
                detail.corporationId ?? detail.id ?? 0,
            );

            let isPizza = corporationName.includes("pizza");

            if (!isPizza && corporationId > 0) {
                const cached = ((window as any).__olrpCache?.corporations ??
                    []) as CorporationCacheRow[];

                const corp = cached.find(
                    (row) => Number(row.id) === corporationId,
                );

                if (corp) {
                    isPizza = String(corp.name || "")
                        .toLowerCase()
                        .includes("pizza");
                }
            }

            if (!isPizza) return;

            if (typeof detail.stock === "number") {
                updatePizzaStock(detail.stock);
                return;
            }

            if (typeof detail.delta === "number") {
                setEntries((prev) =>
                    prev.map((entry) => {
                        if (
                            entry.variant !== "stock-pill" ||
                            entry.corporationName !== "pizza"
                        ) {
                            return entry;
                        }

                        const currentStock =
                            typeof entry.stockAmount === "number"
                                ? entry.stockAmount
                                : 0;

                        return {
                            ...entry,
                            stockAmount: Math.max(
                                0,
                                currentStock + Number(detail.delta),
                            ),
                        };
                    }),
                );
            }
        };

        const onCorporationsStockBulk = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail || {};
            const updates: any[] = Array.isArray(detail)
                ? detail
                : Array.isArray(detail.updates)
                  ? detail.updates
                  : [];

            if (!updates.length) return;

            const cached = ((window as any).__olrpCache?.corporations ??
                []) as CorporationCacheRow[];

            for (const row of updates) {
                const rowName = String(
                    row.corporationName ?? row.name ?? "",
                ).toLowerCase();
                const rowId = Number(row.corporationId ?? row.id ?? 0);

                let isPizza = rowName.includes("pizza");

                if (!isPizza && rowId > 0) {
                    const corp = cached.find(
                        (item) => Number(item.id) === rowId,
                    );

                    if (corp) {
                        isPizza = String(corp.name || "")
                            .toLowerCase()
                            .includes("pizza");
                    }
                }

                if (!isPizza) continue;
                if (typeof row.stock !== "number") continue;

                updatePizzaStock(row.stock);
                break;
            }
        };

        const onDirectPizzaStockUpdate = (ev: Event) => {
            const detail: any = (ev as CustomEvent).detail || {};
            const stock = Number(detail.stock);

            if (!Number.isFinite(stock)) return;

            updatePizzaStock(stock);
        };

        window.addEventListener(
            "corporation_stock_update",
            onCorporationStockUpdate as EventListener,
        );
        document.addEventListener(
            "corporation_stock_update",
            onCorporationStockUpdate as EventListener,
        );

        window.addEventListener(
            "corporations_stock_bulk",
            onCorporationsStockBulk as EventListener,
        );
        document.addEventListener(
            "corporations_stock_bulk",
            onCorporationsStockBulk as EventListener,
        );

        window.addEventListener(
            "pizza_corporation_stock_update",
            onDirectPizzaStockUpdate as EventListener,
        );
        document.addEventListener(
            "pizza_corporation_stock_update",
            onDirectPizzaStockUpdate as EventListener,
        );

        return () => {
            window.removeEventListener(
                "corporation_stock_update",
                onCorporationStockUpdate as EventListener,
            );
            document.removeEventListener(
                "corporation_stock_update",
                onCorporationStockUpdate as EventListener,
            );

            window.removeEventListener(
                "corporations_stock_bulk",
                onCorporationsStockBulk as EventListener,
            );
            document.removeEventListener(
                "corporations_stock_bulk",
                onCorporationsStockBulk as EventListener,
            );

            window.removeEventListener(
                "pizza_corporation_stock_update",
                onDirectPizzaStockUpdate as EventListener,
            );
            document.removeEventListener(
                "pizza_corporation_stock_update",
                onDirectPizzaStockUpdate as EventListener,
            );
        };
    }, []);

    const content = useMemo(() => {
        if (!entries.length) return null;

        return entries.map((entry) => (
            <ObjectLocationView
                key={entry.key}
                objectId={entry.objectId}
                category={RoomObjectCategory.FLOOR}
                className={`interactive-furniture-icon-anchor ${
                    entry.isVisible ? "is-visible" : "is-hidden"
                } ${entry.variant === "stock-pill" ? "is-stock-pill" : ""}`}
                noFollow={false}
            >
                {entry.variant === "stock-pill" ? (
                    <div
                        className="interactive-furniture-stock-pill"
                        title={`${entry.label}: ${entry.stockAmount ?? 0}`}
                    >
                        <span className="interactive-furniture-stock-pill-label">
                            PIZZA
                        </span>
                        <span className="interactive-furniture-stock-pill-value">
                            {entry.stockAmount ?? 0}
                        </span>
                    </div>
                ) : (
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
                )}
            </ObjectLocationView>
        ));
    }, [entries]);

    if (!roomSession) return null;

    return <>{content}</>;
};

export default InteractiveFurnitureIconsOverlay;
