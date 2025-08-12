import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    Dispatch,
    SetStateAction,
} from "react";
import { registerInventorySetter } from "../../managers/InventoryManager";

export type InventoryContext = {
    id: number;
    item_id: number;
    user_id: number;
    quantity: number;
    durability: number | null;
    slot: number;
    last_used_at: string | null;
    name: string;
    description: string;
    item_type: "weapon" | "shield" | "potion" | "food" | "drink" | "tool";
    cooldown_seconds?: number;
    damage_increase?: number | null;
    health_increase?: number | null;
    durability_max?: number | null;
    rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
    icon_path: string;
    max_stack: number;
    created_at: number;
    stats?: {
        healing?: number;
        damage?: number;
        defense?: number;
    };
};

type InventoryContextType = {
    items: InventoryContext[];
    setItems: Dispatch<SetStateAction<InventoryContext[]>>;
    updateSlot: (item: InventoryContext, newSlot: number) => Promise<void>;
    useItem: (item: InventoryContext, index: number) => Promise<void>;
};

const InventoryReactContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventory = (): InventoryContextType => {
    const context = useContext(InventoryReactContext);
    if (!context) {
        throw new Error("useInventory must be used within an InventoryProvider");
    }
    return context;
};

interface InventoryProviderProps {
    children: ReactNode;
}

export const InventoryProvider = ({ children }: InventoryProviderProps) => {
    const [items, setItems] = useState<InventoryContext[]>([]);

    useEffect(() => {
        registerInventorySetter(setItems); // This will be triggered by NitroCommunicationDemo
    }, []);

    const updateSlot = async (item: InventoryContext, newSlot: number): Promise<void> => {
        try {
            await fetch("/api/inventory/update-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    item_id: item.id,
                    new_slot: newSlot,
                    user_id: item.user_id,
                }),
            });
        } catch (err) {
            console.error("Failed to update slot", err);
        }
    };

    const useItem = async (item: InventoryContext, index: number): Promise<void> => {
        if (!item || item.quantity <= 0) return;

        try {
            const res = await fetch(`/api/inventory/use/${item.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            });

            const result = await res.json();

            if (!res.ok) {
                const msg =
                    result.remaining_seconds !== undefined
                        ? `${item.name} is on cooldown. Try again in ${result.remaining_seconds}s.`
                        : result.error || "Failed to use item.";
                window.postMessage({ type: "sendWhisper", content: msg }, "*");
                return;
            }

            window.postMessage(
                {
                    type: "sendWhisper",
                    content: result.message || `You used ${item.name}.`,
                },
                "*"
            );

            setItems((prevItems) => {
                const newItems = [...prevItems];
                const updatedItem = { ...newItems[index] };
                updatedItem.quantity -= 1;
                updatedItem.last_used_at = new Date().toISOString();
                newItems[index] =
                    updatedItem.quantity > 0 ? updatedItem : (undefined as any);
                return newItems.filter(Boolean); // remove empty
            });
        } catch (err) {
            console.error("Error using item:", err);
            window.postMessage(
                {
                    type: "sendWhisper",
                    content: "There was an error using the item.",
                },
                "*"
            );
        }
    };

    return (
        <InventoryReactContext.Provider value={{ items, setItems, updateSlot, useItem }}>
            {children}
        </InventoryReactContext.Provider>
    );
};