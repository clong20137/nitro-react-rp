import React, {
    FC,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import ReactDOM from "react-dom";
import "./OnboardingOverlay.scss";

/** -----------------------------------------------------------------------
 * Global registry so components can “announce” their anchor nodes
 * (e.g., StatsBar can bind the Stats step exactly)
 * --------------------------------------------------------------------- */
type GuideRegistry = Map<string, HTMLElement>;
const guideRegistry: GuideRegistry = new Map();

/** Hook: attach a DOM element to a named guide anchor */
export function useGuideAnchor(name: string, el: HTMLElement | null) {
    useEffect(() => {
        if (!name) return;
        if (el) guideRegistry.set(name, el);
        return () => {
            if (el && guideRegistry.get(name) === el)
                guideRegistry.delete(name);
        };
    }, [name, el]);
}

/** Hook: register a reliable selector under a name (fallback for query) */
export function useExposeGuideSelector(name: string, selector: string) {
    useEffect(() => {
        (window as any).__guideSelectors =
            (window as any).__guideSelectors || {};
        (window as any).__guideSelectors[name] = selector;
        return () => {
            if ((window as any).__guideSelectors?.[name] === selector) {
                delete (window as any).__guideSelectors[name];
            }
        };
    }, [name, selector]);
}

/* Persistent flags */
const KEY_WELCOME_SEEN = "rp_onboarding_welcome_seen_v1";
const KEY_GUIDE_DONE = "rp_onboarding_quickguide_done_v1";

type Step = {
    id: string;
    /** list of selectors to try (first match wins) OR a registry name like 'reg:stats' */
    targets: string[];
    title: string;
    body: string;
    padding?: number;
    placement?: "right" | "left" | "top" | "bottom" | "auto";
    arrow?: "right" | "left" | "top" | "bottom";
};

const q = (sel: string): HTMLElement | null =>
    document.querySelector(sel) as HTMLElement | null;

const fromRegistry = (key: string): HTMLElement | null =>
    guideRegistry.get(key) || null;

/** Try a list of selectors and registry refs until something exists */
const resolveTarget = (targets: string[]): HTMLElement | null => {
    for (const t of targets) {
        if (t.startsWith("reg:")) {
            const el = fromRegistry(t.slice(4));
            if (el) return el;
            // also allow a “published selector” for the same name from window
            const pubSel = (window as any).__guideSelectors?.[t.slice(4)];
            if (pubSel) {
                const el2 = q(pubSel);
                if (el2) return el2;
            }
        } else {
            const el = q(t);
            if (el) return el;
        }
    }
    return null;
};

const useRectOf = (targets: string[]) => {
    const [rect, setRect] = useState<DOMRect | null>(null);
    const update = () => {
        const node = resolveTarget(targets);
        if (!node) return setRect(null);
        const r = node.getBoundingClientRect();
        setRect(r);
    };
    useLayoutEffect(() => {
        update();
        const on = () => update();
        window.addEventListener("resize", on);
        window.addEventListener("scroll", on, true);
        const id = setInterval(update, 250);
        return () => {
            window.removeEventListener("resize", on);
            window.removeEventListener("scroll", on, true);
            clearInterval(id);
        };
    }, [targets.join("|")]);
    return rect;
};

/* add/remove pulsing class on the currently spotlighted element */
const setPulseOn = (el: HTMLElement | null) => {
    document
        .querySelectorAll(".ob-pulse-target")
        .forEach((n) => n.classList.remove("ob-pulse-target"));
    if (el) el.classList.add("ob-pulse-target");
};

const CoachCard: FC<{
    title: string;
    body: string;
    onNext: () => void;
    onPrev?: () => void;
    onSkip?: () => void;
    showPrev?: boolean;
    showSkip?: boolean;
    anchorRect?: DOMRect | null;
    placement?: Step["placement"];
    arrow?: Step["arrow"];
}> = ({
    title,
    body,
    onNext,
    onPrev,
    onSkip,
    showPrev,
    showSkip,
    anchorRect,
    placement = "auto",
    arrow,
}) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const [placeClass, setPlaceClass] = useState<string>("");

    useLayoutEffect(() => {
        const c = cardRef.current;
        if (!c) return;

        const vp = 10;
        const cr = c.getBoundingClientRect();
        let left = (window.innerWidth - cr.width) / 2;
        let top = (window.innerHeight - cr.height) / 2;
        let chosen: "right" | "left" | "top" | "bottom" = "top";

        if (anchorRect) {
            const spaceRight = window.innerWidth - (anchorRect.right + vp);
            const spaceLeft = anchorRect.left - vp;
            const spaceTop = anchorRect.top - vp;
            const spaceBottom = window.innerHeight - (anchorRect.bottom + vp);

            chosen =
                placement !== "auto"
                    ? (placement as any)
                    : spaceRight > cr.width
                    ? "right"
                    : spaceLeft > cr.width
                    ? "left"
                    : spaceBottom > cr.height
                    ? "bottom"
                    : "top";

            if (chosen === "right") {
                left = anchorRect.right + vp;
                top = Math.max(vp, anchorRect.top);
            } else if (chosen === "left") {
                left = Math.max(vp, anchorRect.left - cr.width - vp);
                top = Math.max(vp, anchorRect.top);
            } else if (chosen === "bottom") {
                left = Math.min(
                    Math.max(vp, anchorRect.left),
                    window.innerWidth - cr.width - vp
                );
                top = anchorRect.bottom + vp;
            } else {
                left = Math.min(
                    Math.max(vp, anchorRect.left),
                    window.innerWidth - cr.width - vp
                );
                top = Math.max(vp, anchorRect.top - cr.height - vp);
            }
        }

        setStyle({ left: Math.round(left), top: Math.round(top) });
        setPlaceClass(`place-${arrow || chosen}`);
    }, [anchorRect, placement, arrow]);

    return (
        <div
            ref={cardRef}
            className={`ob-coach-card ${placeClass}`}
            style={style}
            role="dialog"
            aria-live="polite"
        >
            <div className="ob-title">{title}</div>
            <div className="ob-body">{body}</div>
            <div className="ob-actions">
                {showPrev && (
                    <button className="ob-btn" onClick={onPrev}>
                        Previous
                    </button>
                )}
                {showSkip && (
                    <button className="ob-btn ob-skip" onClick={onSkip}>
                        Skip
                    </button>
                )}
                <button className="ob-btn ob-next" onClick={onNext}>
                    Next
                </button>
            </div>
        </div>
    );
};

const WelcomeCard: FC<{ onStart: () => void; onSkipForever: () => void }> = ({
    onStart,
    onSkipForever,
}) => (
    <div className="ob-welcome-card" role="dialog" aria-modal="true">
        <div className="ob-welcome-title">Welcome to OlympusRP!</div>
        <p className="ob-welcome-text">
            We’ll take <strong>30 seconds</strong> to show you where things are:
            stats, inventory, wanted list, corporations, gangs, gang chat,
            macros, time, credits, settings, your location, online & chat logs,
            quick actions, and the chat bar.
        </p>
        <div className="ob-actions">
            <button className="ob-btn ob-skip" onClick={onSkipForever}>
                Skip
            </button>
            <button className="ob-btn ob-next" onClick={onStart}>
                Start Tour
            </button>
        </div>
    </div>
);

export const OnboardingOverlay: FC = () => {
    const [welcomeSeen, setWelcomeSeen] = useState<boolean>(() => {
        try {
            return localStorage.getItem(KEY_WELCOME_SEEN) === "1";
        } catch {
            return false;
        }
    });
    const [guideDone, setGuideDone] = useState<boolean>(() => {
        try {
            return localStorage.getItem(KEY_GUIDE_DONE) === "1";
        } catch {
            return false;
        }
    });

    // server bridge: :guide command dispatches this event
    useEffect(() => {
        const onStart = () => {
            setWelcomeSeen(true);
            setGuideDone(false);
            try {
                localStorage.removeItem(KEY_GUIDE_DONE);
            } catch {}
        };
        window.addEventListener("start_quick_guide", onStart as EventListener);
        return () =>
            window.removeEventListener(
                "start_quick_guide",
                onStart as EventListener
            );
    }, []);

    // Steps in your requested order; each has multiple fallback selectors.
    const steps: Step[] = useMemo(
        () => [
            // 1) Stats (use registry if provided by StatsBar)
            {
                id: "stats",
                targets: [
                    "reg:stats",
                    ".stats-bar-container",
                    ".greek-circle", // inner left cluster
                ],
                title: "Stats",
                body: "Track your health, energy and hunger bars, your XP ring and level. Click your avatar to open your profile and spend points.",
                padding: 10,
                placement: "right",
                arrow: "left",
            },
            // 2) Inventory
            {
                id: "inv",
                targets: [
                    ".left-sidebar .sidebar-icon.inventory",
                    ".left-sidebar-container .sidebar-icon.inventory",
                ],
                title: "Inventory",
                body: "Open your backpack to use weapons, defensive gear like Kevlar, consumables, and items you’ve gathered in-game. Click this icon or the X inside the module to open or close it.",
                padding: 8,
                placement: "right",
                arrow: "left",
            },
            // 3) Wanted
            {
                id: "wanted",
                targets: [".left-sidebar .sidebar-icon.wanted"],
                title: "Wanted List",
                body: "See who’s flagged in the city and why. Use it to avoid trouble — or to hunt bounties.",
                padding: 8,
                placement: "right",
            },
            // 4) Corporations
            {
                id: "corps",
                targets: [".left-sidebar .sidebar-icon.corps"],
                title: "Corporations",
                body: "Browse corporations, their ranks and perks. Join up, climb the ladder and unlock role-specific duties.",
                padding: 8,
                placement: "right",
            },
            // 5) Gangs
            {
                id: "gangs",
                targets: [".left-sidebar .sidebar-icon.skull"],
                title: "Gangs",
                body: "Create or manage your gang, view membership and identity, and coordinate territory or activities.",
                padding: 8,
                placement: "right",
            },
            // 6) Gang Chat
            {
                id: "gangchat",
                targets: [
                    ".left-sidebar .sidebar-icon.message",
                    ".left-sidebar .sidebar-icon.message.active",
                ],
                title: "Gang Chat",
                body: "Toggle private gang chat on or off. When enabled, your messages go only to your gang.",
                padding: 8,
                placement: "right",
            },
            // 7) Macros
            {
                id: "macros",
                targets: [".left-sidebar .sidebar-icon.macros"],
                title: "Macros",
                body: "Save your most-used commands as quick actions. Trigger them instantly to speed up roleplay.",
                padding: 8,
                placement: "right",
            },
            // 8) Server Time
            {
                id: "time",
                targets: [
                    ".nitro-right-compact .rs-mini .chip:first-child",
                    ".nitro-right-compact .rs-mini .ico.ico-time",
                ],
                title: "Time & Day",
                body: "This is where the in-game time is displayed. There are a variety of things that In-game time and phase (Day, Dusk, Night, Dawn). Some activities feel different depending on the hour.",
                padding: 10,
                placement: "bottom",
            },
            // 9) Credits
            {
                id: "credits",
                targets: [
                    ".nitro-right-compact .rs-mini .chip:nth-child(2)",
                    ".nitro-right-compact .rs-mini .ico.ico-coin",
                ],
                title: "Credits",
                body: "Your current balance. Use credits to buy items, trade with others and fund your roleplay.",
                padding: 10,
                placement: "bottom",
            },
            // 10) Settings
            {
                id: "settings",
                targets: [
                    ".nitro-right-compact .rs-mini .chip:nth-child(3) .ico-gear",
                    ".nitro-right-compact .rs-mini .ico-gear",
                ],
                title: "Settings",
                body: "Open your settings to adjust preferences and UI modules.",
                padding: 10,
                placement: "bottom",
            },
            // 11) Location
            {
                id: "zone",
                targets: [
                    ".nitro-right-compact .rs-card .rs-title .chip-title",
                    ".nitro-right-compact .rs-card .rs-title",
                ],
                title: "Location",
                body: "This is your current zone. It updates as you move around the city.",
                padding: 12,
                placement: "bottom",
                arrow: "top",
            },
            // 12) Online / Chat Logs
            {
                id: "counter_chat",
                targets: [
                    ".nitro-right-compact .rs-card .rs-counter .chip:first-child",
                    ".nitro-right-compact .rs-card .rs-counter",
                ],
                title: "Online & Chat Logs",
                body: "See how many players are around you. The chat-log button lets you review recent conversations.",
                padding: 10,
                placement: "left",
            },
            // 13) Quick Actions
            {
                id: "quick",
                targets: [
                    ".nitro-right-compact .rs-quick",
                    ".nitro-right-compact .rs-quick .chip",
                ],
                title: "Quick Actions",
                body: "Call the police in an emergency, clock in/out for work, and toggle Passive or Aggressive mode.",
                padding: 12,
                placement: "bottom", // card below the row
                arrow: "top", // arrow points up at the buttons
            },
            // 14) Chat bar
            {
                id: "chat",
                targets: [
                    'input[placeholder*="chat"]',
                    "#chat-input",
                    ".nitro-chat-input input",
                    ".nitro-chatbar input",
                    'textarea[placeholder*="chat"]',
                ],
                title: "Chat",
                body: "Type here to talk. Press Enter to send — and use /commands or your macros to act fast.",
                padding: 10,
                placement: "top",
            },
        ],
        []
    );

    const [stepIndex, setStepIndex] = useState<number>(0);
    const step = steps[stepIndex];

    // compute rect + pulse the exact element we resolved
    const targetRectRaw = useRectOf(step ? step.targets : []);
    useEffect(() => {
        const el = step ? resolveTarget(step.targets) : null;
        setPulseOn(el);
        return () => setPulseOn(null);
    }, [stepIndex, step?.targets]);

    const targetRect = useMemo(() => {
        if (!targetRectRaw) return null;
        const pad = step?.padding ?? 0;
        return new DOMRect(
            Math.max(0, targetRectRaw.left - pad),
            Math.max(0, targetRectRaw.top - pad),
            Math.min(window.innerWidth, targetRectRaw.width + pad * 2),
            Math.min(window.innerHeight, targetRectRaw.height + pad * 2)
        );
    }, [targetRectRaw, step?.padding]);

    // visibility & never-black policy
    const visible = !welcomeSeen || (!guideDone && stepIndex < steps.length);

    // lock body scroll while visible
    useEffect(() => {
        if (!visible) {
            document.body.classList.remove("ob-block-scroll");
            return;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.body.classList.add("ob-block-scroll");
        return () => {
            document.body.style.overflow = prev;
            document.body.classList.remove("ob-block-scroll");
        };
    }, [visible]);

    // keyboard
    useEffect(() => {
        if (!visible) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                try {
                    localStorage.setItem(KEY_WELCOME_SEEN, "1");
                } catch {}
                try {
                    localStorage.setItem(KEY_GUIDE_DONE, "1");
                } catch {}
                setStepIndex(0);
                setPulseOn(null);
            } else if (
                e.key === "ArrowRight" ||
                e.key.toLowerCase() === "enter"
            ) {
                next();
            } else if (e.key === "ArrowLeft") {
                prev();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [visible, stepIndex]);

    const startGuide = () => {
        try {
            localStorage.setItem(KEY_WELCOME_SEEN, "1");
        } catch {}
        setWelcomeSeen(true);
        setStepIndex(0);
    };

    const finishGuide = () => {
        setPulseOn(null);
        try {
            localStorage.setItem(KEY_GUIDE_DONE, "1");
        } catch {}
        setGuideDone(true);
        setStepIndex(0);
    };

    const skipForever = () => {
        try {
            localStorage.setItem(KEY_WELCOME_SEEN, "1");
        } catch {}
        try {
            localStorage.setItem(KEY_GUIDE_DONE, "1");
        } catch {}
        finishGuide();
    };

    const next = () => {
        if (stepIndex >= steps.length - 1) {
            finishGuide();
            return;
        }
        setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    };
    const prev = () => setStepIndex((i) => Math.max(0, i - 1));

    if (!visible) return null;

    const root = document.body;

    return ReactDOM.createPortal(
        <div className="ob-overlay" aria-hidden={false}>
            {/* Backdrop only when a step is active */}
            {step && (
                <>
                    <div
                        className="ob-backdrop"
                        style={{
                            ["--hole-x" as any]: `${
                                targetRect
                                    ? targetRect.left
                                    : window.innerWidth / 2 - 120
                            }px`,
                            ["--hole-y" as any]: `${
                                targetRect
                                    ? targetRect.top
                                    : window.innerHeight / 2 - 80
                            }px`,
                            ["--hole-w" as any]: `${
                                targetRect ? targetRect.width : 240
                            }px`,
                            ["--hole-h" as any]: `${
                                targetRect ? targetRect.height : 160
                            }px`,
                            ["--hole-radius" as any]: "10px",
                        }}
                    />
                    <div
                        className="ob-target-ring"
                        style={{
                            ["--hole-x" as any]: `${
                                targetRect ? targetRect.left : -2000
                            }px`,
                            ["--hole-y" as any]: `${
                                targetRect ? targetRect.top : -2000
                            }px`,
                            ["--hole-w" as any]: `${
                                targetRect ? targetRect.width : 0
                            }px`,
                            ["--hole-h" as any]: `${
                                targetRect ? targetRect.height : 0
                            }px`,
                            ["--hole-radius" as any]: "10px",
                        }}
                    />
                </>
            )}

            {/* Welcome or step card */}
            {!welcomeSeen ? (
                <WelcomeCard onStart={startGuide} onSkipForever={skipForever} />
            ) : step ? (
                <CoachCard
                    title={step.title}
                    body={step.body}
                    onNext={next}
                    onPrev={prev}
                    onSkip={skipForever}
                    showPrev={stepIndex > 0}
                    showSkip
                    anchorRect={targetRect}
                    placement={step.placement}
                    arrow={step.arrow}
                />
            ) : null}
        </div>,
        root
    );
};

export default OnboardingOverlay;
