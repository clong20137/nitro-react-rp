import { FC, useEffect, useRef, useState } from "react";
import "./SellModuleView.scss";
import { SellItemComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/SellItemComposer";
import { SendMessageComposer } from "../../api";
import { RequestInventoryItemsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestInventoryItemsComposer";
import { ItemDataStructure } from "@nitrots/nitro-renderer";

interface ExtendedInventoryItem {
    id: number; // inventory_items.id — this is the key you need
    item_id: number; // from item_definitions
    name: string;
    icon_path: string;
    quantity: number;
    type: "item" | "crop" | "food";
}

export const SellModuleView: FC = () => {
    const [visible, setVisible] = useState(false);
    const [inventory, setInventory] = useState<ExtendedInventoryItem[]>([]);

    const [position, setPosition] = useState<{ x: number; y: number }>(() =>
        JSON.parse(
            localStorage.getItem("sell-module-pos") || '{"x":100,"y":100}'
        )
    );
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    useEffect(() => {
        const openHandler = () => setVisible(true);
        window.addEventListener("open_sell_module", openHandler);
        return () =>
            window.removeEventListener("open_sell_module", openHandler);
    }, []);

    useEffect(() => {
        if (!visible) return;
        SendMessageComposer(new RequestInventoryItemsComposer());
    }, [visible]);

    useEffect(() => {
        const InventoryStore =
            require("@nitrots/nitro-renderer/src/nitro/communication/messages/parser/roleplay/InventoryStore").InventoryStore;

        const handleInventoryUpdate = () => {
            setInventory(InventoryStore.getItems());
        };

        window.addEventListener("inventory_update", handleInventoryUpdate);
        handleInventoryUpdate();
        return () =>
            window.removeEventListener(
                "inventory_update",
                handleInventoryUpdate
            );
    }, []);

    const handleSellAll = (item: ExtendedInventoryItem) => {
        if (!item || item.quantity <= 0) return;
        SendMessageComposer(new SellItemComposer(item.id, item.quantity));
        // Let the server respond with updated inventory — no manual state change
    };

    const handleSell = (item: ExtendedInventoryItem) => {
        if (!item || item.quantity <= 0) return;
        SendMessageComposer(new SellItemComposer(item.id, 1));
        // No setInventory here either
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    };
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        if (visible) {
            // Wait for next tick to trigger transition
            requestAnimationFrame(() => setAnimateIn(true));
        } else {
            setAnimateIn(false);
        }
    }, [visible]);
    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newPos = {
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y,
        };
        setPosition(newPos);
        localStorage.setItem("sell-module-pos", JSON.stringify(newPos));
    };

    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    if (!visible) return null;

    return (
        <div className={`sell-module ${animateIn ? "pop-in" : ""}`}>
            <div className="sell-header" onMouseDown={handleMouseDown}>
                <h4>Sell Items</h4>
                <button className="close-btn" onClick={() => setVisible(false)}>
                    ✖
                </button>
            </div>

            <div className="sell-content">
                <div className="sell-list">
                    {inventory
                        .filter(
                            (item) => item.item_id === 11 || item.item_id === 14
                        ) // Only show crops
                        .map((item) => (
                            <div key={item.item_id} className="sell-item-row">
                                <img
                                    src={item.icon_path}
                                    alt={item.name}
                                    className="sell-item-icon"
                                />
                                <div className="sell-item-info">
                                    <strong>{item.name}</strong>
                                    <p>Quantity: {item.quantity}</p>
                                </div>
                                <div className="sell-item-action">
                                    <button
                                        className="habbo-action-button green"
                                        disabled={item.quantity <= 0}
                                        onClick={() => handleSell(item)}
                                    >
                                        Sell
                                    </button>
                                    
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};
