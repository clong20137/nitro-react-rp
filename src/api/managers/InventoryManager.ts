// src/managers/InventoryManager.ts
import { InventoryContext } from '../contexts/inventory/InventoryContext';

let inventorySetter: ((items: InventoryContext[]) => void) | null = null;

export const registerInventorySetter = (setter: (items: InventoryContext[]) => void) => {
    inventorySetter = setter;
};

export const updateInventory = (items: InventoryContext[]) => {
    if (inventorySetter) {
        inventorySetter(items);
    }
};