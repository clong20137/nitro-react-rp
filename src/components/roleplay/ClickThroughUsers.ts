// src/roleplay/ct/ClickThroughUsers.ts
/* Lightweight bridge for "click through users" mode.
- Persists state to localStorage
- Exposes window helpers for UI/packets to toggle
- Emits a DOM event when the state changes so any view can react
*/

const LS_KEY = 'clickThroughUsersEnabled';

/** Safe bool read from localStorage */
function readBool(key: string, fallback = false): boolean {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const v = JSON.parse(raw);
        return typeof v === 'boolean' ? v : !!v;
    } catch {
        return fallback;
    }
}

/** Write + notify other tabs */
function writeBool(key: string, val: boolean) {
    try {
        localStorage.setItem(key, JSON.stringify(!!val));
    } catch {
        /* noop */
    }
}

/** Initialize window bridge once */
export function initClickThroughUsers(): void {
    // Avoid duplicate setup
    if (typeof window.isClickThroughUsers === 'function') return;

    let enabled = readBool(LS_KEY, false);

    const set = (on: boolean) => {
        enabled = !!on;
        writeBool(LS_KEY, enabled);
        console.log('initclickthroughusers() from Clickthroughusers.ts');
        // Notify listeners inside this tab
        window.dispatchEvent(
            new CustomEvent('clickThroughUsersChanged', { detail: { enabled } })
            
        );
    };

    const get = () => !!enabled;

    // Expose tiny API
    Object.defineProperties(window, {
        setClickThroughUsers: {
            value: set,
            writable: false,
            configurable: false,
            enumerable: false,
        },
        isClickThroughUsers: {
            value: get,
            writable: false,
            configurable: false,
            enumerable: false,
        },
    });

    // Optional: allow toggling via a cross-app event
    // Example usage from anywhere: window.dispatchEvent(new CustomEvent('ct_toggle',{detail:{enabled:true}}))
    window.addEventListener('ct_toggle', (e: Event) => {
        const det = (e as CustomEvent)?.detail;
        if (det && typeof det.enabled === 'boolean') set(!!det.enabled);
    });

    // Keep in sync if another tab changes it
    window.addEventListener('storage', (ev: StorageEvent) => {
        if (ev.key !== LS_KEY) return;
        const next = readBool(LS_KEY, false);
        if (next !== enabled) set(next);
    });

    // Fire an initial event so views can read immediate state if they want
    window.dispatchEvent(
        new CustomEvent('clickThroughUsersChanged', { detail: { enabled } })
    );
}

// Type augmentations for TS consumers that refer to the helpers
declare global {
    interface Window {
        setClickThroughUsers?: (on: boolean) => void;
        isClickThroughUsers?: () => boolean;
    }
}
