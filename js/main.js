// Cola tudo (DOM, config, Firebase, TMDB) nos modulos puros. Esse arquivo
// aqui nao tem teste automatizado (depende do navegador de verdade: DOM,
// localStorage, Firebase; o fluxo de visitante tem cobertura via Playwright
// em e2e/guest-flow.spec.js), mas toda a logica que ele chama (progress.js,
// filters.js, ratings.js, reviews.js, stats.js, tmdb.js, storage-local.js,
// backup.js, firebase-app.js) foi escrita separada exatamente pra poder ser
// testada sem navegador. Se algo der errado aqui, o mais provavel e' um
// erro de "encanamento" (id errado, evento que nao disparou), nao de regra
// de negocio.

import { calculateProgress, formatProgressLabel } from "./progress.js";
import {
  availableYears,
  filterMovies,
  isMovieUpcoming,
  sortMoviesAlphabetically,
  sortMoviesByRating,
  sortMoviesByYear,
  splitByCompletion,
  splitUpcoming,
} from "./filters.js";
import { averageRating, validateRating } from "./ratings.js";
import { validateReview } from "./reviews.js";
import { fetchGenreMap, fetchMovieDetail, searchBarbieMovies } from "./tmdb.js";
import {
  clearLastGuestName,
  loadLastGuestName,
  loadLocalProgress,
  saveLastGuestName,
  saveLocalProgress,
  setRating,
  setReview,
  toggleWatched,
} from "./storage-local.js";
import { exportProgressPayload, parseImportedProgress } from "./backup.js";
import { averageRatingByDecade, genreCounts, topRatedMovies, yearWithMostWatchedReleases } from "./stats.js";
import { debounce } from "./debounce.js";

// v2: o filme em cache ganhou releaseDate/genres - muda a chave pra quem
// tinha cache antigo buscar de novo em vez de ficar sem essa informacao
// ate clicar em atualizar.
const MOVIES_CACHE_KEY = "barbie-tracker:movies-cache:v3";
const MOVIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DETAIL_CACHE_KEY = "barbie-tracker:detail-cache";
const DETAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GENRE_CACHE_KEY = "barbie-tracker:genre-map";
const THEME_KEY = "barbie-tracker:theme";
const TOUR_KEY = "barbie-tracker:tour-dismissed";
const SHEET_TRANSITION_MS = 240;
const SEARCH_DEBOUNCE_MS = 250;

const el = {
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  configWarning: document.getElementById("config-warning"),
  tourBanner: document.getElementById("tour-banner"),
  tourDismissBtn: document.getElementById("tour-dismiss-btn"),
  onboarding: document.getElementById("onboarding"),
  appSection: document.getElementById("app-section"),
  shareBanner: document.getElementById("share-banner"),
  exitShareBtn: document.getElementById("exit-share-btn"),
  profileName: document.getElementById("profile-name"),
  progressLabel: document.getElementById("progress-label"),
  logoutBtn: document.getElementById("logout-btn"),
  copyShareLinkBtn: document.getElementById("copy-share-link-btn"),
  shareCopyStatus: document.getElementById("share-copy-status"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFileInput: document.getElementById("import-file-input"),
  notifyBtn: document.getElementById("notify-btn"),
  backupError: document.getElementById("backup-error"),
  guestForm: document.getElementById("guest-form"),
  guestNameInput: document.getElementById("guest-name"),
  googleLoginBtn: document.getElementById("google-login-btn"),
  googleLoginError: document.getElementById("google-login-error"),
  emailForm: document.getElementById("email-form"),
  emailInput: document.getElementById("email-input"),
  passwordInput: document.getElementById("password-input"),
  emailLoginBtn: document.getElementById("email-login-btn"),
  emailSignupBtn: document.getElementById("email-signup-btn"),
  emailLoginError: document.getElementById("email-login-error"),
  searchInput: document.getElementById("search-input"),
  yearFilter: document.getElementById("year-filter"),
  onlyUnwatched: document.getElementById("only-unwatched"),
  sortSelect: document.getElementById("sort-select"),
  refreshFab: document.getElementById("refresh-fab"),
  listStatus: document.getElementById("list-status"),
  upcomingSection: document.getElementById("upcoming-section"),
  upcomingGrid: document.getElementById("upcoming-grid"),
  movieGrid: document.getElementById("movie-grid"),
  watchedGrid: document.getElementById("watched-grid"),
  rankingList: document.getElementById("ranking-list"),
  genreStats: document.getElementById("genre-stats"),
  yearStat: document.getElementById("year-stat"),
  decadeStats: document.getElementById("decade-stats"),
  compareSection: document.getElementById("compare-section"),
  compareForm: document.getElementById("compare-form"),
  compareInput: document.getElementById("compare-input"),
  compareResult: document.getElementById("compare-result"),
  filterBtn: document.getElementById("filter-btn"),
  filterSheet: document.getElementById("filter-sheet"),
  sheetOverlay: document.getElementById("sheet-overlay"),
  sheetClose: document.getElementById("sheet-close"),
  detailSheet: document.getElementById("detail-sheet"),
  detailSheetOverlay: document.getElementById("detail-sheet-overlay"),
  detailCloseBtn: document.getElementById("detail-close-btn"),
  detailContent: document.getElementById("detail-content"),
  bottomNav: document.getElementById("bottom-nav"),
  navBtns: Array.from(document.querySelectorAll(".nav-btn")),
  viewCollection: document.getElementById("view-collection"),
  viewProfile: document.getElementById("view-profile"),
};

const state = {
  profile: null, // { mode: "guest" | "google" | "email" | "share", id, name }
  movies: [],
  progress: { watched: [], ratings: {}, reviews: {} },
  readOnly: false, // true quando entrou via link publico (?share=uid)
  genreMap: {},
  detailMovieId: null,
};

// Link publico (?share=uid) tem prioridade sobre qualquer login automatico.
const SHARED_UID = new URLSearchParams(window.location.search).get("share");

let appConfig = null;
let firebaseModule = null;
let firebaseRefs = null; // { app, auth, db }

init();

async function init() {
  initTheme();
  registerServiceWorker();
  appConfig = await loadConfig();

  if (!appConfig || !appConfig.TMDB_API_KEY) {
    el.configWarning.hidden = false;
  }
  if (appConfig && appConfig.SENTRY_DSN) {
    await setUpErrorMonitoring(appConfig.SENTRY_DSN);
  }

  if (appConfig && appConfig.FIREBASE_CONFIG) {
    await setUpFirebase(appConfig.FIREBASE_CONFIG);
  } else {
    el.googleLoginBtn.disabled = true;
    el.emailLoginBtn.disabled = true;
    el.emailSignupBtn.disabled = true;
    await tryAutoLoginGuest();
  }

  maybeShowTourBanner();

  el.themeToggleBtn.addEventListener("click", toggleTheme);
  el.tourDismissBtn.addEventListener("click", dismissTourBanner);
  el.guestForm.addEventListener("submit", handleGuestLogin);
  el.googleLoginBtn.addEventListener("click", handleGoogleLogin);
  el.emailForm.addEventListener("submit", handleEmailLogin);
  el.emailSignupBtn.addEventListener("click", handleEmailSignup);
  el.logoutBtn.addEventListener("click", handleLogout);
  el.exitShareBtn.addEventListener("click", () => {
    window.location.href = window.location.pathname;
  });
  el.copyShareLinkBtn.addEventListener("click", handleCopyShareLink);
  el.exportBtn.addEventListener("click", handleExportProgress);
  el.importBtn.addEventListener("click", () => el.importFileInput.click());
  el.importFileInput.addEventListener("change", handleImportProgress);
  el.notifyBtn.addEventListener("click", handleNotifyClick);
  el.compareForm.addEventListener("submit", handleCompareSubmit);
  el.searchInput.addEventListener("input", debounce(render, SEARCH_DEBOUNCE_MS));
  el.yearFilter.addEventListener("change", render);
  el.onlyUnwatched.addEventListener("change", render);
  el.sortSelect.addEventListener("change", render);
  el.refreshFab.addEventListener("click", () => loadMovies({ forceRefresh: true }));
  [el.movieGrid, el.watchedGrid, el.upcomingGrid].forEach((grid) => {
    grid.addEventListener("click", handleGridClick);
    grid.addEventListener("keydown", handleGridKeydown);
  });
  el.filterBtn.addEventListener("click", openFilterSheet);
  el.sheetOverlay.addEventListener("click", closeFilterSheet);
  el.sheetClose.addEventListener("click", closeFilterSheet);
  el.detailSheetOverlay.addEventListener("click", closeDetailSheet);
  el.detailCloseBtn.addEventListener("click", closeDetailSheet);
  el.detailContent.addEventListener("click", handleDetailClick);
  el.detailContent.addEventListener("input", handleDetailReviewInput);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (!el.filterSheet.hidden) {
      closeFilterSheet();
    }
    if (!el.detailSheet.hidden) {
      closeDetailSheet();
    }
  });
  el.navBtns.forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  el.bottomNav.addEventListener("keydown", handleTabsKeydown);

  await enterShareViewIfRequested();
}

// ---------- tema claro/escuro ----------

// O <head> ja aplicou o tema certo antes da 1a pintura (pra nao piscar);
// aqui so' sincroniza o icone do botao com o que ja esta la.
function initTheme() {
  applyThemeIcon(document.documentElement.dataset.theme === "dark");
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Sem storage disponivel: o tema so' nao sobrevive a um reload.
  }
  applyThemeIcon(dark);
}

function applyThemeIcon(dark) {
  el.themeToggleBtn.textContent = dark ? "☀" : "🌙";
}

// ---------- PWA / tour ----------

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.error("Nao foi possivel registrar o service worker:", error);
  });
}

function maybeShowTourBanner() {
  try {
    if (!localStorage.getItem(TOUR_KEY)) {
      el.tourBanner.hidden = false;
    }
  } catch {
    // Sem storage: so' nao mostra o banner, sem quebrar nada.
  }
}

function dismissTourBanner() {
  el.tourBanner.hidden = true;
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // Ignora - o banner so' volta a aparecer no proximo carregamento.
  }
}

// ---------- config / firebase / sentry ----------

async function loadConfig() {
  try {
    return await import("./config.js");
  } catch {
    return null;
  }
}

// Opcional (so' liga se SENTRY_DSN estiver configurado). Sem bundler,
// entao importa direto do CDN. Falha aqui nunca deve derrubar o app - so'
// fica sem monitoramento.
async function setUpErrorMonitoring(dsn) {
  try {
    const Sentry = await import("https://esm.sh/@sentry/browser@8?bundle");
    Sentry.init({ dsn });
  } catch (error) {
    console.error("Nao foi possivel iniciar o monitoramento de erro:", error);
  }
}

async function setUpFirebase(firebaseConfig) {
  try {
    firebaseModule = await import("./firebase-app.js");
    firebaseRefs = firebaseModule.initFirebase(firebaseConfig);
    firebaseModule.watchAuthState(firebaseRefs.auth, (user) => {
      if (SHARED_UID) {
        return;
      }
      if (user && !state.profile) {
        loginWithFirebaseUser(user, firebaseProviderMode(user));
      } else if (!user && !state.profile) {
        tryAutoLoginGuest();
      }
    });
  } catch (error) {
    console.error("Nao foi possivel iniciar o Firebase:", error);
    el.googleLoginBtn.disabled = true;
    el.emailLoginBtn.disabled = true;
    el.emailSignupBtn.disabled = true;
    el.googleLoginError.hidden = false;
    el.googleLoginError.textContent = "Login com Google indisponivel agora (confira js/config.js).";
    await tryAutoLoginGuest();
  }
}

function firebaseProviderMode(user) {
  const providerId = user.providerData[0] && user.providerData[0].providerId;
  return providerId === "google.com" ? "google" : "email";
}

async function tryAutoLoginGuest() {
  if (state.profile || SHARED_UID) {
    return;
  }
  const lastName = loadLastGuestName();
  if (!lastName) {
    return;
  }
  state.profile = { mode: "guest", id: lastName, name: lastName };
  state.progress = loadLocalProgress(lastName);
  await enterApp();
}

async function handleGuestLogin(event) {
  event.preventDefault();
  const name = el.guestNameInput.value.trim();
  if (!name) {
    return;
  }
  state.profile = { mode: "guest", id: name, name };
  state.progress = loadLocalProgress(name);
  saveLastGuestName(name);
  await enterApp();
}

async function handleGoogleLogin() {
  if (!firebaseModule || !firebaseRefs) {
    return;
  }
  el.googleLoginError.hidden = true;
  try {
    const user = await firebaseModule.loginWithGoogle(firebaseRefs.auth);
    await loginWithFirebaseUser(user, "google");
  } catch (error) {
    console.error("Falha no login com Google:", error);
    el.googleLoginError.hidden = false;
    el.googleLoginError.textContent = "Nao foi possivel entrar com Google. Tente de novo.";
  }
}

async function handleEmailLogin(event) {
  event.preventDefault();
  if (!firebaseModule || !firebaseRefs) {
    return;
  }
  el.emailLoginError.hidden = true;
  const email = el.emailInput.value.trim();
  const password = el.passwordInput.value;
  try {
    const user = await firebaseModule.loginWithEmail(firebaseRefs.auth, email, password);
    await loginWithFirebaseUser(user, "email");
  } catch (error) {
    console.error("Falha no login com email:", error);
    el.emailLoginError.hidden = false;
    el.emailLoginError.textContent = emailErrorMessage(error);
  }
}

async function handleEmailSignup() {
  if (!firebaseModule || !firebaseRefs) {
    return;
  }
  el.emailLoginError.hidden = true;
  const email = el.emailInput.value.trim();
  const password = el.passwordInput.value;
  if (!email || !password) {
    el.emailLoginError.hidden = false;
    el.emailLoginError.textContent = "Preencha email e senha pra criar a conta.";
    return;
  }
  try {
    const user = await firebaseModule.signUpWithEmail(firebaseRefs.auth, email, password);
    await loginWithFirebaseUser(user, "email");
  } catch (error) {
    console.error("Falha ao criar conta:", error);
    el.emailLoginError.hidden = false;
    el.emailLoginError.textContent = emailErrorMessage(error);
  }
}

function emailErrorMessage(error) {
  const messages = {
    "auth/invalid-email": "Email invalido.",
    "auth/missing-password": "Digite uma senha.",
    "auth/weak-password": "Senha muito curta (minimo 6 caracteres).",
    "auth/email-already-in-use": "Ja existe uma conta com esse email. Tenta entrar em vez de criar.",
    "auth/user-not-found": "Nao existe conta com esse email. Tenta criar uma conta.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "Email ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Espera um pouco e tenta de novo.",
  };
  return messages[error && error.code] || "Nao foi possivel completar. Tenta de novo.";
}

async function loginWithFirebaseUser(user, mode) {
  state.profile = { mode, id: user.uid, name: user.displayName || user.email || "sua conta" };
  state.progress = await firebaseModule.loadUserProgress(firebaseRefs.db, user.uid);
  await enterApp();
}

// Link publico somente-leitura: "?share=<uid>" na URL entra direto na
// colecao de outra pessoa, sem login. So funciona se o Firestore tiver a
// regra de leitura publica em progress/{uid} (veja firestore.rules).
async function enterShareViewIfRequested() {
  const sharedUid = SHARED_UID;
  if (!sharedUid || state.profile) {
    return;
  }
  if (!firebaseModule || !firebaseRefs) {
    showListStatus("Este link de colecao compartilhada precisa do Firebase configurado.");
    return;
  }
  state.profile = { mode: "share", id: sharedUid, name: "Colecao compartilhada" };
  state.readOnly = true;
  try {
    state.progress = await firebaseModule.loadUserProgress(firebaseRefs.db, sharedUid);
  } catch (error) {
    console.error("Erro ao carregar colecao compartilhada:", error);
    state.progress = { watched: [], ratings: {}, reviews: {} };
  }
  el.shareBanner.hidden = false;
  el.appSection.classList.add("read-only");
  await enterApp();
}

async function handleLogout() {
  const isRealAccount = state.profile && state.profile.mode !== "guest" && state.profile.mode !== "share";
  if (isRealAccount && firebaseModule && firebaseRefs) {
    try {
      await firebaseModule.logout(firebaseRefs.auth);
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
    }
  }
  // Sempre esquece o visitante salvo: sair de uma conta nao pode cair num visitante antigo.
  clearLastGuestName();
  state.profile = null;
  state.progress = { watched: [], ratings: {}, reviews: {} };
  state.readOnly = false;
  state.detailMovieId = null;
  el.appSection.classList.remove("read-only");
  el.shareBanner.hidden = true;
  el.appSection.hidden = true;
  el.bottomNav.hidden = true;
  el.filterSheet.hidden = true;
  el.filterSheet.classList.remove("open");
  el.detailSheet.hidden = true;
  el.detailSheet.classList.remove("open");
  el.onboarding.hidden = false;
}

async function enterApp() {
  el.onboarding.hidden = true;
  el.appSection.hidden = false;
  el.bottomNav.hidden = false;
  el.profileName.textContent = state.readOnly ? "Colecao compartilhada" : `Ola, ${state.profile.name}`;
  updateProfileActionsVisibility();
  switchView("collection");
  await ensureGenreMap();
  await loadMovies({ forceRefresh: false });
}

function updateProfileActionsVisibility() {
  const isGuest = state.profile.mode === "guest";
  const isShare = state.profile.mode === "share";
  el.exportBtn.hidden = isShare;
  el.importBtn.hidden = isShare;
  el.copyShareLinkBtn.hidden = isShare || isGuest;
  el.compareSection.hidden = isShare || isGuest;
  el.notifyBtn.hidden = isShare || isGuest || !pushNotificationsAvailable();
}

function pushNotificationsAvailable() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(appConfig && appConfig.VAPID_PUBLIC_KEY) &&
    Boolean(firebaseModule && firebaseRefs)
  );
}

// ---------- abas (Colecao/Perfil) ----------

function switchView(view) {
  const isCollection = view === "collection";
  el.viewCollection.hidden = !isCollection;
  el.viewProfile.hidden = isCollection;
  el.refreshFab.hidden = !isCollection;
  el.navBtns.forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
  });
}

// Navegacao por seta esquerda/direita entre as abas - padrao WAI-ARIA pra
// um role="tablist" (o Tab do teclado ja funcionava antes, isso so'
// adiciona o jeito "nativo" de mover entre abas do mesmo grupo).
function handleTabsKeydown(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  event.preventDefault();
  const currentIndex = el.navBtns.findIndex((btn) => btn.classList.contains("active"));
  const delta = event.key === "ArrowRight" ? 1 : -1;
  const nextBtn = el.navBtns[(currentIndex + delta + el.navBtns.length) % el.navBtns.length];
  nextBtn.focus();
  switchView(nextBtn.dataset.view);
}

// ---------- paineis deslizantes (filtros + ficha do filme) ----------

function openSheet(sheetEl) {
  sheetEl.hidden = false;
  requestAnimationFrame(() => sheetEl.classList.add("open"));
}

function closeSheet(sheetEl) {
  sheetEl.classList.remove("open");
  setTimeout(() => {
    sheetEl.hidden = true;
  }, SHEET_TRANSITION_MS);
}

function openFilterSheet() {
  openSheet(el.filterSheet);
  el.filterBtn.setAttribute("aria-expanded", "true");
}

function closeFilterSheet() {
  closeSheet(el.filterSheet);
  el.filterBtn.setAttribute("aria-expanded", "false");
}

function closeDetailSheet() {
  closeSheet(el.detailSheet);
  state.detailMovieId = null;
}

// ---------- busca dos filmes na TMDB ----------

async function ensureGenreMap() {
  if (!appConfig || !appConfig.TMDB_API_KEY) {
    return;
  }
  try {
    const raw = localStorage.getItem(GENRE_CACHE_KEY);
    if (raw) {
      state.genreMap = JSON.parse(raw);
      return;
    }
  } catch {
    // Cache corrompido: busca de novo abaixo.
  }
  try {
    state.genreMap = await fetchGenreMap(appConfig.TMDB_API_KEY);
    localStorage.setItem(GENRE_CACHE_KEY, JSON.stringify(state.genreMap));
  } catch (error) {
    console.error("Nao foi possivel buscar os generos da TMDB:", error);
  }
}

async function loadMovies({ forceRefresh }) {
  let usedCache = false;
  if (!forceRefresh) {
    const cached = readMoviesCache();
    if (cached) {
      state.movies = cached.movies;
      usedCache = true;
      populateYearFilter();
      render();
      if (!cached.stale) {
        return;
      }
      // Cache valida mas vencida (item 16): mostra na hora e busca de novo
      // por baixo dos panos, sem esperar clique manual no refresh.
    }
  }

  if (!appConfig || !appConfig.TMDB_API_KEY) {
    if (state.movies.length === 0) {
      showListStatus("Sem chave da TMDB configurada, entao ainda nao da pra buscar os filmes.");
    }
    return;
  }

  if (!usedCache) {
    el.movieGrid.innerHTML = skeletonGridHtml();
    showListStatus("Buscando filmes na TMDB...");
  }
  try {
    const movies = await searchBarbieMovies(appConfig.TMDB_API_KEY, fetch, state.genreMap);
    state.movies = movies;
    saveMoviesCache(movies);
    populateYearFilter();
    hideListStatus();
    render();
  } catch (error) {
    console.error("Erro ao buscar filmes na TMDB:", error);
    showListStatus(
      state.movies.length > 0
        ? "Nao deu pra atualizar agora. Mostrando a ultima lista salva."
        : "Nao deu pra buscar os filmes na TMDB agora. Confira sua chave e sua conexao.",
    );
    if (state.movies.length === 0) {
      el.movieGrid.innerHTML = "";
    }
  }
}

// Placeholders com "brilho" enquanto a TMDB nao responde, no lugar de tela
// em branco - so' aparece na 1a busca (sem cache ainda).
function skeletonGridHtml(count = 6) {
  return Array.from({ length: count })
    .map(
      () => `
        <div class="skeleton-card">
          <div class="skeleton-cover"></div>
          <div class="skeleton-line" style="width: 70%"></div>
          <div class="skeleton-line" style="width: 40%"></div>
        </div>
      `,
    )
    .join("");
}

function readMoviesCache() {
  try {
    const raw = localStorage.getItem(MOVIES_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.movies)) {
      return null;
    }
    return { movies: parsed.movies, stale: Date.now() - parsed.fetchedAt > MOVIES_CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function saveMoviesCache(movies) {
  try {
    localStorage.setItem(MOVIES_CACHE_KEY, JSON.stringify({ movies, fetchedAt: Date.now() }));
  } catch (error) {
    console.error("Nao deu pra salvar o cache dos filmes:", error);
  }
}

function populateYearFilter() {
  const years = availableYears(state.movies);
  const previousValue = el.yearFilter.value;
  el.yearFilter.innerHTML =
    '<option value="">Todos</option>' + years.map((year) => `<option value="${year}">${year}</option>`).join("");
  el.yearFilter.value = years.some((year) => String(year) === previousValue) ? previousValue : "";
}

function showListStatus(message) {
  el.listStatus.hidden = false;
  el.listStatus.textContent = message;
}

function hideListStatus() {
  el.listStatus.hidden = true;
}

// ---------- render ----------

function render() {
  // splitUpcoming tira filme anunciado mas ainda sem estrear (releaseDate
  // no futuro) do calculo de progresso - ele vai pra "Em breve" em vez de
  // contar como "deixado de assistir".
  const { released, upcoming } = splitUpcoming(state.movies);
  renderUpcoming(upcoming);

  // So' fica na grade principal quem ainda nao foi assistido+avaliado; o
  // resto ("completed") vai pra lista de assistidos no Perfil.
  const { active, completed } = splitByCompletion(released, state.progress);

  const filtered = filterMovies(active, {
    search: el.searchInput.value,
    year: el.yearFilter.value ? Number(el.yearFilter.value) : null,
    onlyUnwatched: el.onlyUnwatched.checked,
    watchedIds: state.progress.watched,
  });
  const sorted = applySort(filtered, el.sortSelect.value);

  el.movieGrid.innerHTML =
    sorted.length > 0
      ? sorted.map((movie) => movieCardHtml(movie)).join("")
      : '<p class="empty-message">Nenhum filme encontrado com esses filtros.</p>';

  renderWatchedList(completed);

  const progress = calculateProgress(released, state.progress.watched);
  const avg = averageRating(state.progress.ratings);
  el.progressLabel.textContent =
    avg === null ? formatProgressLabel(progress) : `${formatProgressLabel(progress)} · nota media: ${avg}`;

  renderStats(released);
}

function renderUpcoming(upcoming) {
  el.upcomingSection.hidden = upcoming.length === 0;
  el.upcomingGrid.innerHTML = sortMoviesByYear(upcoming, "asc")
    .map((movie) => movieCardHtml(movie, { upcoming: true }))
    .join("");
}

// Lista de assistidos que aparece no Perfil. Reaproveita o mesmo card da
// grade principal (poster, estrelas, checkbox) - clicar nele ainda abre a
// ficha, e desmarcar "assistido" la' dentro devolve o filme pra grade
// principal no proximo render().
function renderWatchedList(completed) {
  if (completed.length === 0) {
    el.watchedGrid.innerHTML =
      '<p class="empty-message">Nenhum filme avaliado ainda. Marca como assistido e da uma nota pra ele aparecer aqui.</p>';
    return;
  }
  const sorted = sortMoviesByYear(completed, "desc");
  el.watchedGrid.innerHTML = sorted.map((movie) => movieCardHtml(movie)).join("");
}

function renderStats(releasedMovies) {
  const ranked = topRatedMovies(releasedMovies, state.progress, 10);
  el.rankingList.innerHTML =
    ranked.length > 0
      ? ranked
          .map(
            (movie, index) =>
              `<li class="ranking-item"><span>${index + 1}. ${escapeHtml(movie.title)}</span><span class="ranking-rating">${"★".repeat(movie.rating)}</span></li>`,
          )
          .join("")
      : '<li class="ranking-item">Ainda sem filmes avaliados.</li>';

  el.genreStats.innerHTML = statBarsHtml(genreCounts(releasedMovies, state.progress));

  const topYear = yearWithMostWatchedReleases(releasedMovies, state.progress);
  el.yearStat.textContent = topYear
    ? `Ano com mais lancamentos assistidos: ${topYear.year} (${topYear.count} filme${topYear.count > 1 ? "s" : ""}).`
    : "Ainda sem dados suficientes pra saber seu ano favorito.";

  el.decadeStats.innerHTML = statBarsHtml(averageRatingByDecade(releasedMovies, state.progress), { maxValue: 5 });
}

// Barra de progresso simples em CSS puro (sem lib de grafico) pra cada
// entrada de um {chave: numero}. Sem maxValue, usa o maior valor do
// proprio conjunto (bom pra contagem); com maxValue fixo (ex.: 5, pra nota
// media), a barra fica proporcional a esse teto em vez do maior valor.
function statBarsHtml(counts, { maxValue } = {}) {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return '<p class="stat-note">Sem dados ainda.</p>';
  }
  const max = maxValue || Math.max(...entries.map(([, value]) => value));
  return entries
    .map(([key, value]) => {
      const percent = Math.round((value / max) * 100);
      return `
        <div class="stat-bar-row">
          <span>${escapeHtml(key)}</span>
          <span class="stat-bar-track"><span class="stat-bar-fill" style="width: ${percent}%"></span></span>
          <span>${value}</span>
        </div>
      `;
    })
    .join("");
}

function applySort(movies, sortKey) {
  if (sortKey === "year-desc") {
    return sortMoviesByYear(movies, "desc");
  }
  if (sortKey === "title-asc") {
    return sortMoviesAlphabetically(movies, "asc");
  }
  if (sortKey === "rating-desc") {
    return sortMoviesByRating(movies, state.progress.ratings, "desc");
  }
  return sortMoviesByYear(movies, "asc");
}

function movieCardHtml(movie, { upcoming = false } = {}) {
  const watched = state.progress.watched.includes(movie.id);
  const rating = state.progress.ratings[movie.id] || 0;
  const safeTitle = escapeHtml(movie.title);

  const poster = movie.posterPath
    ? `<img class="movie-poster" src="${movie.posterPath}" alt="Poster de ${safeTitle}" loading="lazy" />`
    : `<div class="poster-placeholder"><span>${safeTitle}</span></div>`;

  const controls = upcoming
    ? `<span class="badge-upcoming">Em breve</span>`
    : `
      <label class="watched-label">
        <input type="checkbox" class="watched-checkbox" ${watched ? "checked" : ""} />
        Assistido
      </label>
      <div class="stars">${starsHtml(rating)}</div>
    `;

  return `
    <article class="movie-card" data-movie-id="${movie.id}" tabindex="0" aria-label="${safeTitle}, abrir ficha">
      ${poster}
      <div class="movie-info">
        <h3>${safeTitle} <span class="movie-year">(${movie.year})</span></h3>
        ${controls}
      </div>
    </article>
  `;
}

function starsHtml(rating) {
  return [1, 2, 3, 4, 5]
    .map(
      (value) =>
        `<button type="button" class="star${value <= rating ? " filled" : ""}" data-rating="${value}" aria-label="Dar nota ${value}">★</button>`,
    )
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function handleGridClick(event) {
  const card = event.target.closest(".movie-card");
  if (!card || !state.profile) {
    return;
  }
  const movieId = Number(card.dataset.movieId);

  if (event.target.matches(".star")) {
    if (state.readOnly) {
      return;
    }
    const validated = validateRating(event.target.dataset.rating);
    if (validated === null) {
      return;
    }
    state.progress = setRating(state.progress, movieId, validated);
    persistProgress();
    render();
    return;
  }

  if (event.target.matches(".watched-checkbox")) {
    if (state.readOnly) {
      return;
    }
    state.progress = toggleWatched(state.progress, movieId);
    persistProgress();
    render();
    return;
  }

  // Clique no texto do label ou no espaco entre estrelas: deixa o proprio
  // controle cuidar (o <label> so' repassa o clique pro checkbox), sem
  // tambem abrir a ficha por baixo. O selo "Em breve" nao tem controle
  // nenhum pra proteger, entao clicar nele tambem abre a ficha normalmente.
  if (event.target.closest(".watched-label") || event.target.closest(".stars")) {
    return;
  }

  const movie = state.movies.find((candidate) => candidate.id === movieId);
  if (movie) {
    openDetailSheet(movie);
  }
}

// Enter ou espaco no card focado abre a ficha (acessibilidade por teclado).
function handleGridKeydown(event) {
  if ((event.key !== "Enter" && event.key !== " ") || !event.target.matches(".movie-card")) {
    return;
  }
  event.preventDefault();
  const movie = state.movies.find((candidate) => candidate.id === Number(event.target.dataset.movieId));
  if (movie) {
    openDetailSheet(movie);
  }
}

// ---------- ficha do filme (sinopse, elenco, duracao, resenha) ----------

async function openDetailSheet(movie) {
  state.detailMovieId = movie.id;
  renderDetailContent();
  openSheet(el.detailSheet);
  el.detailCloseBtn.focus();

  if (!appConfig || !appConfig.TMDB_API_KEY) {
    return;
  }
  try {
    const detail = await getMovieDetail(movie.id);
    if (state.detailMovieId !== movie.id) {
      return; // fechou ou trocou de filme antes da resposta chegar
    }
    movie.detail = detail;
    renderDetailContent();
  } catch (error) {
    console.error("Erro ao buscar detalhes do filme na TMDB:", error);
  }
}

async function getMovieDetail(movieId) {
  const cached = readDetailCache(movieId);
  if (cached) {
    return cached;
  }
  const detail = await fetchMovieDetail(movieId, appConfig.TMDB_API_KEY);
  saveDetailCache(movieId, detail);
  return detail;
}

function readDetailCache(movieId) {
  try {
    const all = JSON.parse(localStorage.getItem(DETAIL_CACHE_KEY) || "{}");
    const entry = all[movieId];
    if (entry && Date.now() - entry.fetchedAt < DETAIL_CACHE_TTL_MS) {
      return entry.detail;
    }
  } catch {
    // Cache corrompido: busca de novo.
  }
  return null;
}

function saveDetailCache(movieId, detail) {
  try {
    const all = JSON.parse(localStorage.getItem(DETAIL_CACHE_KEY) || "{}");
    all[movieId] = { detail, fetchedAt: Date.now() };
    localStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Nao deu pra salvar cache do detalhe:", error);
  }
}

function renderDetailContent() {
  const movie = state.movies.find((candidate) => candidate.id === state.detailMovieId);
  if (!movie) {
    return;
  }
  el.detailContent.innerHTML = detailContentHtml(movie);
}

function detailContentHtml(movie) {
  const detail = movie.detail || null;
  const watched = state.progress.watched.includes(movie.id);
  const rating = state.progress.ratings[movie.id] || 0;
  const review = state.progress.reviews[movie.id] || "";
  const safeTitle = escapeHtml(movie.title);

  const poster = movie.posterPath ? `<img class="detail-poster" src="${movie.posterPath}" alt="Poster de ${safeTitle}" />` : "";
  const runtimeText = detail && detail.runtime ? `${detail.runtime} min` : "Duracao nao informada";
  const genresText = movie.genres && movie.genres.length > 0 ? movie.genres.join(", ") : "Genero nao informado";
  const overviewText = (detail && detail.overview) || movie.overview || "Sinopse nao disponivel.";
  const castText = detail && detail.cast && detail.cast.length > 0 ? detail.cast.join(", ") : null;

  const controls = isMovieUpcoming(movie)
    ? `<span class="badge-upcoming">Em breve</span>`
    : `
      <label class="watched-label">
        <input type="checkbox" class="watched-checkbox" ${watched ? "checked" : ""} />
        Assistido
      </label>
      <div class="stars">${starsHtml(rating)}</div>
      <div class="review-field">
        <label for="review-textarea">Sua resenha</label>
        <textarea id="review-textarea" maxlength="500" placeholder="O que voce achou desse filme?" ${state.readOnly ? "disabled" : ""}>${escapeHtml(review)}</textarea>
        <p class="review-hint">Salva sozinha enquanto voce digita.</p>
      </div>
    `;

  return `
    ${poster}
    <h3>${safeTitle} <span class="movie-year">(${movie.year})</span></h3>
    <p class="detail-meta">${runtimeText} · ${escapeHtml(genresText)}</p>
    <p class="detail-overview">${escapeHtml(overviewText)}</p>
    ${castText ? `<p class="detail-cast"><strong>Elenco:</strong> ${escapeHtml(castText)}</p>` : ""}
    ${controls}
  `;
}

function handleDetailClick(event) {
  if (state.readOnly || !state.detailMovieId) {
    return;
  }
  const movieId = state.detailMovieId;

  if (event.target.matches(".star")) {
    const validated = validateRating(event.target.dataset.rating);
    if (validated === null) {
      return;
    }
    state.progress = setRating(state.progress, movieId, validated);
    persistProgress();
    renderDetailContent();
    render();
    return;
  }

  if (event.target.matches(".watched-checkbox")) {
    state.progress = toggleWatched(state.progress, movieId);
    persistProgress();
    renderDetailContent();
    render();
  }
}

const saveReviewDebounced = debounce((movieId, text) => {
  const validated = validateReview(text);
  if (validated === null) {
    return;
  }
  state.progress = setReview(state.progress, movieId, validated);
  persistProgress();
}, 400);

function handleDetailReviewInput(event) {
  if (state.readOnly || !state.detailMovieId || event.target.id !== "review-textarea") {
    return;
  }
  saveReviewDebounced(state.detailMovieId, event.target.value);
}

function persistProgress() {
  if (state.readOnly) {
    return; // seguranca extra: nunca grava em cima de uma colecao compartilhada
  }
  if (state.profile.mode === "guest") {
    saveLocalProgress(state.profile.id, state.progress);
  } else if (firebaseModule && firebaseRefs) {
    firebaseModule.saveUserProgress(firebaseRefs.db, state.profile.id, state.progress).catch((error) => {
      console.error("Erro ao salvar progresso no Firestore:", error);
    });
  }
}

// ---------- link publico + comparar colecoes ----------

async function handleCopyShareLink() {
  const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(state.profile.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    showShareCopyStatus("Link copiado!");
  } catch (error) {
    console.error("Nao foi possivel copiar o link automaticamente:", error);
    showShareCopyStatus(url);
  }
}

function showShareCopyStatus(message) {
  el.shareCopyStatus.hidden = false;
  el.shareCopyStatus.textContent = message;
}

async function handleCompareSubmit(event) {
  event.preventDefault();
  el.compareResult.hidden = false;
  if (!firebaseModule || !firebaseRefs) {
    el.compareResult.textContent = "Comparacao precisa do Firebase configurado.";
    return;
  }
  const uid = extractShareId(el.compareInput.value);
  if (!uid) {
    el.compareResult.textContent = "Cole um link ou codigo valido.";
    return;
  }
  el.compareResult.textContent = "Comparando...";
  try {
    const otherProgress = await firebaseModule.loadUserProgress(firebaseRefs.db, uid);
    const mine = new Set(state.progress.watched.filter((id) => state.progress.ratings[id]));
    const theirs = new Set(otherProgress.watched.filter((id) => otherProgress.ratings[id]));
    const commonIds = [...mine].filter((id) => theirs.has(id));
    const titles = commonIds
      .map((id) => state.movies.find((movie) => movie.id === id))
      .filter(Boolean)
      .map((movie) => escapeHtml(movie.title));
    el.compareResult.innerHTML =
      commonIds.length > 0
        ? `<strong>${commonIds.length} filme(s) em comum:</strong> ${titles.join(", ")}`
        : "Nenhum filme avaliado em comum ainda.";
  } catch (error) {
    console.error("Erro ao comparar colecoes:", error);
    el.compareResult.textContent = "Nao foi possivel carregar essa colecao. Confira o link/codigo.";
  }
}

// Aceita tanto o link inteiro ("https://...?share=abc123") quanto so' o
// codigo ("abc123") colado direto - facilita quem recebeu so' o uid por
// mensagem em vez do link completo.
function extractShareId(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("share") || null;
  } catch {
    return trimmed;
  }
}

// ---------- import/export do progresso ----------

function handleExportProgress() {
  const payload = exportProgressPayload(state.profile, state.progress);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `barbie-movies-tracker-${state.profile.name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleImportProgress(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || state.readOnly) {
    return;
  }
  el.backupError.hidden = true;
  const text = await file.text();
  const imported = parseImportedProgress(text);
  if (!imported) {
    el.backupError.hidden = false;
    el.backupError.textContent = "Esse arquivo nao parece um backup valido do Barbie Movies Tracker.";
    return;
  }
  state.progress = imported;
  persistProgress();
  render();
}

// ---------- notificacoes push (item 13) ----------

async function handleNotifyClick() {
  if (!pushNotificationsAvailable() || state.readOnly) {
    return;
  }
  el.notifyBtn.disabled = true;
  el.notifyBtn.textContent = "Ativando...";
  try {
    // navigator.serviceWorker.ready nunca resolve se o registro do service
    // worker falhou (veja registerServiceWorker) - a corrida com timeout
    // evita o botao ficar preso "Ativando..." pra sempre nesse caso.
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve, reject) => setTimeout(() => reject(new Error("Service worker nao respondeu a tempo.")), 5000)),
    ]);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(appConfig.VAPID_PUBLIC_KEY),
    });
    await firebaseModule.savePushSubscription(firebaseRefs.db, state.profile.id, subscription.toJSON());
    el.notifyBtn.textContent = "Notificacoes ativadas";
  } catch (error) {
    console.error("Nao foi possivel ativar as notificacoes:", error);
    el.notifyBtn.textContent = "Nao foi possivel ativar agora";
    el.notifyBtn.disabled = false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
