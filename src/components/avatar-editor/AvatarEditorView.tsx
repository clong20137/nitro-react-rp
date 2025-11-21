import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    AvatarEditorFigureCategory,
    FigureSetIdsMessageEvent,
    GetWardrobeMessageComposer,
    IAvatarFigureContainer,
    ILinkEventTracker,
    UserFigureComposer,
    UserWardrobePageEvent,
} from "@nitrots/nitro-renderer";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import {
    AddEventLinkTracker,
    AvatarEditorAction,
    AvatarEditorUtilities,
    BodyModel,
    FigureData,
    generateRandomFigure,
    GetAvatarRenderManager,
    GetClubMemberLevel,
    GetConfiguration,
    GetSessionDataManager,
    HeadModel,
    IAvatarEditorCategoryModel,
    LegModel,
    LocalizeText,
    RemoveLinkEventTracker,
    SendMessageComposer,
    TorsoModel,
} from "../../api";
import {
    Button,
    ButtonGroup,
    Column,
    Grid,
    NitroCardContentView,
    NitroCardHeaderView,
    NitroCardTabsItemView,
    NitroCardTabsView,
    NitroCardView,
} from "../../common";
import { useMessageEvent } from "../../hooks";
import { AvatarEditorFigurePreviewView } from "./views/AvatarEditorFigurePreviewView";
import { AvatarEditorModelView } from "./views/AvatarEditorModelView";
import { AvatarEditorWardrobeView } from "./views/AvatarEditorWardrobeView";

const DEFAULT_MALE_FIGURE: string =
    "hr-100.hd-180-7.ch-215-66.lg-270-79.sh-305-62.ha-1002-70.wa-2007";
const DEFAULT_FEMALE_FIGURE: string =
    "hr-515-33.hd-600-1.ch-635-70.lg-716-66-62.sh-735-68";

export const AvatarEditorView: FC<{}> = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [figures, setFigures] = useState<Map<string, FigureData>>(null);
    const [figureData, setFigureData] = useState<FigureData>(null);
    const [categories, setCategories] =
        useState<Map<string, IAvatarEditorCategoryModel>>(null);
    const [activeCategory, setActiveCategory] =
        useState<IAvatarEditorCategoryModel>(null);
    const [figureSetIds, setFigureSetIds] = useState<number[]>([]);
    const [boundFurnitureNames, setBoundFurnitureNames] = useState<string[]>(
        []
    );
    const [savedFigures, setSavedFigures] = useState<
        [IAvatarFigureContainer, string][]
    >([]);
    const [isWardrobeVisible, setIsWardrobeVisible] = useState(false);
    const [lastFigure, setLastFigure] = useState<string>(null);
    const [lastGender, setLastGender] = useState<string>(null);
    const [needsReset, setNeedsReset] = useState(true);
    const [isInitalized, setIsInitalized] = useState(false);

    const maxWardrobeSlots = useMemo(
        () => GetConfiguration<number>("avatar.wardrobe.max.slots", 10),
        []
    );

    /* ---------- Nitro events ---------- */

    useMessageEvent<FigureSetIdsMessageEvent>(
        FigureSetIdsMessageEvent,
        (event) => {
            const parser = event.getParser();

            setFigureSetIds(parser.figureSetIds);
            setBoundFurnitureNames(parser.boundsFurnitureNames);
        }
    );

    useMessageEvent<UserWardrobePageEvent>(UserWardrobePageEvent, (event) => {
        const parser = event.getParser();
        const saved: [IAvatarFigureContainer, string][] = [];

        let i = 0;

        while (i < maxWardrobeSlots) {
            saved.push([null, null]);
            i++;
        }

        for (const [index, [look, gender]] of parser.looks.entries()) {
            const container =
                GetAvatarRenderManager().createFigureContainer(look);
            saved[index - 1] = [container, gender];
        }

        setSavedFigures(saved);
    });

    /* ---------- OPEN BY DOM EVENT FROM BRIDGE ---------- */
    useEffect(() => {
        const handler = (ev: Event) => {
            const custom = ev as CustomEvent<{ mode?: number }>;
            const mode = custom.detail?.mode ?? 0;

            // show editor
            setIsVisible(true);

            // mode 1 = open directly on wardrobe (optional)
            if (mode === 1) {
                setIsWardrobeVisible(true);
                setActiveCategory(null);
            }
        };

        window.addEventListener("open_avatar_editor", handler);

        return () => window.removeEventListener("open_avatar_editor", handler);
    }, []);

    /* ---------- Internal helpers ---------- */

    const selectCategory = useCallback(
        (name: string) => {
            if (!categories) return;

            setActiveCategory(categories.get(name));
        },
        [categories]
    );

    const resetCategories = useCallback(() => {
        const newCategories = new Map<string, IAvatarEditorCategoryModel>();

        newCategories.set(AvatarEditorFigureCategory.GENERIC, new BodyModel());
        newCategories.set(AvatarEditorFigureCategory.HEAD, new HeadModel());
        newCategories.set(AvatarEditorFigureCategory.TORSO, new TorsoModel());
        newCategories.set(AvatarEditorFigureCategory.LEGS, new LegModel());

        setCategories(newCategories);
    }, []);

    const setupFigures = useCallback(() => {
        const figs: Map<string, FigureData> = new Map();

        const maleFigure = new FigureData();
        const femaleFigure = new FigureData();

        maleFigure.loadAvatarData(DEFAULT_MALE_FIGURE, FigureData.MALE);
        femaleFigure.loadAvatarData(DEFAULT_FEMALE_FIGURE, FigureData.FEMALE);

        figs.set(FigureData.MALE, maleFigure);
        figs.set(FigureData.FEMALE, femaleFigure);

        setFigures(figs);
        setFigureData(figs.get(FigureData.MALE));
    }, []);

    const loadAvatarInEditor = useCallback(
        (figure: string, gender: string, reset: boolean = true) => {
            gender = AvatarEditorUtilities.getGender(gender);

            let newFigureData = figureData;

            if (gender !== newFigureData.gender) {
                newFigureData = figures.get(gender);
            }

            if (figure !== newFigureData.getFigureString()) {
                newFigureData.loadAvatarData(figure, gender);
            }

            if (newFigureData !== figureData) {
                setFigureData(newFigureData);
            }

            if (reset) {
                setLastFigure(figureData.getFigureString());
                setLastGender(figureData.gender);
            }
        },
        [figures, figureData]
    );

    const processAction = useCallback(
        (action: string) => {
            switch (action) {
                case AvatarEditorAction.ACTION_CLEAR:
                    loadAvatarInEditor(
                        figureData.getFigureStringWithFace(0, false),
                        figureData.gender,
                        false
                    );
                    resetCategories();
                    return;
                case AvatarEditorAction.ACTION_RESET:
                    loadAvatarInEditor(lastFigure, lastGender);
                    resetCategories();
                    return;
                case AvatarEditorAction.ACTION_RANDOMIZE:
                    const figure = generateRandomFigure(
                        figureData,
                        figureData.gender,
                        GetClubMemberLevel(),
                        figureSetIds,
                        [FigureData.FACE]
                    );

                    loadAvatarInEditor(figure, figureData.gender, false);
                    resetCategories();
                    return;
                case AvatarEditorAction.ACTION_SAVE:
                    SendMessageComposer(
                        new UserFigureComposer(
                            figureData.gender,
                            figureData.getFigureString()
                        )
                    );
                    setIsVisible(false);
                    return;
            }
        },
        [
            figureData,
            lastFigure,
            lastGender,
            figureSetIds,
            loadAvatarInEditor,
            resetCategories,
        ]
    );

    const setGender = useCallback(
        (gender: string) => {
            gender = AvatarEditorUtilities.getGender(gender);

            setFigureData(figures.get(gender));
        },
        [figures]
    );

    /* ---------- Link tracker (avatar-editor/show, etc) ---------- */

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split("/");

                if (parts.length < 2) return;

                switch (parts[1]) {
                    case "show":
                        setIsVisible(true);
                        return;
                    case "hide":
                        setIsVisible(false);
                        return;
                    case "toggle":
                        setIsVisible((prevValue) => !prevValue);
                        return;
                }
            },
            eventUrlPrefix: "avatar-editor/",
        };

        AddEventLinkTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    /* ---------- Wardrobe & categories ---------- */

    useEffect(() => {
        setSavedFigures(new Array(maxWardrobeSlots));
    }, [maxWardrobeSlots]);

    useEffect(() => {
        if (!isWardrobeVisible) return;

        setActiveCategory(null);
        SendMessageComposer(new GetWardrobeMessageComposer());
    }, [isWardrobeVisible]);

    useEffect(() => {
        if (!activeCategory) return;

        setIsWardrobeVisible(false);
    }, [activeCategory]);

    useEffect(() => {
        if (!categories) return;

        selectCategory(AvatarEditorFigureCategory.GENERIC);
    }, [categories, selectCategory]);

    useEffect(() => {
        if (!figureData) return;

        AvatarEditorUtilities.CURRENT_FIGURE = figureData;

        resetCategories();

        return () => {
            AvatarEditorUtilities.CURRENT_FIGURE = null;
        };
    }, [figureData, resetCategories]);

    useEffect(() => {
        AvatarEditorUtilities.FIGURE_SET_IDS = figureSetIds;
        AvatarEditorUtilities.BOUND_FURNITURE_NAMES = boundFurnitureNames;

        resetCategories();

        return () => {
            AvatarEditorUtilities.FIGURE_SET_IDS = null;
            AvatarEditorUtilities.BOUND_FURNITURE_NAMES = null;
        };
    }, [figureSetIds, boundFurnitureNames, resetCategories]);

    /* ---------- Visibility & initial setup ---------- */

    useEffect(() => {
        if (!isVisible) return;

        if (!figures) {
            setupFigures();
            setIsInitalized(true);
            return;
        }
    }, [isVisible, figures, setupFigures]);

    useEffect(() => {
        if (!isVisible || !isInitalized || !needsReset) return;

        loadAvatarInEditor(
            GetSessionDataManager().figure,
            GetSessionDataManager().gender
        );
        setNeedsReset(false);
    }, [isVisible, isInitalized, needsReset, loadAvatarInEditor]);

    useEffect(() => {
        if (isVisible) return;

        return () => {
            setNeedsReset(true);
        };
    }, [isVisible]);

    /* ---------- Render ---------- */

    if (!isVisible || !figureData) return null;

    return (
        <NitroCardView
            uniqueKey="avatar-editor"
            className="nitro-avatar-editor"
        >
            <NitroCardHeaderView
                headerText={LocalizeText("avatareditor.title")}
                onCloseClick={() => setIsVisible(false)}
            />
            <NitroCardTabsView>
                {categories &&
                    categories.size > 0 &&
                    Array.from(categories.keys()).map((category) => {
                        const isActive =
                            activeCategory && activeCategory.name === category;

                        return (
                            <NitroCardTabsItemView
                                key={category}
                                isActive={isActive}
                                onClick={() => selectCategory(category)}
                            >
                                {LocalizeText(
                                    `avatareditor.category.${category}`
                                )}
                            </NitroCardTabsItemView>
                        );
                    })}
                <NitroCardTabsItemView
                    isActive={isWardrobeVisible}
                    onClick={() => setIsWardrobeVisible(true)}
                >
                    {LocalizeText("avatareditor.category.wardrobe")}
                </NitroCardTabsItemView>
            </NitroCardTabsView>
            <NitroCardContentView>
                <Grid>
                    <Column size={9} overflow="hidden">
                        {activeCategory && !isWardrobeVisible && (
                            <AvatarEditorModelView
                                model={activeCategory}
                                gender={figureData.gender}
                                setGender={setGender}
                            />
                        )}
                        {isWardrobeVisible && (
                            <AvatarEditorWardrobeView
                                figureData={figureData}
                                savedFigures={savedFigures}
                                setSavedFigures={setSavedFigures}
                                loadAvatarInEditor={loadAvatarInEditor}
                            />
                        )}
                    </Column>
                    <Column size={3} overflow="hidden">
                        <AvatarEditorFigurePreviewView
                            figureData={figureData}
                        />
                        <Column grow gap={1}>
                            <ButtonGroup>
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        processAction(
                                            AvatarEditorAction.ACTION_RESET
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon="undo" />
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        processAction(
                                            AvatarEditorAction.ACTION_CLEAR
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon="trash" />
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        processAction(
                                            AvatarEditorAction.ACTION_RANDOMIZE
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon="dice" />
                                </Button>
                            </ButtonGroup>
                            <Button
                                className="w-100"
                                variant="success"
                                onClick={() =>
                                    processAction(
                                        AvatarEditorAction.ACTION_SAVE
                                    )
                                }
                            >
                                {LocalizeText("avatareditor.save")}
                            </Button>
                        </Column>
                    </Column>
                </Grid>
            </NitroCardContentView>
        </NitroCardView>
    );
};
