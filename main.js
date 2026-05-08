const state = {
    games: [],
    filtered: [],
    search: "",
    genre: "all",
    mode: "all",
    spec: "all",
    sort: "dealScore",
    tag: "all"
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

const quickTags = ["all", "협동", "저사양", "로그라이크", "생존", "힐링", "RPG", "액션", "시뮬레이션"];

init();

async function init() {
    document.getElementById("todayDate").textContent = new Date().toLocaleDateString("ko-KR");

    try {
        const res = await fetch("games.json");
        state.games = await res.json();
    } catch {
        state.games = [];
    }

    setupFilters();
    setupEvents();
    applyFilters();
}

function setupFilters() {
    const genres = [...new Set(state.games.map(game => game.genre))].sort();
    genres.forEach(genre => {
        const option = document.createElement("option");
        option.value = genre;
        option.textContent = genre;
        els.genre.appendChild(option);
    });

    els.quickTags.innerHTML = quickTags.map(tag => `
        <button class="tag-btn ${tag === "all" ? "active" : ""}" data-tag="${tag}">
            ${tag === "all" ? "전체" : tag}
        </button>
    `).join("");

    document.getElementById("gameCount").textContent = `${state.games.length}개`;
    updateSummary(state.games);
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
        document.querySelectorAll(".tag-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tag === state.tag);
        });

        applyFilters();
    });

    document.querySelectorAll("[data-preset]").forEach(button => {
        button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });

    document.getElementById("randomPickBtn").addEventListener("click", pickRandomGame);

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
        result = result.filter(game => {
            const searchBase = [
                game.title,
                game.koreanTitle,
                game.short,
                game.genre,
                game.spec,
                ...game.tags,
                ...game.mode
            ].join(" ").toLowerCase();

            return searchBase.includes(state.search);
        });
    }

    if (state.genre !== "all") {
        result = result.filter(game => game.genre === state.genre);
    }

    if (state.mode !== "all") {
        result = result.filter(game => game.mode.includes(state.mode));
    }

    if (state.spec !== "all") {
        result = result.filter(game => game.spec === state.spec);
    }

    if (state.tag !== "all") {
        result = result.filter(game => game.tags.includes(state.tag) || game.genre === state.tag || game.mode.includes(state.tag));
    }

    result.sort(sortGames);
    state.filtered = result;
    renderGames(result);
    updateSummary(result);
}

function sortGames(a, b) {
    if (state.sort === "discount") return b.discount - a.discount;
    if (state.sort === "priceAsc") return a.currentPrice - b.currentPrice;
    if (state.sort === "cycle") return getAverageSaleCycle(a) - getAverageSaleCycle(b);
    if (state.sort === "title") return a.koreanTitle.localeCompare(b.koreanTitle, "ko");
    return getDealScore(b) - getDealScore(a);
}

function renderGames(games) {
    els.grid.innerHTML = games.map(game => renderGameCard(game)).join("");
    els.empty.classList.toggle("active", games.length === 0);
}

function renderGameCard(game) {
    const advice = getBuyAdvice(game);
    const cycle = getAverageSaleCycle(game);
    const nearLow = getHistoricalLowGap(game);

    return `
        <article class="game-card">
            <img class="game-img" src="${game.image}" alt="${game.koreanTitle}">
            <div class="game-body">
                <div class="game-title-row">
                    <div>
                        <h3>${game.koreanTitle}</h3>
                        <small>${game.title}</small>
                    </div>
                    <span class="discount">-${game.discount}%</span>
                </div>

                <p class="desc">${game.short}</p>

                <div class="price-row">
                    <div>
                        <div class="current-price">${formatWon(game.currentPrice)}</div>
                        <div class="normal-price">${formatWon(game.normalPrice)}</div>
                    </div>
                    <span class="advice ${advice.type}">${advice.text}</span>
                </div>

                <div class="meta-grid">
                    <div class="meta-box">
                        <span>평균 할인 주기</span>
                        <strong>${cycle}일</strong>
                    </div>
                    <div class="meta-box">
                        <span>역대 최저가 차이</span>
                        <strong>${nearLow}%</strong>
                    </div>
                    <div class="meta-box">
                        <span>할인 종료</span>
                        <strong>${formatDate(game.saleEnds)}</strong>
                    </div>
                    <div class="meta-box">
                        <span>사양</span>
                        <strong>${game.spec}</strong>
                    </div>
                </div>

                <div class="tags">
                    ${game.tags.slice(0, 5).map(tag => `<span class="tag">${tag}</span>`).join("")}
                </div>

                <div class="card-actions">
                    <a href="https://store.steampowered.com/app/${game.appId}" target="_blank" rel="noopener">Steam 이동</a>
                    <button data-detail="${game.appId}">자세히</button>
                </div>
            </div>
        </article>
    `;
}

function getDealScore(game) {
    const discountScore = game.discount * 1.8;
    const lowGapScore = Math.max(0, 40 - getHistoricalLowGap(game));
    const cycleScore = Math.max(0, 30 - getAverageSaleCycle(game) / 5);
    const priceScore = game.currentPrice <= 10000 ? 18 : game.currentPrice <= 20000 ? 10 : 4;

    return discountScore + lowGapScore + cycleScore + priceScore;
}

function getBuyAdvice(game) {
    const lowGap = getHistoricalLowGap(game);

    if (game.discount >= 70 && lowGap <= 10) {
        return { text: "지금 사도 좋음", type: "good" };
    }

    if (game.discount >= 50 && lowGap <= 25) {
        return { text: "괜찮은 할인", type: "warn" };
    }

    if (game.discount >= 30) {
        return { text: "취향이면 구매", type: "warn" };
    }

    return { text: "기다리기", type: "wait" };
}

function getAverageSaleCycle(game) {
    if (!game.saleHistory || game.saleHistory.length < 2) return 999;

    const dates = game.saleHistory
        .map(date => new Date(date))
        .sort((a, b) => a - b);

    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
        const gap = Math.round((dates[i] - dates[i - 1]) / 86400000);
        gaps.push(gap);
    }

    return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

function getHistoricalLowGap(game) {
    if (!game.historicalLow || game.historicalLow <= 0) return 999;
    return Math.max(0, Math.round(((game.currentPrice - game.historicalLow) / game.historicalLow) * 100));
}

function updateSummary(games) {
    document.getElementById("saleCount").textContent = games.filter(game => game.discount > 0).length;
    document.getElementById("bigSaleCount").textContent = games.filter(game => game.discount >= 70).length;
    document.getElementById("lowSpecCount").textContent = games.filter(game => game.spec === "저사양").length;
    document.getElementById("coopCount").textContent = games.filter(game => game.mode.includes("협동")).length;
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

    document.querySelectorAll(".tag-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tag === state.tag);
    });

    applyFilters();
    document.getElementById("deals").scrollIntoView({ behavior: "smooth" });
}

function pickRandomGame() {
    const source = state.filtered.length ? state.filtered : state.games;
    const game = source[Math.floor(Math.random() * source.length)];
    if (!game) return;

    state.search = game.koreanTitle.toLowerCase();
    els.search.value = game.koreanTitle;
    applyFilters();
    document.getElementById("deals").scrollIntoView({ behavior: "smooth" });
}

function openModal(appId) {
    const game = state.games.find(item => item.appId === appId);
    if (!game) return;

    const advice = getBuyAdvice(game);

    els.modalContent.innerHTML = `
        <div class="modal-content">
            <img class="modal-hero" src="${game.image}" alt="${game.koreanTitle}">
            <p class="eyebrow">${game.genre} · ${game.spec}</p>
            <h2>${game.koreanTitle}</h2>
            <p class="desc">${game.short}</p>

            <div class="meta-grid">
                <div class="meta-box">
                    <span>현재 가격</span>
                    <strong>${formatWon(game.currentPrice)}</strong>
                </div>
                <div class="meta-box">
                    <span>정가</span>
                    <strong>${formatWon(game.normalPrice)}</strong>
                </div>
                <div class="meta-box">
                    <span>할인율</span>
                    <strong>${game.discount}%</strong>
                </div>
                <div class="meta-box">
                    <span>판단</span>
                    <strong>${advice.text}</strong>
                </div>
            </div>

            <h3>최근 할인 기록</h3>
            <div class="history-list">
                ${game.saleHistory.map((date, index) => `
                    <div class="history-item">
                        <span>${index + 1}회차 할인</span>
                        <strong>${formatDate(date)}</strong>
                    </div>
                `).join("")}
            </div>

            <div class="card-actions" style="margin-top:18px">
                <a href="https://store.steampowered.com/app/${game.appId}" target="_blank" rel="noopener">Steam에서 보기</a>
                <button data-close="modal">닫기</button>
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

function formatWon(value) {
    return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0
    }).format(value);
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric"
    });
}
