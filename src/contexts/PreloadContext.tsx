import React, { createContext, useContext, useEffect, useState } from "react";

interface PreloadContextType {
    user: any;
    corporations: any[];
    refresh: () => Promise<void>;
}

const PreloadContext = createContext<PreloadContextType | undefined>(undefined);

export const PreloadProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<any>(null);
    const [corporations, setCorporations] = useState<any[]>([]);

    const safeJson = async (res: Response) => {
        const text = await res.text();

        if (!text) return {};

        try {
            return JSON.parse(text);
        } catch {
            console.error("JSON parse failed, got", text);
            return {};
        }
    };

    const refresh = async (): Promise<void> => {
        try {
            const userResponse = await fetch("/api/user");

            if (!userResponse.ok) {
                throw new Error(
                    `/api/user failed with status ${userResponse.status}`
                );
            }

            const userRes = await safeJson(userResponse);
            const userData = userRes?.user ?? null;
            const username = userData?.username;

            if (!username) {
                console.warn("No username found in userRes", userRes);
                setUser(null);
                setCorporations([]);
                return;
            }

            setUser(userData);

            const corpResponse = await fetch("/api/corporations");

            if (!corpResponse.ok) {
                throw new Error(
                    `/api/corporations failed with status ${corpResponse.status}`
                );
            }

            const corpRes = await safeJson(corpResponse);
            setCorporations(
                Array.isArray(corpRes?.corporations) ? corpRes.corporations : []
            );
        } catch (err) {
            console.error("Error loading preload data", err);
            setUser(null);
            setCorporations([]);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    return (
        <PreloadContext.Provider value={{ user, corporations, refresh }}>
            {children}
        </PreloadContext.Provider>
    );
};

export const usePreload = () => {
    const ctx = useContext(PreloadContext);

    if (!ctx) {
        throw new Error("usePreload must be used within a PreloadProvider");
    }

    return ctx;
};
