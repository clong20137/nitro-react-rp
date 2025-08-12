import React, { createContext, useContext, useEffect, useState } from "react";

interface PreloadContextType {
    user: any;
    corporations: any[];
    inventory: any[];
    refresh: () => void;
}

const PreloadContext = createContext<PreloadContextType | undefined>(undefined);

export const PreloadProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<any>(null);
    const [corporations, setCorporations] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const safeJson = async (res: Response) => {
        try {
            return await res.json();
        } catch {
            console.error("JSON parse failed, got", await res.text());
            return {};
        }
    };
    const refresh = async () => {
        try {
            const userRes = await fetch("/api/user").then((res) => res.json());
            const username = userRes?.user?.username;

            if (!username) {
                console.warn("No username found in userRes", userRes);
                return;
            }

            setUser(userRes.user);

            const [corpRes, invRes] = await Promise.all([
                fetch("/api/corporations").then((res) => res.json()),
                fetch(`/api/inventory/${username}`).then((res) => res.json()),
            ]);

            setCorporations(corpRes?.corporations || []);
            setInventory(invRes?.data || []); // ✅ correctly accessing inventory data

            console.log("Inventory preloaded", invRes?.data);
        } catch (err) {
            console.error("Error loading preload data", err);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    return (
        <PreloadContext.Provider
            value={{ user, corporations, inventory, refresh }}
        >
            {children}
        </PreloadContext.Provider>
    );
};

export const usePreload = () => {
    const ctx = useContext(PreloadContext);
    if (!ctx)
        throw new Error("usePreload must be used within a PreloadProvider");
    return ctx;
};
