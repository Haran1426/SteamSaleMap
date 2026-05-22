const baseGames = require("../../games.json");

const STEAM_COUNTRY = process.env.STEAM_COUNTRY || "kr";
const STEAM_LANGUAGE = process.env.STEAM_LANGUAGE || "korean";
const ITAD_KEY = process.env.ITAD_API_KEY || "";
const ITAD_COUNTRY = process.env.ITAD_COUNTRY || "KR";
const STEAM_SHOP_ID = 61;
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 8000);
const STEAM_SPECIALS_LIMIT = Number(process.env.STEAM_SPECIALS_LIMIT || 40);

exports.handler = async () => {
    try {
        const liveSpecials = await loadSteamSpecials();
        const catalog = mergeCatalog(baseGames, liveSpecials);

        const steamResults = await Promise.allSettled(catalog.map(loadSteamApp));
        let merged = catalog.map((game, index) => {
            const steam = steamResults[index].status === "fulfilled" ? steamResults[index].value : null;
            return mergeSteam(game, steam);
        });

        let itadEnabled = false;
        if (ITAD_KEY) {
            itadEnabled = true;
            merged = await attachItadData(merged);
        }

        return json(200, {
            updatedAt: new Date().toISOString(),
            cacheSeconds: 3600,
            itadEnabled,
            curatedCount: baseGames.length,
            liveSpecialCount: liveSpecials.length,
            games: merged
        });
    } catch (error) {
        return json(500, { error: error.message || "live-games function error" });
    }
};

async function loadSteamSpecials() {
    try {
        const url = `https://store.steampowered.com/api/featuredcategories?cc=${STEAM_COUNTRY}&l=${STEAM_LANGUAGE}`;
        const data = await fetchJson(url, {
            headers: { "User-Agent": "steam-sale-picker/1.0" }
        }, "Steam featured categories");
        const items = data?.specials?.items || [];

        return items
            .filter(item => item?.id && item.discount_percent > 0)
            .slice(0, STEAM_SPECIALS_LIMIT)
            .map(item => ({
                appId: item.id,
                koreanTitle: item.name || `Steam App ${item.id}`,
                title: item.name || `Steam App ${item.id}`,
                tags: ["Steam 할인", "자동수집"],
                genre: "Steam 추천",
                mode: ["싱글"],
                spec: "미분류",
                short: "Steam 현재 할인 목록에서 자동으로 가져온 게임입니다.",
                source: "steam-specials"
            }));
    } catch {
        return [];
    }
}

function mergeCatalog(baseGames, liveSpecials) {
    const byAppId = new Map();
    for (const game of baseGames) {
        byAppId.set(game.appId, { ...game, source: game.source || "curated" });
    }
    for (const game of liveSpecials) {
        if (!byAppId.has(game.appId)) byAppId.set(game.appId, game);
    }
    return [...byAppId.values()];
}

async function loadSteamApp(game) {
    const url = `https://store.steampowered.com/api/appdetails?appids=${game.appId}&cc=${STEAM_COUNTRY}&l=${STEAM_LANGUAGE}`;
    const data = await fetchJson(url, {
        headers: { "User-Agent": "steam-sale-picker/1.0" }
    }, `Steam ${game.appId}`);
    const appData = data?.[game.appId]?.data;
    if (!data?.[game.appId]?.success || !appData) throw new Error(`Steam appdetails failed ${game.appId}`);
    return appData;
}

function mergeSteam(game, steam) {
    if (!steam) {
        return {
            ...game,
            title: game.title || `Steam App ${game.appId}`,
            currentPrice: null,
            normalPrice: null,
            discount: 0,
            currency: "KRW",
            saleEnds: null,
            priceSynced: false
        };
    }

    const overview = steam.price_overview;
    const currentPrice = overview ? Math.round(overview.final / 100) : 0;
    const normalPrice = overview ? Math.round(overview.initial / 100) : 0;

    return {
        ...game,
        title: steam.name || game.title || game.koreanTitle,
        koreanTitle: game.koreanTitle || steam.name || game.title || `Steam App ${game.appId}`,
        steamDescription: steam.short_description || game.steamDescription || game.short || "",
        steamHeaderImage: steam.header_image || null,
        currentPrice,
        normalPrice,
        discount: overview?.discount_percent || 0,
        currency: overview?.currency || "KRW",
        saleEnds: overview?.discount_expiration ? new Date(overview.discount_expiration * 1000).toISOString() : null,
        isFree: steam.is_free || false,
        priceSynced: true
    };
}

async function attachItadData(games) {
    const lookup = await lookupItadIds(games);
    const withIds = games.map(game => ({
        ...game,
        itadId: lookup.get(String(game.appId)) || game.itadId || null
    }));

    const ids = withIds.map(game => game.itadId).filter(Boolean);
    if (!ids.length) return withIds;

    const [lows, histories] = await Promise.all([
        postItad("https://api.isthereanydeal.com/games/storelow/v2", ids, `country=${ITAD_COUNTRY}&shops=${STEAM_SHOP_ID}`),
        loadHistories(ids)
    ]);

    const lowById = new Map((lows || []).map(item => [item.id, item]));
    const historyById = new Map(histories.map(item => [item.id, item.history]));

    return withIds.map(game => {
        if (!game.itadId) return game;

        const steamLow = lowById.get(game.itadId)?.lows?.find(item => item.shop?.id === STEAM_SHOP_ID);
        const history = historyById.get(game.itadId) || [];
        const saleCycleDays = calculateSaleCycle(history);
        const historicalLow = steamLow?.price?.amountInt ? steamLow.price.amountInt / 100 : null;
        const historicalLowGap = historicalLow && game.currentPrice
            ? Math.max(0, Math.round(((game.currentPrice - historicalLow) / historicalLow) * 100))
            : null;

        return {
            ...game,
            historicalLow,
            historicalLowCurrency: steamLow?.price?.currency || game.currency,
            historicalLowGap,
            saleCycleDays,
            priceHistory: history.slice(0, 8).map(item => ({
                timestamp: item.timestamp,
                price: item.deal?.price?.amountInt ? item.deal.price.amountInt / 100 : null,
                currency: item.deal?.price?.currency || game.currency,
                cut: item.deal?.cut || 0
            }))
        };
    });
}

async function postItad(endpoint, body, query = "") {
    const url = `${endpoint}?key=${encodeURIComponent(ITAD_KEY)}${query ? `&${query}` : ""}`;
    try {
        return await fetchJson(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }, "ITAD post");
    } catch {
        return [];
    }
}

async function lookupItadIds(games) {
    try {
        const appIds = games.map(game => `app/${game.appId}`);
        const url = `https://api.isthereanydeal.com/lookup/id/shop/${STEAM_SHOP_ID}/v1?key=${encodeURIComponent(ITAD_KEY)}`;
        const data = await fetchJson(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(appIds)
        }, "ITAD Steam app lookup");
        return new Map(Object.entries(data || {}).map(([shopGameId, itadId]) => [shopGameId.replace(/^app\//, ""), itadId]));
    } catch {
        return new Map();
    }
}

async function fetchJson(url, options = {}, label = "request") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`${label} ${res.status}`);
        return res.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function loadHistories(ids) {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2).toISOString();
    const jobs = ids.map(async id => {
        try {
            const url = `https://api.isthereanydeal.com/games/history/v2?key=${encodeURIComponent(ITAD_KEY)}&id=${id}&country=${ITAD_COUNTRY}&shops=${STEAM_SHOP_ID}&since=${encodeURIComponent(since)}`;
            const history = await fetchJson(url, {}, `ITAD history ${id}`);
            return { id, history: Array.isArray(history) ? history : [] };
        } catch {
            return { id, history: [] };
        }
    });

    return Promise.all(jobs);
}

function calculateSaleCycle(history) {
    const saleStarts = [];
    const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let wasOnSale = false;

    for (const item of sorted) {
        const cut = item.deal?.cut || 0;
        const onSale = cut > 0;
        if (onSale && !wasOnSale) saleStarts.push(new Date(item.timestamp));
        wasOnSale = onSale;
    }

    if (saleStarts.length < 2) return null;

    const gaps = [];
    for (let i = 1; i < saleStarts.length; i++) {
        gaps.push(Math.round((saleStarts[i] - saleStarts[i - 1]) / 86400000));
    }

    return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600"
        },
        body: JSON.stringify(body)
    };
}
