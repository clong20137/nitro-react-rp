const THEME_KEY = "olrp.theme.primary";
const DEFAULT_PRIMARY = "#0d6091";

const clamp = (value: number) => Math.max(0, Math.min(255, value));

const normalizeHex = (value: string) => {
    if (!value) return DEFAULT_PRIMARY;

    let hex = value.trim();

    if (!hex.startsWith("#")) hex = `#${hex}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return DEFAULT_PRIMARY;

    return hex.toLowerCase();
};

const shiftColor = (hex: string, amount: number) => {
    const value = normalizeHex(hex).slice(1);
    const r = clamp(parseInt(value.slice(0, 2), 16) + amount);
    const g = clamp(parseInt(value.slice(2, 4), 16) + amount);
    const b = clamp(parseInt(value.slice(4, 6), 16) + amount);

    return `#${[r, g, b].map(part => part.toString(16).padStart(2, "0")).join("")}`;
};

export const getStoredRoleplayTheme = () =>
    normalizeHex(localStorage.getItem(THEME_KEY) || DEFAULT_PRIMARY);

export const applyRoleplayTheme = (primary: string) => {
    const normalized = normalizeHex(primary);
    const root = document.documentElement;
    const lighterBorder = shiftColor(normalized, 24);
    const darker = shiftColor(normalized, -18);
    const lighter = shiftColor(normalized, 18);
    const panel = shiftColor(normalized, -30);
    const activeTop = shiftColor(normalized, 12);
    const activeBottom = shiftColor(normalized, -6);
    const aggressionBg = shiftColor(normalized, 34);
    const skillFill = normalized;
    const skillBorder = shiftColor(normalized, 42);

    root.style.setProperty("--rp-primary", normalized);
    root.style.setProperty("--rp-primary-border", lighterBorder);
    root.style.setProperty("--rp-primary-dark", darker);
    root.style.setProperty("--rp-primary-light", lighter);
    root.style.setProperty("--rp-panel", panel);
    root.style.setProperty("--rp-tab-top", normalized);
    root.style.setProperty("--rp-tab-bottom", darker);
    root.style.setProperty("--rp-tab-active", lighter);
    root.style.setProperty("--rp-tab-active-top", activeTop);
    root.style.setProperty("--rp-tab-active-bottom", activeBottom);
    root.style.setProperty("--rp-skill-fill", skillFill);
    root.style.setProperty("--rp-skill-border", skillBorder);
    root.style.setProperty("--rp-aggression-bg", aggressionBg);

    return normalized;
};

export const saveRoleplayTheme = (primary: string) => {
    const normalized = applyRoleplayTheme(primary);
    localStorage.setItem(THEME_KEY, normalized);
    return normalized;
};

export const applyStoredRoleplayTheme = () =>
    applyRoleplayTheme(getStoredRoleplayTheme());
