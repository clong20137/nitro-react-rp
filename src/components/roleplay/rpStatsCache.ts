export type RPStats = {
    gathering: number;
    level: number;
};

let _cache: RPStats = { gathering: 1, level: 1 };

export function setRPStats(partial: Partial<RPStats>) {
    _cache = { ..._cache, ...partial };
}

export function getRPStats(): RPStats {
    return _cache;
}
