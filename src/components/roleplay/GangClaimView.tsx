import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import { SendMessageComposer } from "../../api";
import "./GangClaimView.scss";

/* Composer (soft-import OK) */
let StartTurfCaptureComposerRef: any;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    StartTurfCaptureComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartTurfCaptureComposer").StartTurfCaptureComposer;
} catch {}

/* Bridge event names */
const VR_INFO_EVT = "virtual_room_info_update";
const TURF_STATUS_EVT = "turf_capture_status";
const TURF_PROGRESS_EVT = "turf_capture_progress";

/* Types */
type Phase = "DAY" | "DUSK" | "NIGHT" | "DAWN";
type TurfState = "idle" | "capturing" | "contested" | "captured" | "canceled";

interface VRInfoPayload {
    virtualRoomId: number;
    name: string;
    type: string; // "turf" | ...
    credits?: number;
    inGameTime?: string;
    phase?: Phase;

    // OPTIONAL (server can include these to avoid the “unclaimed” flash)
    gangId?: number;
    gangName?: string;
    primaryColor?: string; // "#RRGGBB"
    secondaryColor?: string; // "#RRGGBB"
}

interface TurfCaptureStatusPayload {
    virtualRoomId?: number;
    state: TurfState;
    progress?: number; // 0..100
    percent?: number; // alias
    active?: boolean;
    contested?: boolean;

    attackerGangId?: number;
    attackerGangName?: string;
    defenderGangId?: number;
    defenderGangName?: string;

    // Server may send only the *owner/defender* colors:
    defenderPrimaryColor?: string;
    defenderSecondaryColor?: string;
    ownerPrimaryColor?: string;
    ownerSecondaryColor?: string;
    ownerClrA?: string;
    ownerClrB?: string;

    // OPTIONAL (if you extend your bridge):
    attackerPrimaryColor?: string;
    attackerSecondaryColor?: string;

    startedByUserId?: number;
}

const clamp0_100 = (n: number) =>
    Math.max(0, Math.min(100, Math.floor(n || 0)));

/* -------- tiny cache to prevent “Unclaimed” flashes -------- */
type OwnerSnapshot = {
    gangId?: number;
    gangName?: string;
    primary?: string;
    secondary?: string;
};
const ownerKey = (vId: number) => `turfOwner:${vId}`;

const saveOwnerSnapshot = (vId: number, s: OwnerSnapshot) => {
    try {
        localStorage.setItem(ownerKey(vId), JSON.stringify(s));
    } catch {}
};
const loadOwnerSnapshot = (vId: number): OwnerSnapshot | null => {
    try {
        const raw = localStorage.getItem(ownerKey(vId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

// Pull "#RRGGBB" from any alias the packet might use (defender/owner colors)
const pickOwnerColors = (d: Partial<TurfCaptureStatusPayload>) => {
    const primary =
        d.ownerClrA ?? d.ownerPrimaryColor ?? d.defenderPrimaryColor ?? "";
    const secondary =
        d.ownerClrB ?? d.ownerSecondaryColor ?? d.defenderSecondaryColor ?? "";
    return { primary, secondary };
};

// Normalize to "#RRGGBB"
const toHex = (v?: string) => {
    if (!v) return "";
    let s = String(v).trim();
    if (!s) return "";
    if (s[0] !== "#") s = "#" + s;
    if (s.length === 4) {
        const r = s[1],
            g = s[2],
            b = s[3];
        s = `#${r}${r}${g}${g}${b}${b}`;
    }
    if (s.length < 7) s = (s + "000000").slice(0, 7);
    return s.substring(0, 7).toUpperCase();
};

// From global cache if present
const pickColorsFromCache = (gangId?: number) => {
    if (!gangId) return { primary: "", secondary: "" };
    try {
        const map = (window as any).__gangColorMap;
        const entry = map?.[gangId];
        if (entry) {
            return {
                primary: toHex(entry.primary),
                secondary: toHex(entry.secondary),
            };
        }
    } catch {}
    return { primary: "", secondary: "" };
};

export const GangClaimView: FC = () => {
    const [visible, setVisible] = useState(false);
    const [vId, setVId] = useState(0);
    const [name, setName] = useState<string>("");

    const [turfState, setTurfState] = useState<TurfState>("idle");
    const [progress, setProgress] = useState(0);

    const [attackerGangId, setAttackerGangId] = useState<number | undefined>();
    const [attackerGangName, setAttackerGangName] = useState<
        string | undefined
    >();

    const [defenderGangId, setDefenderGangId] = useState<number | undefined>();
    const [defenderGangName, setDefenderGangName] = useState<
        string | undefined
    >();

    // owner (defender) split (base layer)
    const [defenderPrimaryColor, setDefenderPrimaryColor] = useState<
        string | undefined
    >();
    const [defenderSecondaryColor, setDefenderSecondaryColor] = useState<
        string | undefined
    >();

    // attacker split (fill layer)
    const [attackerPrimaryColor, setAttackerPrimaryColor] = useState<
        string | undefined
    >();
    const [attackerSecondaryColor, setAttackerSecondaryColor] = useState<
        string | undefined
    >();

    /* When entering a virtual room, seed ownership and colors ASAP */
    useEffect(() => {
        const onVR = (ev: Event) => {
            const { detail } = ev as CustomEvent<VRInfoPayload>;
            const isTurf = (detail?.type || "").toLowerCase() === "turf";

            setVisible(isTurf && !!detail?.virtualRoomId);
            setVId(detail?.virtualRoomId || 0);
            setName(detail?.name || "");

            if (!isTurf || !detail?.virtualRoomId) {
                // leaving turf: reset
                setTurfState("idle");
                setProgress(0);
                setAttackerGangId(undefined);
                setAttackerGangName(undefined);
                setDefenderGangId(undefined);
                setDefenderGangName(undefined);
                setDefenderPrimaryColor(undefined);
                setDefenderSecondaryColor(undefined);
                setAttackerPrimaryColor(undefined);
                setAttackerSecondaryColor(undefined);
                return;
            }

            // Prefer server-sent owner
            let gId = detail.gangId;
            let gName = detail.gangName;
            let pCol = toHex(detail.primaryColor);
            let sCol = toHex(detail.secondaryColor);

            // Fallback to snapshot
            if (!gId && !gName) {
                const snap = loadOwnerSnapshot(detail.virtualRoomId);
                if (snap) {
                    gId = gId ?? snap.gangId;
                    gName = gName ?? snap.gangName;
                    pCol = pCol || toHex(snap.primary);
                    sCol = sCol || toHex(snap.secondary);
                }
            }

            // And then global cache
            if ((!pCol || !sCol) && gId) {
                const c = pickColorsFromCache(gId);
                if (!pCol) pCol = c.primary;
                if (!sCol) sCol = c.secondary;
            }

            if (typeof gId === "number") setDefenderGangId(gId);
            if (typeof gName === "string")
                setDefenderGangName(gName || undefined);
            if (pCol) setDefenderPrimaryColor(pCol);
            if (sCol) setDefenderSecondaryColor(sCol);

            // attackers reset on room change
            setAttackerPrimaryColor(undefined);
            setAttackerSecondaryColor(undefined);
        };

        window.addEventListener(VR_INFO_EVT, onVR as EventListener);
        return () =>
            window.removeEventListener(VR_INFO_EVT, onVR as EventListener);
    }, []);

    /* Merge handler for both progress + status events (server is source of truth) */
    useEffect(() => {
        const onStatus = (ev: Event) => {
            const d = (ev as CustomEvent<TurfCaptureStatusPayload>).detail;
            if (!d) return;

            if (d.virtualRoomId && vId && d.virtualRoomId !== vId) return;

            const p = clamp0_100(d.progress ?? d.percent ?? progress);
            const state = d.state as TurfState | undefined;

            if (state) setTurfState(state);
            setProgress(p);

            if (typeof d.attackerGangId === "number")
                setAttackerGangId(d.attackerGangId);
            if (typeof d.attackerGangName === "string")
                setAttackerGangName(d.attackerGangName || undefined);

            // During capture the "owner" we show is the defender; after capture it's the attacker.
            const becameOwnerNow = state === "captured" || p >= 100;
            const nextOwnerId = becameOwnerNow
                ? d.attackerGangId ?? defenderGangId
                : d.defenderGangId ?? defenderGangId;
            const nextOwnerName = becameOwnerNow
                ? d.attackerGangName ?? defenderGangName
                : d.defenderGangName ?? defenderGangName;

            if (typeof nextOwnerId === "number") setDefenderGangId(nextOwnerId);
            if (typeof nextOwnerName === "string")
                setDefenderGangName(nextOwnerName || undefined);

            // --- OWNER COLORS ---
            let { primary: pCol, secondary: sCol } = pickOwnerColors(d);
            pCol = toHex(pCol);
            sCol = toHex(sCol);

            if ((!pCol || !sCol) && nextOwnerId) {
                const c = pickColorsFromCache(nextOwnerId);
                if (!pCol) pCol = c.primary;
                if (!sCol) sCol = c.secondary;
            }

            if (pCol) setDefenderPrimaryColor(pCol);
            if (sCol) setDefenderSecondaryColor(sCol);

            // --- ATTACKER COLORS (fill layer) ---
            let attA = toHex(d.attackerPrimaryColor);
            let attB = toHex(d.attackerSecondaryColor);
            if ((!attA || !attB) && d.attackerGangId) {
                const ac = pickColorsFromCache(d.attackerGangId);
                if (!attA) attA = ac.primary;
                if (!attB) attB = ac.secondary;
            }
            // Last resort (still show a fill even if server didn’t send attacker colors)
            if (!attA && pCol) attA = pCol;
            if (!attB && sCol) attB = sCol;

            setAttackerPrimaryColor(attA || undefined);
            setAttackerSecondaryColor(attB || undefined);

            // Persist snapshot (prevents "Unclaimed" flash when re-entering)
            if (vId > 0 && (nextOwnerId || nextOwnerName || pCol || sCol)) {
                saveOwnerSnapshot(vId, {
                    gangId: nextOwnerId,
                    gangName: nextOwnerName,
                    primary: pCol || defenderPrimaryColor,
                    secondary: sCol || defenderSecondaryColor,
                });
            }
        };

        window.addEventListener(TURF_STATUS_EVT, onStatus as EventListener);
        window.addEventListener(TURF_PROGRESS_EVT, onStatus as EventListener);
        return () => {
            window.removeEventListener(
                TURF_STATUS_EVT,
                onStatus as EventListener
            );
            window.removeEventListener(
                TURF_PROGRESS_EVT,
                onStatus as EventListener
            );
        };
        // include current colors so snapshot persists latest hues too
    }, [
        vId,
        progress,
        defenderGangId,
        defenderGangName,
        defenderPrimaryColor,
        defenderSecondaryColor,
    ]);

    const statusLabel = useMemo(() => {
        switch (turfState) {
            case "capturing":
                return "Capturing…";
            case "contested":
                return "Contested!";
            case "captured":
                return "Captured";
            case "canceled":
                return "Canceled";
            default:
                return "Idle";
        }
    }, [turfState]);

    const isBusy = turfState === "capturing" || turfState === "contested";
    const isDone = turfState === "captured";

    /* Start capture (server drives UI) */
    const onClaim = useCallback(() => {
        if (!visible || vId <= 0) return;
        if (isBusy || isDone) return;
        try {
            const Composer =
                StartTurfCaptureComposerRef ||
                require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/StartTurfCaptureComposer")
                    .StartTurfCaptureComposer;
            SendMessageComposer(new Composer(vId));
        } catch (e) {
            console.warn("Failed to send StartTurfCaptureComposer", e);
        }
    }, [visible, vId, isBusy, isDone]);

    // Owner label
    const ownerLabel =
        (defenderGangName && defenderGangName.trim()) ||
        (defenderGangId && defenderGangId > 0
            ? `Gang #${defenderGangId}`
            : "Unclaimed");

    if (!visible) return null;

    const shieldClass = `gang-claim__shield ${
        turfState === "contested" ? "is-contested" : ""
    } ${isDone && progress >= 100 ? "is-complete" : ""}`;

    return (
        <div className="gang-claim">
            <div className="gang-claim__card">
                <div className="gang-claim__title">{name || "Turf"}</div>

                <div
                    className={`gang-claim__status gang-claim__status--${turfState}`}
                >
                    <span className="gang-claim__status-dot" />
                    {statusLabel}
                </div>

                {/* Shield-as-progress (split base + split fill) */}
                <div
                    className={shieldClass}
                    style={{
                        // base (owner) split:
                        ["--shield-a" as any]:
                            defenderPrimaryColor || "#E06C35",
                        ["--shield-b" as any]:
                            defenderSecondaryColor || "#3A4253",
                        // attacker split (fill):
                        ["--att-a" as any]:
                            attackerPrimaryColor ||
                            defenderPrimaryColor ||
                            "#9ad1ff",
                        ["--att-b" as any]:
                            attackerSecondaryColor ||
                            defenderSecondaryColor ||
                            "#4a74a3",
                        // fill %:
                        ["--pct" as any]: `${progress}%`,
                    }}
                    aria-hidden
                >
                    <div className="gang-claim__shield-center">{progress}%</div>
                </div>

                <div className="gang-claim__owner">{ownerLabel}</div>

                <div className="gang-claim__gangline">
                    {attackerGangName ? (
                        <span className="gang-claim__gang gang-claim__gang--att">
                            Capturing: {attackerGangName}
                        </span>
                    ) : null}
                </div>

                <button
                    className="gang-claim__btn"
                    onClick={onClaim}
                    disabled={isBusy || isDone}
                    aria-disabled={isBusy || isDone}
                    title={
                        isDone
                            ? "Already captured"
                            : isBusy
                            ? "Capture in progress"
                            : "Claim this turf"
                    }
                >
                    {isDone
                        ? "Captured"
                        : isBusy
                        ? "Capture In Progress…"
                        : "Claim Turf"}
                </button>
            </div>
        </div>
    );
};

export default GangClaimView;
