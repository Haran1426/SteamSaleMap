const state = {
    games: [],
    filtered: [],
    search: "",
    genre: "all",
    mode: "all",
    spec: "all",
    sort: "dealScore",
    tag: "all",
    source: "loading"
};

const els = {
    grid: document.getElementById("gameGrid"),
    empty: document.getElementById("emptyState"),
    search: document.getElementById("searchInput"),
    genre: document.getElementById("genreFilter"),
    mode: document.getElementById("modeFilter"),
    spec: document.getElementById("specFilter"),
    sort: document.getElementById("sortSelect"),
    quickTags: document.getElementById("quickTags"),
    modal: document.getElementById("gameModal"),
    modalContent: document.getElementById("modalContent")
};

const quickTags = ["all", "협동", "저사양", "로그라이크", "생존", "시뮬레이션", "RPG", "액션"];

init();

async function init() {
    setupEvents();
    await loadLiveGames();
}

async function loadLiveGames() {
    setStatus("로딩", "실시간 가격 데이터를 불러오는 중입니다.");

    try {
        const payload = await fetchLivePayload();
        state.games = normalizeGames(payload.games || []);
        state.source = payload.source || "live";
        setupFilters();
        applyFilters();
        updateSyncUi(payload);
    } catch (error) {
        state.games = [];
        state.source = "error";
        applyFilters();
        setStatus("오류", `데이터를 불러오지 못했습니다: ${error.message}`);
    }
}

async function fetchLivePayload() {
    try {
        const res = await fetch("/.netlify/functions/live-games");
        if (!res.ok) throw new Error("serverless function unavailable");
        const payload = await res.json();
        return { ...payload, source: payload.itadEnabled ? "live+itad" : "live" };
    } catch {
        const res = await fetch("games.json");
        if (!res.ok) throw new Error("sample data unavailable");
        return {
            updatedAt: new Date().toISOString(),
            cacheSeconds: 0,
            itadEnabled: false,
            source: "sample",
            games: await res.json()
        };
    }
}

function normalizeGames(games) {
    return games.map(game => ({
        currency: "KRW",
        discount: 0,
        mode: [],
        tags: [],
        priceSynced: false,
        ...game
    }));
}

function updateSyncUi(payload) {
    document.getElementById("lastUpdated").textContent = new Date(payload.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("gameCount").textContent = `${state.games.length}개`;

    if (state.source === "sample") {
        setStatus("샘플", "실시간 API가 없을 때도 데모가 보이도록 샘플 가격 데이터를 사용 중입니다.");
        return;
    }

    const liveNote = Number.isFinite(payload.liveSpecialCount)
        ? ` Steam 할인 목록 자동 수집 ${payload.liveSpecialCount}개를 함께 병합했습니다.`
        : "";

    setStatus(
        payload.itadEnabled ? "정상" : "Steam",
        payload.itadEnabled
            ? `Steam 현재가와 ITAD 가격 이력을 함께 반영했습니다.${liveNote}`
            : `Steam 현재가와 현재 할인 목록을 반영했습니다.${liveNote} ITAD_API_KEY를 설정하면 최저가와 할인 주기가 추가됩니다.`
    );
}

function setStatus(stateText, note) {
    document.getElementById("liveState").textContent = stateText;
    document.getElementById("syncNote").textContent = note;
}

function setupFilters() {
    els.genre.innerHTML = '<option value="all">전체 장르</option>';
    [...new Set(state.games.map(game => game.genre).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "ko"))
        .forEach(genre => {
            const option = document.createElement("option");
            option.value = genre;
            option.textContent = genre;
            els.genre.appendChild(option);
        });

    els.quickTags.innerHTML = quickTags
        .map(tag => `<button class="tag-btn ${tag === "all" ? "active" : ""}" data-tag="${tag}" type="button">${tag === "all" ? "전체" : tag}</button>`)
        .join("");
}

function setupEvents() {
    els.search.addEventListener("input", event => {
        state.search = event.target.value.trim().toLowerCase();
        applyFilters();
    });
    els.genre.addEventListener("change", event => {
        state.genre = event.target.value;
        applyFilters();
    });
    els.mode.addEventListener("change", event => {
        state.mode = event.target.value;
        applyFilters();
    });
    els.spec.addEventListener("change", event => {
        state.spec = event.target.value;
        applyFilters();
    });
    els.sort.addEventListener("change", event => {
        state.sort = event.target.value;
        applyFilters();
    });
    els.quickTags.addEventListener("click", event => {
        const button = event.target.closest("[data-tag]");
        if (!button) return;
        state.tag = button.dataset.tag;
        document.querySelectorAll(".tag-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tag === state.tag));
        applyFilters();
    });
    document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
    document.getElementById("refreshBtn").addEventListener("click", loadLiveGames);
    document.getElementById("exportBtn").addEventListener("click", exportCsv);
    document.addEventListener("click", event => {
        const detailBtn = event.target.closest("[data-detail]");
        const closeBtn = event.target.closest("[data-close]");
        if (detailBtn) openModal(Number(detailBtn.dataset.detail));
        if (closeBtn) closeModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeModal();
    });
}

function applyFilters() {
    let result = [...state.games];
    if (state.search) {
        result = result.filter(game => [game.title, game.koreanTitle, game.short, game.genre, game.spec, ...game.tags, ...game.mode]
            .join(" ")
            .toLowerCase()
            .includes(state.search));
    }
    if (state.genre !== "all") result = result.filter(game => game.genre === state.genre);
    if (state.mode !== "all") result = result.filter(game => game.mode.includes(state.mode));
    if (state.spec !== "all") result = result.filter(game => game.spec === state.spec);
    if (state.tag !== "all") result = result.filter(game => game.tags.includes(state.tag) || game.genre === state.tag || game.mode.includes(state.tag));

    result.sort(sortGames);
    state.filtered = result;
    renderGames(result);
    updateSummary(result);
}

function sortGames(a, b) {
    if (state.sort === "discount") return b.discount - a.discount;
    if (state.sort === "priceAsc") return getPrice(a) - getPrice(b);
    if (state.sort === "cycle") return getCycle(a) - getCycle(b);
    if (state.sort === "title") return a.koreanTitle.localeCompare(b.koreanTitle, "ko");
    return getDealScore(b) - getDealScore(a);
}

function renderGames(games) {
    els.grid.innerHTML = games.map(game => renderGameCard(game)).join("");
    els.empty.classList.toggle("active", games.length === 0);
}

function renderGameCard(game) {
    const advice = getBuyAdvice(game);
    const cycleText = Number.isFinite(game.saleCycleDays) ? `${game.saleCycleDays}일` : "데이터 없음";
    const lowGap = Number.isFinite(game.historicalLowGap) ? `${game.historicalLowGap}%` : "데이터 없음";

    return `
        <article class="game-card">
            <img class="game-img" src="${getHeaderImage(game.appId)}" alt="${escapeHtml(game.koreanTitle)}">
            <div class="game-body">
                <div class="game-title-row">
                    <div>
                        <h3>${escapeHtml(game.koreanTitle)}</h3>
                        <small>${escapeHtml(game.title || `Steam App ${game.appId}`)}</small>
                    </div>
                    <span class="discount">${game.discount > 0 ? `-${game.discount}%` : "정가"}</span>
                </div>
                <p class="desc">${escapeHtml(game.short)}</p>
                <div class="price-row">
                    <div>
                        <div class="current-price">${formatPrice(game.currentPrice, game.currency)}</div>
                        <div class="normal-price">${game.discount > 0 ? formatPrice(game.normalPrice, game.currency) : ""}</div>
                    </div>
                    <span class="advice ${advice.type}">${advice.text}</span>
                </div>
                <div class="meta-grid">
                    <div class="meta-box"><span>평균 할인 주기</span><strong>${cycleText}</strong></div>
                    <div class="meta-box"><span>최저가 차이</span><strong>${lowGap}</strong></div>
                    <div class="meta-box"><span>할인 종료</span><strong>${game.saleEnds ? formatDate(game.saleEnds) : "미제공"}</strong></div>
                    <div class="meta-box"><span>추천 점수</span><strong>${Math.round(getDealScore(game))}</strong></div>
                </div>
                <div class="tags">${game.tags.slice(0, 5).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
                <div class="card-actions">
                    <a href="https://store.steampowered.com/app/${game.appId}" target="_blank" rel="noopener">Steam 이동</a>
                    <button data-detail="${game.appId}" type="button">상세 보기</button>
                </div>
            </div>
        </article>
    `;
}

function getDealScore(game) {
    const discountScore = game.discount * 1.8;
    const lowGapScore = Number.isFinite(game.historicalLowGap) ? Math.max(0, 40 - game.historicalLowGap) : 0;
    const cycleScore = Number.isFinite(game.saleCycleDays) ? Math.max(0, 30 - game.saleCycleDays / 5) : 0;
    const priceScore = getPrice(game) <= 10000 ? 18 : getPrice(game) <= 20000 ? 10 : 4;
    return discountScore + lowGapScore + cycleScore + priceScore;
}

function getBuyAdvice(game) {
    if (!Number.isFinite(game.currentPrice)) return { text: "가격 확인", type: "wait" };
    if (game.discount >= 70 && (game.historicalLowGap ?? 99) <= 25) return { text: "지금 사도 좋음", type: "good" };
    if (game.discount >= 50) return { text: "괜찮은 할인", type: "warn" };
    if (game.discount >= 30) return { text: "취향이면 구매", type: "warn" };
    return { text: "기다리기", type: "wait" };
}

function updateSummary(games) {
    document.getElementById("syncedCount").textContent = games.filter(g => g.priceSynced || Number.isFinite(g.currentPrice)).length;
    document.getElementById("saleCount").textContent = games.filter(g => g.discount > 0).length;
    document.getElementById("bigSaleCount").textContent = games.filter(g => g.discount >= 70).length;
    document.getElementById("coopCount").textContent = games.filter(g => g.mode.includes("협동")).length;
}

function applyPreset(preset) {
    state.search = "";
    state.genre = "all";
    state.mode = "all";
    state.spec = "all";
    state.tag = "all";
    state.sort = "dealScore";

    if (preset === "coop") state.mode = "협동";
    if (preset === "lowSpec") state.spec = "저사양";
    if (preset === "bigSale") state.sort = "discount";
    if (preset === "roguelike") state.tag = "로그라이크";

    els.search.value = "";
    els.genre.value = state.genre;
    els.mode.value = state.mode;
    els.spec.value = state.spec;
    els.sort.value = state.sort;
    document.querySelectorAll(".tag-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tag === state.tag));
    applyFilters();
    document.getElementById("deals").scrollIntoView({ behavior: "smooth" });
}

function openModal(appId) {
    const game = state.games.find(item => item.appId === appId);
    if (!game) return;

    const advice = getBuyAdvice(game);
    const detailDescription = game.steamDescription || game.short;
    els.modalContent.innerHTML = `
        <div class="modal-content">
            <img class="modal-hero" src="${getCapsuleImage(game.appId)}" alt="${escapeHtml(game.koreanTitle)}">
            <p class="eyebrow">${escapeHtml(game.genre)} · ${escapeHtml(game.spec)}</p>
            <h2>${escapeHtml(game.koreanTitle)}</h2>
            <p class="desc">${escapeHtml(detailDescription)}</p>
            <div class="meta-grid">
                <div class="meta-box"><span>현재 가격</span><strong>${formatPrice(game.currentPrice, game.currency)}</strong></div>
                <div class="meta-box"><span>정가</span><strong>${formatPrice(game.normalPrice, game.currency)}</strong></div>
                <div class="meta-box"><span>할인율</span><strong>${game.discount}%</strong></div>
                <div class="meta-box"><span>판단</span><strong>${advice.text}</strong></div>
            </div>
            <h3>가격 이력</h3>
            <div class="history-list">
                ${(game.priceHistory || []).length
                    ? game.priceHistory.map(item => `<div class="history-item"><span>${formatDate(item.timestamp)}</span><strong>-${item.cut}% · ${formatPrice(item.price, item.currency)}</strong></div>`).join("")
                    : "<p class='desc'>ITAD_API_KEY를 설정하면 최근 가격 이력이 표시됩니다.</p>"}
            </div>
            <div class="card-actions modal-actions">
                <a href="https://store.steampowered.com/app/${game.appId}" target="_blank" rel="noopener">Steam에서 보기</a>
                <button data-close="modal" type="button">닫기</button>
            </div>
        </div>
    `;
    els.modal.classList.add("active");
    els.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    els.modal.classList.remove("active");
    els.modal.setAttribute("aria-hidden", "true");
}

function exportCsv() {
    const header = ["appId", "name", "genre", "spec", "discount", "currentPrice", "historicalLowGap", "dealScore"];
    const rows = state.filtered.map(game => [
        game.appId,
        game.koreanTitle,
        game.genre,
        game.spec,
        game.discount,
        game.currentPrice ?? "",
        game.historicalLowGap ?? "",
        Math.round(getDealScore(game))
    ]);
    const csv = [header, ...rows]
        .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "steam-sale-map.csv";
    anchor.click();
    URL.revokeObjectURL(url);
}

function getHeaderImage(appId) {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

function getCapsuleImage(appId) {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`;
}

function getPrice(game) {
    return Number.isFinite(game.currentPrice) ? game.currentPrice : 999999999;
}

function getCycle(game) {
    return Number.isFinite(game.saleCycleDays) ? game.saleCycleDays : 999999;
}

function formatPrice(value, currency = "KRW") {
    if (!Number.isFinite(value)) return "확인 불가";
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: currency || "KRW", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}
