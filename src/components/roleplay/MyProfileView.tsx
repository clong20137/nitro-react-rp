import React, { FC, useEffect, useRef, useState, useMemo } from "react";
import "./MyProfileView.scss";
import { GetCommunication } from "../../api/nitro/GetCommunication";
import { UpgradeStatComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/UpgradeStatComposer";
import { ProfileAchievementsRequestComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ProfileAchievementsRequestComposer";
import { FriendlyTime } from "@nitrots/nitro-renderer";

import {
    UserCurrentBadgesComposer,
    UserCurrentBadgesEvent,
    UserProfileEvent,
} from "@nitrots/nitro-renderer";
import { GetSessionDataManager, GetUserProfile } from "../../api";
import { useMessageEvent } from "../../hooks";
import { BadgesContainerView } from "../user-profile/views/BadgesContainerView";

import { setRPStats } from "./rpStatsCache";

/* --------------------------------- Types --------------------------------- */

interface RelationshipCounts {
    love?: number;
    like?: number;
    hate?: number;
}

interface StatsProps {
    userId?: number;

    kills: number;
    deaths: number;
    punches: number;
    damageGiven: number;
    damageReceived: number;
    energy: number;
    hunger: number;

    strength: number;
    stamina: number;
    defense: number;
    gathering: number;

    healthlevel?: number;
    healthLevel?: number;

    xp: number;
    maxXP: number;
    level: number;
    points: number;

    username: string;
    figure: string;
    motto?: string;

    jobTitle?: string;
    corporationName?: string;
    corporationIconUrl?: string;

    isOnline?: boolean;

    gangName?: string;
    gangId?: number;
    gangIconKey?: string;
    gangPrimaryColor?: string;
    gangSecondaryColor?: string;

    createdAt?: string;
    lastLogin?: string;
    relationships?: RelationshipCounts;

    badges?: string[];
}

type UpgradeableStat =
    | "strength"
    | "stamina"
    | "defense"
    | "healthlevel"
    | "gathering";

export interface AchievementRow {
    id: number;
    key: string;
    name: string;
    current: number;
    target: number;
    xpReward: number;
    badgeUrl: string;
    description?: string;

    groupKey: string;
    groupOrder: number;
    levelOrder: number;
}

/* ------------------------------- Stickers -------------------------------- */

type StickerId = string;

type StickerUiLayer = "behind" | "front";

interface Sticker {
    id: StickerId;
    src: string;
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
    uiLayer?: StickerUiLayer; // ✅ NEW (default front)
}

type ResizeCorner = "nw" | "ne" | "sw" | "se";

/* ------------------------------- Component -------------------------------- */

interface MyProfileViewProps {
    onClose: () => void;
    stats: StatsProps;
    onUpgrade: (stat: UpgradeableStat) => void;
    isOnline?: boolean;
    achievements?: AchievementRow[];
}

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

const swap = <T,>(arr: T[], i: number, j: number) => {
    const copy = arr.slice();
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
    return copy;
};

export const MyProfileView: FC<MyProfileViewProps> = ({
    onClose,
    stats,
    onUpgrade,
    isOnline = stats.isOnline ?? true,
}) => {
    const CHECKMARK_SRC = "/icons/checkmark.png";
    const PENCIL_ICON_SRC = "/icons/pencil.png";
    const BADGE_ICON_SRC = "/icons/badges.png";

    // Keep Nitro profile closed while RP profile is active
    useEffect(() => {
        (window as any).__rpProfileActive = true;
        return () => {
            (window as any).__rpProfileActive = false;
        };
    }, []);

    const sessionUserId = GetSessionDataManager().userId;
    const viewedUserId = stats.userId ?? sessionUserId;
    const isOwnProfile = viewedUserId === sessionUserId;

    const targetUserIdRef = useRef<number | null>(viewedUserId ?? null);

    /* ------------------------------ open/close anim ------------------------------ */

    const [closing, setClosing] = useState(false);
    const closeWithFade = () => {
        setClosing(true);
        window.setTimeout(() => onClose(), 160);
    };

    /* ------------------------------ position + drag ------------------------------ */

    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const stored = localStorage.getItem("profilePos");
        return stored ? JSON.parse(stored) : { x: 100, y: 100 };
    });

    const posRef = useRef(position);
    useEffect(() => {
        posRef.current = position;
    }, [position]);

    const dragRef = useRef<{
        dx: number;
        dy: number;
        pointerId: number;
    } | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    const startDrag = (e: React.PointerEvent) => {
        if (closing) return;
        if ((e.target as HTMLElement)?.closest?.(".close-button")) return;
        if ((e.target as HTMLElement)?.closest?.(".pencil-button")) return;
        if ((e.target as HTMLElement)?.closest?.(".badge-editor-button"))
            return;

        const el = viewRef.current;
        if (!el) return;

        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

        dragRef.current = {
            dx: e.clientX - posRef.current.x,
            dy: e.clientY - posRef.current.y,
            pointerId: e.pointerId,
        };

        document.body.classList.add("cursor-grabbing");
        window.addEventListener("pointermove", handleDrag as any, {
            passive: false,
        });
        window.addEventListener("pointerup", stopDrag as any, {
            passive: true,
        });
    };

    const handleDrag = (e: PointerEvent) => {
        if (!dragRef.current || !viewRef.current) return;

        e.preventDefault();

        const newPos = {
            x: e.clientX - dragRef.current.dx,
            y: e.clientY - dragRef.current.dy,
        };

        posRef.current = newPos;
        viewRef.current.style.left = `${newPos.x}px`;
        viewRef.current.style.top = `${newPos.y}px`;
    };

    const stopDrag = () => {
        dragRef.current = null;
        localStorage.setItem("profilePos", JSON.stringify(posRef.current));
        setPosition(posRef.current);
        document.body.classList.remove("cursor-grabbing");
        window.removeEventListener("pointermove", handleDrag as any);
        window.removeEventListener("pointerup", stopDrag as any);
    };

    /* ------------------------------ resize module ------------------------------ */

    const sizeKey = useMemo(
        () => `profileSize:${viewedUserId}`,
        [viewedUserId]
    );
    const [size, setSize] = useState<{ w: number; h: number }>(() => {
        try {
            const raw = localStorage.getItem(sizeKey);
            if (raw) return JSON.parse(raw);
        } catch {}
        return { w: 850, h: 560 };
    });

    useEffect(() => {
        try {
            localStorage.setItem(sizeKey, JSON.stringify(size));
        } catch {}
    }, [sizeKey, size]);

    const moduleResizeRef = useRef<{
        pointerId: number;
        startW: number;
        startH: number;
        startX: number;
        startY: number;
    } | null>(null);

    const startModuleResize = (e: React.PointerEvent) => {
        if (closing) return;
        e.stopPropagation();
        e.preventDefault();

        moduleResizeRef.current = {
            pointerId: e.pointerId,
            startW: size.w,
            startH: size.h,
            startX: e.clientX,
            startY: e.clientY,
        };

        document.body.classList.add("cursor-nwse-resize");
        window.addEventListener("pointermove", onModuleResize as any, {
            passive: false,
        });
        window.addEventListener("pointerup", stopModuleResize as any, {
            passive: true,
        });
    };

    const onModuleResize = (e: PointerEvent) => {
        const r = moduleResizeRef.current;
        if (!r) return;
        e.preventDefault();

        const vw = Math.max(
            320,
            Math.min(window.innerWidth - 16, r.startW + (e.clientX - r.startX))
        );
        const vh = Math.max(
            420,
            Math.min(window.innerHeight - 16, r.startH + (e.clientY - r.startY))
        );

        setSize({ w: Math.round(vw), h: Math.round(vh) });
    };

    const stopModuleResize = () => {
        moduleResizeRef.current = null;
        document.body.classList.remove("cursor-nwse-resize");
        window.removeEventListener("pointermove", onModuleResize as any);
        window.removeEventListener("pointerup", stopModuleResize as any);
    };

    /* -------------------------- local optimistic stats -------------------------- */

    const [uiStats, setUiStats] = useState(() => ({
        strength: stats.strength ?? 0,
        stamina: stats.stamina ?? 0,
        defense: stats.defense ?? 0,
        gathering: stats.gathering ?? 0,
        healthlevel: Number.isFinite(stats.healthlevel as number)
            ? Number(stats.healthlevel)
            : Number(stats.healthLevel ?? 0),
        points: stats.points ?? 0,
        xp: stats.xp ?? 0,
        maxXP: stats.maxXP ?? 100,
        level: stats.level ?? 1,
    }));

    const [achRows, setAchRows] = useState<AchievementRow[]>([]);
    const [openGroup, setOpenGroup] = useState<string | null>(null);

    const [badges, setBadges] = useState<string[]>(stats.badges ?? []);
    const badgesKey = useMemo(
        () => `profileBadgesDisplay:${viewedUserId}`,
        [viewedUserId]
    );
    const [displayBadges, setDisplayBadges] = useState<string[]>([]);
    const [showBadgeEditor, setShowBadgeEditor] = useState(false);

    const [meta, setMeta] = useState<{
        createdAt?: string;
        lastLogin?: string;
    }>({
        createdAt: stats.createdAt,
        lastLogin: stats.lastLogin,
    });

    useEffect(() => {
        targetUserIdRef.current = viewedUserId ?? null;
    }, [viewedUserId]);

    useEffect(() => {
        const onAchievements = (ev: any) => {
            const rows = ev.detail?.achievements || [];
            setAchRows(rows);
        };
        window.addEventListener("profile_achievements_update", onAchievements);
        return () =>
            window.removeEventListener(
                "profile_achievements_update",
                onAchievements
            );
    }, []);

    useEffect(() => {
        setUiStats((s) => ({
            ...s,
            strength: stats.strength ?? s.strength,
            stamina: stats.stamina ?? s.stamina,
            defense: stats.defense ?? s.defense,
            gathering: stats.gathering ?? s.gathering,
            healthlevel: Number.isFinite(stats.healthlevel as number)
                ? Number(stats.healthlevel)
                : Number(stats.healthLevel ?? s.healthlevel),
            points: stats.points ?? s.points,
            xp: stats.xp ?? s.xp,
            maxXP: stats.maxXP ?? s.maxXP,
            level: stats.level ?? s.level,
        }));
    }, [
        stats.strength,
        stats.stamina,
        stats.defense,
        stats.gathering,
        stats.healthlevel,
        stats.healthLevel,
        stats.points,
        stats.xp,
        stats.maxXP,
        stats.level,
    ]);

    useEffect(() => {
        setRPStats({
            gathering: uiStats.gathering ?? 1,
            level: uiStats.level ?? 1,
        });
    }, [uiStats.gathering, uiStats.level]);

    useEffect(() => {
        if (!viewedUserId) return;

        targetUserIdRef.current = viewedUserId;

        GetUserProfile(viewedUserId);

        try {
            GetCommunication().connection.send(
                new UserCurrentBadgesComposer(viewedUserId)
            );
        } catch (e) {
            console.error("Failed to send UserCurrentBadgesComposer", e);
        }

        setAchRows([]);
        setOpenGroup(null);
    }, [viewedUserId]);

    useMessageEvent<UserProfileEvent>(UserProfileEvent, (event) => {
        const parser = event.getParser();
        if (!parser) return;

        const targetId = targetUserIdRef.current;
        if (!targetId || parser.id !== targetId) return;

        setMeta({
            createdAt: parser.registration ?? "Unknown",
            lastLogin:
                FriendlyTime.format(
                    parser.secondsSinceLastVisit ?? 0,
                    ".ago",
                    2
                ) ?? "Unknown",
        });
    });

    useMessageEvent<UserCurrentBadgesEvent>(UserCurrentBadgesEvent, (event) => {
        const parser = event.getParser();
        const targetId = targetUserIdRef.current;
        if (!targetId || parser.userId !== targetId) return;

        const b = parser.badges || [];
        setBadges(b);

        // if we have no saved display config yet, default to first 5
        setDisplayBadges((prev) => {
            if (prev.length) return prev;
            const next = b.slice(0, 5);
            return next;
        });
    });

    // load display badges config per profile
    useEffect(() => {
        try {
            const raw = localStorage.getItem(badgesKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setDisplayBadges(parsed);
                    return;
                }
            }
        } catch {}
        setDisplayBadges((badges ?? []).slice(0, 5));
    }, [badgesKey, viewedUserId]);

    useEffect(() => {
        try {
            localStorage.setItem(badgesKey, JSON.stringify(displayBadges));
        } catch {}
    }, [badgesKey, displayBadges]);

    /* ------------------------------ Upgrade action ----------------------------- */

    const valueFor = (name: UpgradeableStat) =>
        name === "healthlevel"
            ? uiStats.healthlevel
            : (uiStats as any)[name] ?? 0;

    const handleUpgrade = (stat: UpgradeableStat) => {
        if (!isOwnProfile) return;
        if (uiStats.points <= 0) return;

        const currentVal = valueFor(stat);
        if (currentVal >= 12) return;

        setUiStats((s) => ({
            ...s,
            [stat]: currentVal + 1,
            points: Math.max(0, s.points - 1),
        }));

        GetCommunication().connection.send(new UpgradeStatComposer(stat));
        onUpgrade(stat);
    };

    const pct = (n: number, d: number) =>
        d <= 0 ? 0 : Math.min(100, Math.max(0, (n / d) * 100));

    /* -------------------- Group achievements by type (UI) -------------------- */

    const groupedAchievements = useMemo<
        Record<string, { order: number; rows: AchievementRow[] }>
    >(() => {
        const groups: Record<
            string,
            { order: number; rows: AchievementRow[] }
        > = {};
        for (const row of achRows) {
            const key = row.groupKey || "other";
            if (!groups[key])
                groups[key] = { order: row.groupOrder ?? 0, rows: [] };
            groups[key].rows.push(row);
        }
        Object.values(groups).forEach((g) => {
            g.rows.sort((a, b) => (a.levelOrder ?? 0) - (b.levelOrder ?? 0));
        });
        return groups;
    }, [achRows]);

    const sortedGroupNames = useMemo(
        () =>
            Object.entries(groupedAchievements)
                .sort(([, ga], [, gb]) => (ga.order ?? 0) - (gb.order ?? 0))
                .map(([key]) => key),
        [groupedAchievements]
    );

    const handleToggleGroup = (groupName: string) => {
        setOpenGroup((prev) => (prev === groupName ? null : groupName));
    };

    const prettyGroupName = (groupName: string) => {
        return groupName === "kills"
            ? "Kills"
            : groupName === "deaths"
            ? "Deaths"
            : groupName === "punches"
            ? "Punches Thrown"
            : groupName === "damage"
            ? "Damage"
            : groupName === "gathering"
            ? "Gathering"
            : groupName === "pizza"
            ? "Pizzas Sold"
            : groupName === "mining"
            ? "Mining"
            : groupName.charAt(0).toUpperCase() + groupName.slice(1);
    };

    /* -------------------------- gang visual state --------------------------- */

    const [gangName, setGangName] = useState<string>(stats.gangName ?? "");
    const [gangId, setGangId] = useState<number | undefined>(stats.gangId);
    const [gangIconKey, setGangIconKey] = useState<string>(
        stats.gangIconKey ?? ""
    );
    const [primaryColor, setPrimaryColor] = useState<string>(
        stats.gangPrimaryColor?.startsWith("#")
            ? stats.gangPrimaryColor
            : stats.gangPrimaryColor
            ? `#${stats.gangPrimaryColor}`
            : "#000000"
    );
    const [secondaryColor, setSecondaryColor] = useState<string>(
        stats.gangSecondaryColor?.startsWith("#")
            ? stats.gangSecondaryColor
            : stats.gangSecondaryColor
            ? `#${stats.gangSecondaryColor}`
            : "#000000"
    );

    useEffect(() => {
        const onGangStatus = (ev: any) => {
            const d = ev.detail || {};
            if (typeof d.gangName === "string") setGangName(d.gangName);
            if (typeof d.gangId === "number") setGangId(d.gangId);

            const prim = d.primaryColor
                ? String(d.primaryColor).startsWith("#")
                    ? d.primaryColor
                    : `#${d.primaryColor}`
                : undefined;
            const sec = d.secondaryColor
                ? String(d.secondaryColor).startsWith("#")
                    ? d.secondaryColor
                    : `#${d.secondaryColor}`
                : undefined;
            if (prim) setPrimaryColor(prim);
            if (sec) setSecondaryColor(sec);

            const key = (d.iconKey ?? d.icon ?? "").toString().trim();
            if (key) setGangIconKey(key.toUpperCase());
        };

        window.addEventListener("gang_status_result", onGangStatus);
        return () =>
            window.removeEventListener("gang_status_result", onGangStatus);
    }, []);

    const gangIconSrc = gangIconKey ? `/icons/badges/${gangIconKey}.gif` : "";

    /* ------------------------------ Stickers ------------------------------ */

    const stickersKey = useMemo(
        () => `profileStickers:${viewedUserId}`,
        [viewedUserId]
    );

    const [isStickerEditMode, setIsStickerEditMode] = useState(false);

    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [selectedStickerId, setSelectedStickerId] =
        useState<StickerId | null>(null);

    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [placingStickerId, setPlacingStickerId] = useState<StickerId | null>(
        null
    );

    const STICKER_LIBRARY = useMemo(
        () => [
            // (unchanged - your full list stays here)
            "/icons/stickers/a.gif",
            "/icons/stickers/acsent1.gif",
            "/icons/stickers/acsent2.gif",
            "/icons/stickers/b.gif",
            "/icons/stickers/bear.gif",
            "/icons/stickers/blingblingstars.gif",
            "/icons/stickers/blinghearts.gif",
            "/icons/stickers/bullet1.gif",
            "/icons/stickers/burger.gif",
            "/icons/stickers/c.gif",
            "/icons/stickers/cassette1.gif",
            "/icons/stickers/cassette2.gif",
            "/icons/stickers/cassette3.gif",
            "/icons/stickers/cassette4.gif",
            "/icons/stickers/chain_horizontal.gif",
            "/icons/stickers/chain_vertical.gif",
            "/icons/stickers/chewed_bubblegum.gif",
            "/icons/stickers/comma.gif",
            "/icons/stickers/d.gif",
            "/icons/stickers/dot.gif",
            "/icons/stickers/e.gif",
            "/icons/stickers/eraser.gif",
            "/icons/stickers/Evil_easterbunnny.gif",
            "/icons/stickers/Evil_giant_bunny.gif",
            "/icons/stickers/exclamation.gif",
            "/icons/stickers/extra_ss_duck_left.gif",
            "/icons/stickers/extra_ss_duck_right.gif",
            "/icons/stickers/extra_ss_snowball.gif",
            "/icons/stickers/f.gif",
            "/icons/stickers/finger_push.gif",
            "/icons/stickers/fish.gif",
            "/icons/stickers/flameSkull.gif",
            "/icons/stickers/g.gif",
            "/icons/stickers/h.gif",
            "/icons/stickers/highlighter_1.gif",
            "/icons/stickers/highlighter_2.gif",
            "/icons/stickers/highlighter_mark1.gif",
            "/icons/stickers/highlighter_mark2.gif",
            "/icons/stickers/highlighter_mark3.gif",
            "/icons/stickers/highlighter_mark5.gif",
            "/icons/stickers/highlighter_mark6.gif",
            "/icons/stickers/i.gif",
            "/icons/stickers/j.gif",
            "/icons/stickers/juice.gif",
            "/icons/stickers/k.gif",
            "/icons/stickers/l.gif",
            "/icons/stickers/lapanen_blue.gif",
            "/icons/stickers/leafs1.gif",
            "/icons/stickers/leafs2.gif",
            "/icons/stickers/lightbulb.gif",
            "/icons/stickers/line.gif",
            "/icons/stickers/m.gif",
            "/icons/stickers/n.gif",
            "/icons/stickers/nail2.gif",
            "/icons/stickers/nail3.gif",
            "/icons/stickers/needle_1.gif",
            "/icons/stickers/needle_2.gif",
            "/icons/stickers/needle_3.gif",
            "/icons/stickers/needle_4.gif",
            "/icons/stickers/needle_5.gif",
            "/icons/stickers/o.gif",
            "/icons/stickers/p.gif",
            "/icons/stickers/paper_clip_1.gif",
            "/icons/stickers/xmas_box_darkred.gif",
            "/icons/stickers/bling.gif",
            "/icons/stickers/nl_coinguy_animated.gif",
            "/icons/stickers/nl_wanted_costume.gif",
            "/icons/stickers/val_lovecostume3.gif",
            "/icons/stickers/val_roses_corner_001.gif",
            "/icons/stickers/val_roses_horizontal_001.gif",
            "/icons/stickers/val_Skull360around_anim.gif",
            "/icons/stickers/val_barbwireire_horis_sticker.gif",
            "/icons/stickers/val_barbwire_vert_sticker.gif",
            "/icons/stickers/val_skull360_anim.gif",
            "/icons/stickers/val_cupid_arrow.gif",
            "/icons/stickers/val_cupido_anim.gif",
            "/icons/stickers/fi_golden_snake.gif",
            "/icons/stickers/bowser_sticker_v1.gif",
            "/icons/stickers/grass.gif",
            "/icons/stickers/easter_rabbit_in_hole2.gif",
            "/icons/stickers/easter_carrot_rocket2.gif",
            "/icons/stickers/easteregg_costume.gif",
            "/icons/stickers/easter_bird.gif",
            "/icons/stickers/easter_eggs_vertical_001.gif",
            "/icons/stickers/easter_eggs_horizontal.gif",
            "/icons/stickers/easter_broomstick_001.gif",
            "/icons/stickers/mario_sticker_v2.gif",
            "/icons/stickers/luigi_sticker_v2.gif",
            "/icons/stickers/sticker_chauves_souris.gif",
            "/icons/stickers/koopa_sticker_v2.gif",
            "/icons/stickers/peach_sticker_v2.gif",
            "/icons/stickers/butterfly_01.gif",
            "/icons/stickers/trax_heavy.gif",
            "/icons/stickers/summer_kite.gif",
            "/icons/stickers/summer_cloud1.gif",
            "/icons/stickers/diamond_reward.gif",
            "/icons/stickers/rocket_brown.gif",
            "/icons/stickers/fwrk_blue.gif",
            "/icons/stickers/fwrk_yellow.gif",
            "/icons/stickers/dk_bobbacurse_2.gif",
            "/icons/stickers/sticker_chauves_souri.gif",
            "/icons/stickers/CheeseSuit.gif",
            "/icons/stickers/britney.gif",
            "/icons/stickers/bullybuster.gif",
            "/icons/stickers/poptarts_sb1b.gif",
            "/icons/stickers/Xmas_Jeff_Donkey_Reindeer_Sticker.gif",
            "/icons/stickers/sticker_Goblin1_L.gif",
            "/icons/stickers/sticker_Goblin_anim_L.gif",
            "/icons/stickers/freeHugs.gif",
            "/icons/stickers/sticker_Goblin_anim_R.gif",
            "/icons/stickers/sticker_Goblin2_R.gif",
            "/icons/stickers/sasquatch7.gif",
            "/icons/stickers/patsDay_shamBorderH.gif",
            "/icons/stickers/patsDay_potOGold.gif",
            "/icons/stickers/patsDay_shamrock.gif",
            "/icons/stickers/patsDay_shamBorderV.gif",
            "/icons/stickers/patsDay_claddagh.gif",
            "/icons/stickers/sticker_walkingMechaDog.gif",
            "/icons/stickers/sticker_sticker_wagDogv3.gif",
            "/icons/stickers/val_sticker_love_costumegif",
            "/icons/stickers/Streaker.gif",
            "/icons/stickers/sticker_inkedSquidPatrol.gif",
            "/icons/stickers/sticker_inkedShip.gif",
            "/icons/stickers/sticker_woodBoard.gif",
            "/icons/stickers/sticker_flagBorder.gif",
            "/icons/stickers/sticker_fireworkBoom4.gif",
            "/icons/stickers/sticker_fireworkBoom3.gif",
            "/icons/stickers/sticker_fireworkBoom2r.gif",
            "/icons/stickers/sticker_fireworkBoom1.gif",
            "/icons/stickers/sticker_volcano.gif",
            "/icons/stickers/sticker_jokerCard.gif",
            "/icons/stickers/ataps_Sticker_03.gif",
            "/icons/stickers/sticker_checkerHoriz.png",
            "/icons/stickers/sticker_checkerVert.png",
            "/icons/stickers/diner_gaspump.gif",
            "/icons/stickers/habbolympics_teamsticker.gif",
            "/icons/stickers/sticker_turkey.gif",
            "/icons/stickers/Van_hippie.gif",
            "/icons/stickers/sticker_igor_igor.gif",
            "/icons/stickers/sticker_hw08_evilPumpkin.gif",
            "/icons/stickers/sticker_hw08_webMass.gif",
            "/icons/stickers/sticker_hw08_websTL.gif",
            "/icons/stickers/sticker_hw08_websTR.gif",
            "/icons/stickers/sticker_hw08_websBR.gif",
            "/icons/stickers/sticker_hw08_websBL.gif",
            "/icons/stickers/HJ_TenderCrisp.gif",
            "/icons/stickers/Spyro_sticker.gif",
            "/icons/stickers/circus_sticker_malabarista_001.gif",
            "/icons/stickers/sticker_penguin.gif",
            "/icons/stickers/sticker_AI_dots_3.gif",
            "/icons/stickers/sticker_AI_halfB_4.gif",
            "/icons/stickers/sticker_AI_chevT_4.gif",
            "/icons/stickers/sticker_AI_chevT_2.gif",
            "/icons/stickers/sticker_AI_bar_2gif",
            "/icons/stickers/sticker_AI_chevT_1.gif",
            "/icons/stickers/sticker_AI_halfL_5.gif",
            "/icons/stickers/sticker_AI_halfB_5.gif",
            "/icons/stickers/sticker_AI_halfR_5.gif",
            "/icons/stickers/sticker_AI_halfR_4.gif",
            "/icons/stickers/sticker_AI_halfR_1.gif",
            "/icons/stickers/sticker_AI_halfT_5.gif",
            "/icons/stickers/sticker_AI_halfT_2.gif",
            "/icons/stickers/sticker_ninja_katana.gif",
            "/icons/stickers/sticker_ninja_shuriken_001.gif",
            "/icons/stickers/sticker_checkeredflagL.png",
            "/icons/stickers/lc_bubbla.gif",
            "/icons/stickers/bob_127x142_animated.gif",
            "/icons/stickers/sticker_cheepJump.gif",
            "/icons/stickers/sticker_cheep_12.gif",
            "/icons/stickers/sticker_cheep_20.gif",
            "/icons/stickers/sticker_cheepWin_3.gif",
            "/icons/stickers/AM_habbo_brasilia.png",
            "/icons/stickers/GF_YouAreFreakinAmazing_v1.gif",
            "/icons/stickers/ubersocks_v2.gif",
            "/icons/stickers/britishlegion_2009.gif",
            "/icons/stickers/stick_country_horse.gif",
            "/icons/stickers/sticker_wedRing_1.gif",
            "/icons/stickers/sticker_newCow.gif",
            "/icons/stickers/stick_scifi_misery.gif",
            "/icons/stickers/stick_scifi_misery.gif",
            "/icons/stickers/sticker_crushLogo.gif",
            "/icons/stickers/sticker_greenFlag_r.gif",
            "/icons/stickers/sticker_sirDeko.gif",
            "/icons/stickers/stick_hween09_alien.gif",
            "/icons/stickers/sheriffstar_stikers_1.gif",
            "/icons/stickers/AU_YAP_Sticker_WinterTea_v1.gif",
            "/icons/stickers/stick_uk_starshine.gif",
            "/icons/stickers/sticker_cornyCorn.gif",
            "/icons/stickers/sticker_barfer.gif",
            "/icons/stickers/sticker_punkinPie1.gif",
            "/icons/stickers/sticker_gingerbread_3.gif",
            "/icons/stickers/SG_PBB_Stickers_Hotseat_v1.gif",
            "/icons/stickers/stick_hbh_heartburn.gif",
            "/icons/stickers/FI_espanja_harka.gif",

            "/icons/stickers/sticker_ghDancegif",
            "/icons/stickers/xpr_es02.png",
            "/icons/stickers/xpr_es01.png",
            "/icons/stickers/xpr_es03.png",
            "/icons/stickers/xpr_es04.png",
            "/icons/stickers/xpr_es05.png",
            "/icons/stickers/xpr_es06.png",
            "/icons/stickers/xpr_es07.png",
            "/icons/stickers/xpr_es08.png",
            "/icons/stickers/xpr_es09.png",
            "/icons/stickers/xpr_es10.png",
            "/icons/stickers/xpr_es11.png",
            "/icons/stickers/xpr_es12.png",
            "/icons/stickers/xpr_es13.png",
            "/icons/stickers/stick_panda.gif",
            "/icons/stickers/sticker_nachtschatten.gif",
            "/icons/stickers/sticker_fools_2010.gif",
            "/icons/stickers/sticker_8bitTrip_1.gif",
            "/icons/stickers/sticker_8bitTrip_2.gif",
            "/icons/stickers/sticker_8bitTrip_9_r.gif",
            "/icons/stickers/sticker_8bitTrip_9.gif",
            "/icons/stickers/STICKER_ballonger.png",
            "/icons/stickers/sticker_popsicle_l_6gif",
            "/icons/stickers/sticker_popsicle_l_8.gif",
            "/icons/stickers/NO_STICKER_FiskerFlippet.png",
            "/icons/stickers/sticker_popsicle_l_4.gif",
            "/icons/stickers/sticker_popsicle_l_1.gif",
            "/icons/stickers/sticker_popsicle_l_2.gif",
            "/icons/stickers/sticker_popsicle_l_5.gif",
            "/icons/stickers/sticker_popsicle_l_7.gif",
            "/icons/stickers/border_dia.gif",
            "/icons/stickers/border_horizontal.gif",
            "/icons/stickers/sticker_bw_fins.gif",
            "/icons/stickers/chatpotte_shrek4.gif",
            "/icons/stickers/shrekvert_shrek4.gif",
            "/icons/stickers/michaeljacksonfinal_3.gif",
            "/icons/stickers/sticker_oilSpill_4.gif",
            "/icons/stickers/sticker_despMe_3.gif",
            "/icons/stickers/ven_j_syksyhippo_2.gif",
            "/icons/stickers/sticker_hween10_bat.gif",
            "/icons/stickers/sirpa.png",

            "/icons/stickers/saikkonen.png",
            "/icons/stickers/sulevi.png",
            "/icons/stickers/stick_megamind_1.png",
            "/icons/stickers/Sticker_Norway11.png",
            "/icons/stickers/sticker_xm10_0.gif",
            "/icons/stickers/sticker_circleHearts.gif",
            "/icons/stickers/stick_Sammakkotarra_Cadaverous.gif",
        ],
        []
    );

    useEffect(() => {
        try {
            const raw = localStorage.getItem(stickersKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    // ✅ migrate old stickers (no uiLayer) to front
                    const migrated = (parsed as any[]).map((s) => ({
                        ...s,
                        uiLayer: (s?.uiLayer as StickerUiLayer) ?? "front",
                    }));
                    setStickers(migrated);
                    setSelectedStickerId(null);
                    setShowStickerPicker(false);
                    setPlacingStickerId(null);
                    return;
                }
            }
        } catch {}
        setStickers([]);
        setSelectedStickerId(null);
        setShowStickerPicker(false);
        setPlacingStickerId(null);
    }, [stickersKey]);

    useEffect(() => {
        try {
            localStorage.setItem(stickersKey, JSON.stringify(stickers));
        } catch {}
    }, [stickersKey, stickers]);

    // ✅ Two canvases: one behind, one front.
    const canvasBehindRef = useRef<HTMLDivElement>(null);
    const canvasFrontRef = useRef<HTMLDivElement>(null);

    // ✅ Use BEHIND as the "measurement" canvas for bounds (they’re identical size)
    const canvasRef = canvasBehindRef;

    const stickerPointerDragRef = useRef<{
        id: StickerId;
        pointerId: number;
        ox: number;
        oy: number;
    } | null>(null);

    const stickerResizeRef = useRef<{
        id: StickerId;
        corner: ResizeCorner;
        pointerId: number;
        startX: number;
        startY: number;
        startW: number;
        startH: number;
        startLeft: number;
        startTop: number;
    } | null>(null);

    const selectedSticker = useMemo(
        () => stickers.find((s) => s.id === selectedStickerId) ?? null,
        [stickers, selectedStickerId]
    );

    const stickersBehind = useMemo(
        () => stickers.filter((s) => (s.uiLayer ?? "front") === "behind"),
        [stickers]
    );

    const stickersFront = useMemo(
        () => stickers.filter((s) => (s.uiLayer ?? "front") === "front"),
        [stickers]
    );

    const ensureWithinCanvas = (s: Sticker, rect: DOMRect): Sticker => {
        const nx = clamp(
            Math.round(s.x),
            0,
            Math.max(0, Math.round(rect.width - s.w))
        );
        const ny = clamp(
            Math.round(s.y),
            0,
            Math.max(0, Math.round(rect.height - s.h))
        );
        const nw = clamp(
            Math.round(s.w),
            16,
            Math.max(16, Math.round(rect.width))
        );
        const nh = clamp(
            Math.round(s.h),
            16,
            Math.max(16, Math.round(rect.height))
        );
        return { ...s, x: nx, y: ny, w: nw, h: nh };
    };

    const addStickerAndPlace = (src: string) => {
        if (!isOwnProfile) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        const cx = rect ? Math.round(rect.width / 2) : 220;
        const cy = rect ? Math.round(rect.height / 2) : 160;

        const baseZ = stickers.length
            ? Math.max(...stickers.map((s) => s.z)) + 1
            : 1;

        const next: Sticker = {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            src,
            x: cx - 18,
            y: cy - 18,
            w: 36,
            h: 36,
            z: baseZ,
            uiLayer: "front", // ✅ default to front so it can go on top
        };

        setStickers((prev) => [...prev, next]);
        setSelectedStickerId(next.id);

        setShowStickerPicker(false);
        setPlacingStickerId(next.id);
        document.body.classList.add("cursor-grabbing");
    };

    const removeSelectedSticker = () => {
        if (!isOwnProfile || !selectedStickerId) return;
        setStickers((prev) => prev.filter((s) => s.id !== selectedStickerId));
        setSelectedStickerId(null);
        setPlacingStickerId(null);
    };

    const setSelectedZ = (z: number) => {
        if (!isOwnProfile || !selectedStickerId) return;
        setStickers((prev) =>
            prev.map((s) => (s.id === selectedStickerId ? { ...s, z } : s))
        );
    };

    const setSelectedUiLayer = (uiLayer: StickerUiLayer) => {
        if (!isOwnProfile || !selectedStickerId) return;
        setStickers((prev) =>
            prev.map((s) =>
                s.id === selectedStickerId ? { ...s, uiLayer } : s
            )
        );
    };

    const toggleSelectedUiLayer = () => {
        if (!isOwnProfile || !selectedSticker) return;
        const cur = selectedSticker.uiLayer ?? "front";
        setSelectedUiLayer(cur === "front" ? "behind" : "front");
    };

    const bumpSelectedSize = (dir: 1 | -1) => {
        if (!isOwnProfile || !selectedStickerId) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        setStickers((prev) =>
            prev.map((s) => {
                if (s.id !== selectedStickerId) return s;
                const nw = clamp(s.w + dir * 6, 16, Math.round(rect.width));
                const nh = clamp(s.h + dir * 6, 16, Math.round(rect.height));
                const updated = ensureWithinCanvas(
                    { ...s, w: nw, h: nh },
                    rect
                );
                return updated;
            })
        );
    };

    const stopPlacingIfNeeded = () => {
        if (!placingStickerId) return;
        setPlacingStickerId(null);
        document.body.classList.remove("cursor-grabbing");
    };

    const onCanvasPointerDown = (e: React.PointerEvent) => {
        if (!isOwnProfile) return;

        const hitSticker = (e.target as HTMLElement)?.closest?.(
            ".profile-sticker-wrap"
        );
        if (!hitSticker) setSelectedStickerId(null);
    };

    const startStickerDrag = (e: React.PointerEvent, id: StickerId) => {
        if (!isOwnProfile) return;

        if ((e.target as HTMLElement)?.closest?.(".sticker-handle")) return;

        e.stopPropagation();
        e.preventDefault();

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        setSelectedStickerId(id);

        const st = stickers.find((s) => s.id === id);
        if (!st) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        stickerPointerDragRef.current = {
            id,
            pointerId: e.pointerId,
            ox: mouseX - st.x,
            oy: mouseY - st.y,
        };

        document.body.classList.add("cursor-grabbing");
        window.addEventListener("pointermove", onStickerDrag as any, {
            passive: false,
        });
        window.addEventListener("pointerup", stopStickerDrag as any, {
            passive: true,
        });
    };

    const onStickerDrag = (e: PointerEvent) => {
        const drag = stickerPointerDragRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!drag || !rect) return;

        e.preventDefault();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setStickers((prev) =>
            prev.map((s) => {
                if (s.id !== drag.id) return s;

                const nx = clamp(
                    Math.round(mouseX - drag.ox),
                    0,
                    Math.max(0, Math.round(rect.width - s.w))
                );
                const ny = clamp(
                    Math.round(mouseY - drag.oy),
                    0,
                    Math.max(0, Math.round(rect.height - s.h))
                );

                return { ...s, x: nx, y: ny };
            })
        );
    };

    const stopStickerDrag = () => {
        stickerPointerDragRef.current = null;
        document.body.classList.remove("cursor-grabbing");
        window.removeEventListener("pointermove", onStickerDrag as any);
        window.removeEventListener("pointerup", stopStickerDrag as any);
        stopPlacingIfNeeded();
    };

    const startStickerResize = (
        e: React.PointerEvent,
        id: StickerId,
        corner: ResizeCorner
    ) => {
        if (!isOwnProfile) return;
        e.stopPropagation();
        e.preventDefault();

        const rect = canvasRef.current?.getBoundingClientRect();
        const st = stickers.find((s) => s.id === id);
        if (!rect || !st) return;

        setSelectedStickerId(id);

        stickerResizeRef.current = {
            id,
            corner,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startW: st.w,
            startH: st.h,
            startLeft: st.x,
            startTop: st.y,
        };

        document.body.classList.add("cursor-nwse-resize");
        window.addEventListener("pointermove", onStickerResize as any, {
            passive: false,
        });
        window.addEventListener("pointerup", stopStickerResize as any, {
            passive: true,
        });
    };

    const onStickerResize = (e: PointerEvent) => {
        const r = stickerResizeRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!r || !rect) return;

        e.preventDefault();

        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;

        const minSize = 16;

        setStickers((prev) =>
            prev.map((s) => {
                if (s.id !== r.id) return s;

                let nx = r.startLeft;
                let ny = r.startTop;
                let nw = r.startW;
                let nh = r.startH;

                if (r.corner === "se") {
                    nw = r.startW + dx;
                    nh = r.startH + dy;
                } else if (r.corner === "sw") {
                    nw = r.startW - dx;
                    nh = r.startH + dy;
                    nx = r.startLeft + dx;
                } else if (r.corner === "ne") {
                    nw = r.startW + dx;
                    nh = r.startH - dy;
                    ny = r.startTop + dy;
                } else if (r.corner === "nw") {
                    nw = r.startW - dx;
                    nh = r.startH - dy;
                    nx = r.startLeft + dx;
                    ny = r.startTop + dy;
                }

                nw = clamp(Math.round(nw), minSize, Math.round(rect.width));
                nh = clamp(Math.round(nh), minSize, Math.round(rect.height));

                nx = clamp(
                    Math.round(nx),
                    0,
                    Math.max(0, Math.round(rect.width - nw))
                );
                ny = clamp(
                    Math.round(ny),
                    0,
                    Math.max(0, Math.round(rect.height - nh))
                );

                return { ...s, x: nx, y: ny, w: nw, h: nh };
            })
        );
    };

    const stopStickerResize = () => {
        stickerResizeRef.current = null;
        document.body.classList.remove("cursor-nwse-resize");
        window.removeEventListener("pointermove", onStickerResize as any);
        window.removeEventListener("pointerup", stopStickerResize as any);
        stopPlacingIfNeeded();
    };

    // while placing a newly added sticker, let it follow pointer over the canvas
    useEffect(() => {
        if (!placingStickerId) return;

        const move = (e: PointerEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            setStickers((prev) =>
                prev.map((s) => {
                    if (s.id !== placingStickerId) return s;

                    const nx = clamp(
                        Math.round(mouseX - s.w / 2),
                        0,
                        Math.max(0, Math.round(rect.width - s.w))
                    );
                    const ny = clamp(
                        Math.round(mouseY - s.h / 2),
                        0,
                        Math.max(0, Math.round(rect.height - s.h))
                    );

                    return { ...s, x: nx, y: ny };
                })
            );
        };

        const up = () => stopPlacingIfNeeded();

        window.addEventListener("pointermove", move as any, { passive: false });
        window.addEventListener("pointerup", up as any, { passive: true });

        return () => {
            window.removeEventListener("pointermove", move as any);
            window.removeEventListener("pointerup", up as any);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placingStickerId]);

    /* ------------------------------ Badge reorder + choose ------------------------------ */

    const badgeStripMax = 5;

    // long-press drag for mobile
    const badgeDragRef = useRef<{
        dragging: boolean;
        startIndex: number;
        currentIndex: number;
        timer: number | null;
    } | null>(null);

    const stripBadgeIds = useMemo(() => {
        const list =
            (isOwnProfile
                ? displayBadges
                : (badges ?? []).slice(0, badgeStripMax)) ?? [];
        return list.slice(0, badgeStripMax);
    }, [isOwnProfile, displayBadges, badges]);

    const setBadgeAtIndex = (idx: number, badgeId: string | null) => {
        if (!isOwnProfile) return;

        setDisplayBadges((prev) => {
            const next = prev.slice(0, badgeStripMax);
            while (next.length < badgeStripMax) next.push("");
            next[idx] = badgeId ?? "";
            return next.filter(Boolean).slice(0, badgeStripMax);
        });
    };

    const startBadgeHold = (e: React.PointerEvent, index: number) => {
        if (!isOwnProfile) return;

        const timer = window.setTimeout(() => {
            badgeDragRef.current = {
                dragging: true,
                startIndex: index,
                currentIndex: index,
                timer: null,
            };
            document.body.classList.add("cursor-grabbing");
        }, 220);

        badgeDragRef.current = {
            dragging: false,
            startIndex: index,
            currentIndex: index,
            timer,
        };

        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const moveBadgeHold = (e: React.PointerEvent) => {
        if (!isOwnProfile) return;

        const st = badgeDragRef.current;
        if (!st) return;
        if (!st.dragging) return;

        e.preventDefault();

        const el = document.elementFromPoint(
            e.clientX,
            e.clientY
        ) as HTMLElement | null;
        const slotEl = el?.closest?.("[data-badge-slot]") as HTMLElement | null;
        if (!slotEl) return;

        const idxStr = slotEl.getAttribute("data-badge-slot");
        const overIndex = idxStr ? parseInt(idxStr, 10) : -1;
        if (overIndex < 0 || overIndex >= badgeStripMax) return;
        if (overIndex === st.currentIndex) return;

        st.currentIndex = overIndex;

        setDisplayBadges((prev) => {
            const next = prev.slice(0, badgeStripMax);
            while (next.length < badgeStripMax) next.push("");
            const a = st.startIndex;
            const b = overIndex;

            const swapped = swap(next, a, b)
                .filter(Boolean)
                .slice(0, badgeStripMax);
            st.startIndex = b;
            return swapped;
        });
    };

    const endBadgeHold = () => {
        const st = badgeDragRef.current;
        if (!st) return;

        if (st.timer) window.clearTimeout(st.timer);
        badgeDragRef.current = null;

        document.body.classList.remove("cursor-grabbing");
    };

    const toggleDisplayBadge = (badgeId: string) => {
        if (!isOwnProfile) return;

        setDisplayBadges((prev) => {
            const exists = prev.includes(badgeId);
            if (exists) return prev.filter((b) => b !== badgeId);

            if (prev.length >= badgeStripMax) return prev;
            return [...prev, badgeId];
        });
    };

    /* -------------------------------- Tabs -------------------------------- */

    const [tab, setTab] = useState<"general" | "achievements">("general");

    /* ----------------------------------- UI ----------------------------------- */

    const containerStyle: React.CSSProperties = {
        position: "absolute",
        left: posRef.current.x,
        top: posRef.current.y,
        zIndex: 9999,
        width: size.w,
        height: size.h,
    };

    // helper for rendering sticker layer (used twice)
    const renderStickerLayer = (list: Sticker[]) => {
        return (
            <div className="profile-stickers-layer">
                {list
                    .slice()
                    .sort((a, b) => a.z - b.z)
                    .map((s) => {
                        const isSelected = selectedStickerId === s.id;

                        return (
                            <div
                                key={s.id}
                                className={`profile-sticker-wrap ${
                                    isSelected ? "selected" : ""
                                } ${
                                    placingStickerId === s.id ? "placing" : ""
                                }`}
                                style={{
                                    left: s.x,
                                    top: s.y,
                                    width: s.w,
                                    height: s.h,
                                    zIndex: s.z,
                                }}
                                onPointerDown={(e) => startStickerDrag(e, s.id)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isOwnProfile) return;
                                    setSelectedStickerId(s.id);
                                }}
                            >
                                <img
                                    className="profile-sticker"
                                    src={s.src}
                                    alt=""
                                    draggable={false}
                                />

                                {isOwnProfile && isSelected && (
                                    <>
                                        <div
                                            className="sticker-handle nw"
                                            onPointerDown={(e) =>
                                                startStickerResize(
                                                    e,
                                                    s.id,
                                                    "nw"
                                                )
                                            }
                                        />
                                        <div
                                            className="sticker-handle ne"
                                            onPointerDown={(e) =>
                                                startStickerResize(
                                                    e,
                                                    s.id,
                                                    "ne"
                                                )
                                            }
                                        />
                                        <div
                                            className="sticker-handle sw"
                                            onPointerDown={(e) =>
                                                startStickerResize(
                                                    e,
                                                    s.id,
                                                    "sw"
                                                )
                                            }
                                        />
                                        <div
                                            className="sticker-handle se"
                                            onPointerDown={(e) =>
                                                startStickerResize(
                                                    e,
                                                    s.id,
                                                    "se"
                                                )
                                            }
                                        />
                                    </>
                                )}
                            </div>
                        );
                    })}
            </div>
        );
    };

    return (
        <div
            ref={viewRef}
            className={`profile-container ${closing ? "closing" : "enter"}`}
            style={containerStyle}
        >
            <div className="profile-header" onPointerDown={startDrag}>
                <div className="title">User Profile</div>

                <button
                    className="pencil-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        if (!isOwnProfile) return;

                        setIsStickerEditMode((v) => !v);
                        setShowStickerPicker((v) => !v);
                    }}
                    aria-label="Edit Stickers"
                    title={isOwnProfile ? "Edit Stickers" : "View Profile"}
                >
                    <img src={PENCIL_ICON_SRC} alt="" draggable={false} />
                </button>

                <button
                    className="close-button"
                    onClick={closeWithFade}
                    aria-label="Close"
                />
            </div>

            <div className="profile-tabs">
                <button
                    className={`tab-btn ${tab === "general" ? "active" : ""}`}
                    onClick={() => setTab("general")}
                >
                    General
                </button>

                <button
                    className={`tab-btn ${
                        tab === "achievements" ? "active" : ""
                    }`}
                    onClick={() => {
                        setTab("achievements");
                        setAchRows([]);
                        setOpenGroup(null);

                        try {
                            GetCommunication().connection.send(
                                new ProfileAchievementsRequestComposer(
                                    viewedUserId
                                )
                            );
                        } catch (e) {
                            console.error(
                                "Failed to send ProfileAchievementsRequestComposer",
                                e
                            );
                        }
                    }}
                >
                    Achievements
                </button>
            </div>

            {/* Sticker Picker popup module (BOUND to profile container) */}
            {showStickerPicker && isOwnProfile && !placingStickerId && (
                <div
                    className="stickers-popup"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="stickers-popup-header">
                        <div className="stickers-popup-title">Stickers</div>
                        <button
                            className="stickers-popup-close"
                            onClick={() => setShowStickerPicker(false)}
                            aria-label="Close stickers"
                        />
                    </div>

                    <div className="stickers-grid">
                        {STICKER_LIBRARY.map((src) => (
                            <button
                                key={src}
                                className="sticker-pick"
                                onClick={() => addStickerAndPlace(src)}
                                title={src.split("/").pop() ?? "sticker"}
                            >
                                <img src={src} alt="" draggable={false} />
                            </button>
                        ))}
                    </div>

                    <div className="stickers-hint">
                        Click a sticker to add it. The picker will hide while
                        you place it. Drag stickers to move. Use corners to
                        resize.
                    </div>
                </div>
            )}

            {/* Badge editor popup (also bounded) */}
            {showBadgeEditor && isOwnProfile && (
                <div
                    className="badges-popup"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="badges-popup-header">
                        <div className="badges-popup-title">Badges</div>
                        <button
                            className="badges-popup-close"
                            onClick={() => setShowBadgeEditor(false)}
                            aria-label="Close badges"
                        />
                    </div>

                    <div className="badges-popup-sub">
                        Select up to {badgeStripMax} badges to display. Hold and
                        drag badges on the strip to reorder.
                    </div>

                    <div className="badges-popup-grid">
                        {(badges ?? []).map((b) => {
                            const selected = displayBadges.includes(b);
                            return (
                                <button
                                    key={b}
                                    className={`badge-choice ${
                                        selected ? "selected" : ""
                                    }`}
                                    onClick={() => toggleDisplayBadge(b)}
                                    title={b}
                                >
                                    <img
                                        src={`https://images.habbo.com/c_images/album1584/${b}.gif`}
                                        alt={b}
                                        draggable={false}
                                    />
                                    <span className="badge-choice-check">
                                        {selected ? "✓" : ""}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {tab === "general" ? (
                <div className="profile-body-wrap">
                    {/* ✅ STICKERS BEHIND UI */}
                    <div
                        className={`profile-stickers-canvas behind ${
                            isStickerEditMode || !!placingStickerId
                                ? "edit"
                                : ""
                        }`}
                        ref={canvasBehindRef}
                        onPointerDown={onCanvasPointerDown}
                    >
                        {renderStickerLayer(stickersBehind)}
                    </div>

                    {/* ✅ PROFILE UI */}
                    <div className="profile-body">
                        {/* LEFT COLUMN */}
                        <div className="profile-left">
                            <div className="avatar-section">
                                <div className="avatar-frame">
                                    <img
                                        className="profile-avatar"
                                        src={`https://imager.olympusrp.pw/?figure=${stats.figure}`}
                                        alt="avatar"
                                        draggable={false}
                                    />

                                    <div className="avatar-meta">
                                        <div className="username">
                                            {stats.username}
                                        </div>

                                        <div
                                            className={`online-pill ${
                                                isOnline ? "on" : "off"
                                            }`}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 999,
                                                    background: isOnline
                                                        ? "#22c55e"
                                                        : "#ef4444",
                                                    display: "inline-block",
                                                }}
                                            />
                                            {isOnline ? "Online" : "Offline"}
                                        </div>

                                        {!!stats.motto && (
                                            <div className="motto">
                                                “{stats.motto}”
                                            </div>
                                        )}

                                        {/* Gang pill */}
                                        <div
                                            className="gang-pill"
                                            style={{ marginTop: 2 }}
                                        >
                                            <span className="gang-color-split">
                                                <span
                                                    className="half left"
                                                    style={{
                                                        backgroundColor:
                                                            primaryColor,
                                                    }}
                                                />
                                                <span
                                                    className="half right"
                                                    style={{
                                                        backgroundColor:
                                                            secondaryColor,
                                                    }}
                                                />
                                            </span>

                                            {gangIconSrc && (
                                                <img
                                                    className="gang-icon"
                                                    src={gangIconSrc}
                                                    alt="gang"
                                                    draggable={false}
                                                />
                                            )}

                                            <span>{gangName || "No gang"}</span>

                                            {typeof gangId === "number" && (
                                                <span style={{ opacity: 0.6 }}>
                                                    (#{gangId})
                                                </span>
                                            )}
                                        </div>

                                        {/* Badges under avatar */}
                                        <div className="badge-strip">
                                            <div className="badge-strip-header">
                                                <div className="badge-strip-title">
                                                    Badges
                                                </div>

                                                {isOwnProfile && (
                                                    <button
                                                        className="badge-editor-button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            setShowBadgeEditor(
                                                                (v) => !v
                                                            );
                                                            setShowStickerPicker(
                                                                false
                                                            );
                                                        }}
                                                        title="Edit displayed badges"
                                                    >
                                                        <img
                                                            src={BADGE_ICON_SRC}
                                                            alt=""
                                                            draggable={false}
                                                            onError={(ev) => {
                                                                (
                                                                    ev.currentTarget as HTMLImageElement
                                                                ).style.display =
                                                                    "none";
                                                            }}
                                                        />
                                                        Edit
                                                    </button>
                                                )}
                                            </div>

                                            {/* custom strip (supports hold-drag swap) */}
                                            <div className="badge-strip-slots">
                                                {Array.from({
                                                    length: badgeStripMax,
                                                }).map((_, i) => {
                                                    const badgeId =
                                                        stripBadgeIds[i] || "";
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="badge-slot"
                                                            data-badge-slot={i}
                                                            onPointerDown={(
                                                                e
                                                            ) =>
                                                                startBadgeHold(
                                                                    e,
                                                                    i
                                                                )
                                                            }
                                                            onPointerMove={
                                                                moveBadgeHold
                                                            }
                                                            onPointerUp={
                                                                endBadgeHold
                                                            }
                                                            onPointerCancel={
                                                                endBadgeHold
                                                            }
                                                        >
                                                            {badgeId ? (
                                                                <img
                                                                    src={`https://images.habbo.com/c_images/album1584/${badgeId}.gif`}
                                                                    alt={
                                                                        badgeId
                                                                    }
                                                                    draggable={
                                                                        false
                                                                    }
                                                                />
                                                            ) : (
                                                                <div className="badge-slot-empty" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {!isOwnProfile &&
                                                badges?.length > 0 && (
                                                    <div className="badge-strip-nitro">
                                                        <BadgesContainerView
                                                            fullWidth
                                                            center
                                                            badges={(
                                                                badges ?? []
                                                            ).slice(0, 5)}
                                                        />
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* left cards */}
                            <div className="info-section">
                                <div className="info-card">
                                    <h5>Account</h5>
                                    <div>
                                        Created:{" "}
                                        <b>{meta.createdAt ?? "Unknown"}</b>
                                    </div>
                                    <div>
                                        Last login:{" "}
                                        <b>{meta.lastLogin ?? "Unknown"}</b>
                                    </div>
                                </div>

                                <div className="info-card">
                                    <h5>Employment</h5>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        {stats.corporationIconUrl && (
                                            <img
                                                src={stats.corporationIconUrl}
                                                alt="corp"
                                                width={22}
                                                height={22}
                                            />
                                        )}

                                        <div>
                                            <div style={{ fontWeight: 700 }}>
                                                {stats.jobTitle || "Unemployed"}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    opacity: 0.7,
                                                }}
                                            >
                                                {stats.corporationName ||
                                                    "No corporation"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="profile-right">
                            <div className="level-xp">
                                <div>Level: {uiStats.level}</div>
                                <div className="xp-bar">
                                    <div
                                        className="xp-fill"
                                        style={{
                                            width: `${pct(
                                                uiStats.xp,
                                                Math.max(1, uiStats.maxXP)
                                            )}%`,
                                        }}
                                    />
                                </div>
                                <div className="xp-text">
                                    {uiStats.xp} / {uiStats.maxXP} XP
                                </div>
                                <div className="points-left">
                                    Points: {uiStats.points}
                                </div>
                            </div>

                            <div className="skills">
                                {(
                                    [
                                        "strength",
                                        "stamina",
                                        "defense",
                                        "healthlevel",
                                        "gathering",
                                    ] as UpgradeableStat[]
                                ).map((stat) => {
                                    const statValue = valueFor(stat);
                                    return (
                                        <div className="skill-row" key={stat}>
                                            <div className="skill-name">
                                                {stat.toUpperCase()}
                                            </div>

                                            <div className="skill-bar-wrapper">
                                                <div
                                                    className="skill-bar-fill"
                                                    style={{
                                                        width: `${
                                                            (statValue / 12) *
                                                            100
                                                        }%`,
                                                    }}
                                                >
                                                    <span className="skill-bar-text">
                                                        {statValue}
                                                    </span>
                                                </div>
                                            </div>

                                            {isOwnProfile &&
                                                uiStats.points > 0 && (
                                                    <button
                                                        onClick={() =>
                                                            handleUpgrade(stat)
                                                        }
                                                        className="upgrade-btn"
                                                    >
                                                        +
                                                    </button>
                                                )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="stats-breakdown">
                                <div className="stat-card stat-card--kills">
                                    <div className="stat-icon" />
                                    <div className="stat-text">
                                        <div className="stat-label">Kills</div>
                                        <div className="stat-value">
                                            {stats.kills}
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-card stat-card--deaths">
                                    <div className="stat-icon" />
                                    <div className="stat-text">
                                        <div className="stat-label">Deaths</div>
                                        <div className="stat-value">
                                            {stats.deaths}
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-card stat-card--punches">
                                    <div className="stat-icon" />
                                    <div className="stat-text">
                                        <div className="stat-label">
                                            Punches Thrown
                                        </div>
                                        <div className="stat-value">
                                            {stats.punches}
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-card stat-card--dmg-dealt">
                                    <div className="stat-icon" />
                                    <div className="stat-text">
                                        <div className="stat-label">
                                            Damage Dealt
                                        </div>
                                        <div className="stat-value">
                                            {stats.damageGiven}
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-card stat-card--dmg-taken">
                                    <div className="stat-icon" />
                                    <div className="stat-text">
                                        <div className="stat-label">
                                            Damage Received
                                        </div>
                                        <div className="stat-value">
                                            {stats.damageReceived}
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-card stat-card--kdr">
                                    <div className="stat-icon" />
                                    <div className="stat-text">
                                        <div className="stat-label">
                                            K/D Ratio
                                        </div>
                                        <div className="stat-value">
                                            {stats.deaths > 0
                                                ? (
                                                      stats.kills / stats.deaths
                                                  ).toFixed(2)
                                                : "∞"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ✅ STICKERS IN FRONT OF UI */}
                    <div
                        className={`profile-stickers-canvas front ${
                            isStickerEditMode || !!placingStickerId
                                ? "edit"
                                : ""
                        }`}
                        ref={canvasFrontRef}
                        onPointerDown={onCanvasPointerDown}
                    >
                        {renderStickerLayer(stickersFront)}
                    </div>

                    {/* ✅ Sticker Controls */}
                    {isOwnProfile && selectedSticker && (
                        <div
                            className="sticker-zeditor"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <div className="zeditor-title">
                                Sticker Controls{" "}
                                {placingStickerId ? "(placing…)" : ""}
                            </div>

                            <div className="zeditor-row">
                                <button
                                    className="zbtn"
                                    onClick={() =>
                                        setSelectedZ(selectedSticker.z - 1)
                                    }
                                >
                                    Layer -
                                </button>
                                <div className="zvalue">
                                    {selectedSticker.z}
                                </div>
                                <button
                                    className="zbtn"
                                    onClick={() =>
                                        setSelectedZ(selectedSticker.z + 1)
                                    }
                                >
                                    Layer +
                                </button>
                            </div>

                            {/* ✅ NEW: front/behind toggle */}
                            <div className="zeditor-row">
                                <button
                                    className="zbtn"
                                    onClick={toggleSelectedUiLayer}
                                >
                                    {(selectedSticker.uiLayer ?? "front") ===
                                    "front"
                                        ? "Send Behind UI"
                                        : "Bring In Front"}
                                </button>

                                <div className="zvalue">
                                    {(selectedSticker.uiLayer ?? "front") ===
                                    "front"
                                        ? "Front"
                                        : "Behind"}
                                </div>
                            </div>

                            <div className="zeditor-row">
                                <button
                                    className="zbtn"
                                    onClick={() => bumpSelectedSize(-1)}
                                >
                                    Size -
                                </button>
                                <button
                                    className="zbtn"
                                    onClick={() => bumpSelectedSize(1)}
                                >
                                    Size +
                                </button>
                            </div>

                            <div className="zeditor-row">
                                <button
                                    className="zbtn danger"
                                    onClick={removeSelectedSticker}
                                >
                                    Remove Sticker
                                </button>
                            </div>
                        </div>
                    )}

                    <div
                        className="profile-resize-handle"
                        onPointerDown={startModuleResize}
                    />
                </div>
            ) : (
                /* --------------------------- ACHIEVEMENTS TAB --------------------------- */
                <div className="tab-content">
                    <div className="achievements-panel">
                        <div className="achievements-toolbar">
                            <button
                                className="ach-collapse-all"
                                onClick={() => setOpenGroup(null)}
                            >
                                Collapse All
                            </button>
                        </div>

                        {achRows.length === 0 ? (
                            <div className="achievements-empty">
                                No achievements to show yet.
                            </div>
                        ) : (
                            <div className="achievements-list">
                                {sortedGroupNames.map((groupName) => {
                                    const group =
                                        groupedAchievements[groupName];
                                    if (!group) return null;

                                    const isOpen = openGroup === groupName;
                                    const prettyName =
                                        prettyGroupName(groupName);

                                    return (
                                        <div
                                            className={`ach-group ${
                                                isOpen ? "open" : "collapsed"
                                            }`}
                                            key={groupName}
                                        >
                                            <button
                                                className="ach-group-header"
                                                onClick={() =>
                                                    handleToggleGroup(groupName)
                                                }
                                                aria-expanded={isOpen}
                                            >
                                                <span className="ach-group-title">
                                                    {prettyName}
                                                </span>
                                                <span className="ach-group-arrow">
                                                    <span
                                                        className={`ach-arrow ${
                                                            isOpen
                                                                ? "up"
                                                                : "down"
                                                        }`}
                                                    />
                                                </span>
                                            </button>

                                            <div className="ach-group-body">
                                                <div className="ach-group-inner">
                                                    <div className="ach-group-grid">
                                                        {group.rows.map((a) => {
                                                            const completed =
                                                                a.target > 0 &&
                                                                a.current >=
                                                                    a.target;
                                                            const progPct =
                                                                a.target > 0
                                                                    ? Math.min(
                                                                          100,
                                                                          (a.current /
                                                                              a.target) *
                                                                              100
                                                                      )
                                                                    : 0;

                                                            return (
                                                                <div
                                                                    className={`ach-row ${
                                                                        completed
                                                                            ? "completed"
                                                                            : ""
                                                                    }`}
                                                                    key={a.id}
                                                                >
                                                                    <div className="ach-icon-wrap">
                                                                        <img
                                                                            className="ach-icon"
                                                                            src={
                                                                                a.badgeUrl
                                                                            }
                                                                            alt={
                                                                                a.name
                                                                            }
                                                                            draggable={
                                                                                false
                                                                            }
                                                                        />
                                                                        {completed && (
                                                                            <img
                                                                                className="ach-check"
                                                                                src={
                                                                                    CHECKMARK_SRC
                                                                                }
                                                                                alt="completed"
                                                                                draggable={
                                                                                    false
                                                                                }
                                                                            />
                                                                        )}
                                                                    </div>

                                                                    <div className="ach-line">
                                                                        <div className="ach-title">
                                                                            {
                                                                                a.name
                                                                            }
                                                                        </div>
                                                                        <div className="ach-reward">
                                                                            +
                                                                            {
                                                                                a.xpReward
                                                                            }{" "}
                                                                            XP
                                                                        </div>
                                                                    </div>

                                                                    {a.description && (
                                                                        <div className="ach-text">
                                                                            {
                                                                                a.description
                                                                            }
                                                                        </div>
                                                                    )}

                                                                    <div className="ach-progress">
                                                                        <div className="ach-bar">
                                                                            <div
                                                                                className="ach-fill"
                                                                                style={{
                                                                                    width: `${progPct}%`,
                                                                                }}
                                                                            />
                                                                        </div>

                                                                        <div className="ach-text">
                                                                            {completed
                                                                                ? "Completed"
                                                                                : `${a.current}/${a.target}`}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div
                        className="profile-resize-handle"
                        onPointerDown={startModuleResize}
                    />
                </div>
            )}
        </div>
    );
};

export default MyProfileView;
