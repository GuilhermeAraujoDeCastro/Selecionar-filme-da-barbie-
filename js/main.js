// Cola tudo (DOM, config, Firebase) nos modulos puros. Esse arquivo aqui
// nao tem teste automatizado (depende do navegador de verdade: DOM,
// localStorage, Firebase), mas toda a logica que ele chama (progress.js,
// filters.js, ratings.js, tmdb.js, storage-local.js, firebase-app.js) foi
// escrita separada exatamente pra poder ser testada sem navegador. Se algo
// der errado aqui, o mais provavel e' um erro de "encanamento" (id errado,
// evento que nao disparou), nao de regra de negocio.

import { calculateProgress, formatProgressLabel } from "./progress.js";
import {
  availableYears,
  filterMovies,
  sortMoviesAlphabetically,
  sortMoviesByYear,
  splitByCompletion,
} from "./filters.js";
import { averageRating, validateRating } from "./ratings.js";
import { searchBarbieMovies } from "./tmdb.js";
import {
  clearLastGuestName,
  loadLastGuestName,
  loadLocalProgress,
  saveLastGuestName,
  saveLocalProgress,
  setRating,
  toggleWatched,
} from "./storage-local.js";

const MOVIES_CACHE_KEY = "barbie-tracker:movies-cache";

const el = {
  configWarning: document.getElementById("config-warning"),
  onboarding: document.getElementById("onboarding"),
  appSection: document.getElementById("app-section"),
  profileName: document.getElementById("profile-name"),
  progressLabel: document.getElementById("progress-label"),
  logoutBtn: document.getElementById("logout-btn"),
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
  movieGrid: document.getElementById("movie-grid"),
  watchedGrid: document.getElementById("watched-grid"),
  filterBtn: document.getElementById("filter-btn"),
  filterSheet: document.getElementById("filter-sheet"),
  sheetOverlay: document.getElementById("sheet-overlay"),
  sheetClose: document.getElementById("sheet-close"),
  bottomNav: document.getElementById("bottom-nav"),
  navBtns: Array.from(document.querySelectorAll(".nav-btn")),
  viewCollection: document.getElementById("view-collection"),
  viewProfile: document.getElementById("view-profile"),
};

const state = {
  profile: null, // { mode: "guest" | "google" | "email", id, name }
  movies: [],
  progress: { watched: [], ratings: {} },
};

let appConfig = null;
let firebaseModule = null;
let firebaseRefs = null; // { app, auth, db }

init();

async function init() {
  appConfig = await loadConfig();

  if (!appConfig || !appConfig.TMDB_API_KEY) {
    el.configWarning.hidden = false;
  }

  if (appConfig && appConfig.FIREBASE_CONFIG) {
    await setUpFirebase(appConfig.FIREBASE_CONFIG);
  } else {
    el.googleLoginBtn.disabled = true;
    el.emailLoginBtn.disabled = true;
    el.emailSignupBtn.disabled = true;
    await tryAutoLoginGuest();
  }

  el.guestForm.addEventListener("submit", handleGuestLogin);
  el.googleLoginBtn.addEventListener("click", handleGoogleLogin);
  el.emailForm.addEventListener("submit", handleEmailLogin);
  el.emailSignupBtn.addEventListener("click", handleEmailSignup);
  el.logoutBtn.addEventListener("click", handleLogout);
  el.searchInput.addEventListener("input", render);
  el.yearFilter.addEventListener("change", render);
  el.onlyUnwatched.addEventListener("change", render);
  el.sortSelect.addEventListener("change", render);
  el.refreshFab.addEventListener("click", () => loadMovies({ forceRefresh: true }));
  el.movieGrid.addEventListener("click", handleGridClick);
  el.watchedGrid.addEventListener("click", handleGridClick);
  el.filterBtn.addEventListener("click", openFilterSheet);
  el.sheetOverlay.addEventListener("click", closeFilterSheet);
  el.sheetClose.addEventListener("click", closeFilterSheet);
  el.navBtns.forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
}

async function loadConfig() {
  try {
    return await import("./config.js");
  } catch {
    return null;
  }
}

async function setUpFirebase(firebaseConfig) {
  try {
    firebaseModule = await import("./firebase-app.js");
    firebaseRefs = firebaseModule.initFirebase(firebaseConfig);
    firebaseModule.watchAuthState(firebaseRefs.auth, (user) => {
      if (user && !state.profile) {
        loginWithFirebaseUser(user, firebaseProviderMode(user));
      } else if (!user && !state.profile) {
        // Ninguem logado com Firebase (ou nunca esteve): tenta reabrir a
        // sessao do ultimo visitante, se tiver uma salva.
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

// Descobre se quem acabou de entrar veio do Google ou de email/senha, so'
// pra guardar o "mode" certo no perfil (nao muda nada em como o progresso
// e' salvo: os dois usam o mesmo Firestore, por uid).
function firebaseProviderMode(user) {
  const providerId = user.providerData[0] && user.providerData[0].providerId;
  return providerId === "google.com" ? "google" : "email";
}

// Reabre a sessao do ultimo visitante sozinho, sem precisar digitar o nome
// de novo a cada recarregamento de pagina. So' age se ninguem ja' entrou
// (por Firebase ou por outro caminho) e se existir um nome de visitante salvo.
async function tryAutoLoginGuest() {
  if (state.profile) {
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

// Traduz os codigos de erro mais comuns do Firebase Auth pra uma mensagem
// que faz sentido em portugues. Codigo que a gente nao mapeou cai numa
// mensagem generica em vez de mostrar o texto tecnico em ingles.
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

async function handleLogout() {
  if (state.profile && state.profile.mode !== "guest" && firebaseModule && firebaseRefs) {
    try {
      await firebaseModule.logout(firebaseRefs.auth);
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
    }
  }
  if (state.profile && state.profile.mode === "guest") {
    clearLastGuestName();
  }
  state.profile = null;
  state.progress = { watched: [], ratings: {} };
  el.appSection.hidden = true;
  el.bottomNav.hidden = true;
  el.filterSheet.hidden = true;
  el.onboarding.hidden = false;
}

async function enterApp() {
  el.onboarding.hidden = true;
  el.appSection.hidden = false;
  el.bottomNav.hidden = false;
  el.profileName.textContent = `Ola, ${state.profile.name}`;
  switchView("collection");
  await loadMovies({ forceRefresh: false });
}

function switchView(view) {
  const isCollection = view === "collection";
  el.viewCollection.hidden = !isCollection;
  el.viewProfile.hidden = isCollection;
  el.refreshFab.hidden = !isCollection;
  el.navBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
}

function openFilterSheet() {
  el.filterSheet.hidden = false;
}

function closeFilterSheet() {
  el.filterSheet.hidden = true;
}

async function loadMovies({ forceRefresh }) {
  if (!forceRefresh) {
    const cached = readMoviesCache();
    if (cached) {
      state.movies = cached;
      populateYearFilter();
      render();
    }
  }

  if (!appConfig || !appConfig.TMDB_API_KEY) {
    if (state.movies.length === 0) {
      showListStatus("Sem chave da TMDB configurada, entao ainda nao da pra buscar os filmes.");
    }
    return;
  }

  if (!forceRefresh && state.movies.length > 0) {
    return;
  }

  showListStatus("Buscando filmes na TMDB...");
  try {
    const movies = await searchBarbieMovies(appConfig.TMDB_API_KEY);
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
  }
}

function readMoviesCache() {
  try {
    const raw = localStorage.getItem(MOVIES_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.movies) ? parsed.movies : null;
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

function render() {
  // So' fica na grade principal quem ainda nao foi assistido+avaliado; o
  // resto ("completed") vai pra lista de assistidos no Perfil.
  const { active, completed } = splitByCompletion(state.movies, state.progress);

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

  const progress = calculateProgress(state.movies, state.progress.watched);
  const avg = averageRating(state.progress.ratings);
  el.progressLabel.textContent =
    avg === null ? formatProgressLabel(progress) : `${formatProgressLabel(progress)} · nota media: ${avg}`;
}

// Lista de assistidos que aparece no Perfil. Reaproveita o mesmo card da
// grade principal (poster, estrelas, checkbox), entao continua dando pra
// mudar a nota ou desmarcar como assistido direto daqui — nesse caso o
// filme volta pra grade principal no proximo render().
function renderWatchedList(completed) {
  if (completed.length === 0) {
    el.watchedGrid.innerHTML =
      '<p class="empty-message">Nenhum filme avaliado ainda. Marca como assistido e da uma nota pra ele aparecer aqui.</p>';
    return;
  }
  const sorted = sortMoviesByYear(completed, "desc");
  el.watchedGrid.innerHTML = sorted.map((movie) => movieCardHtml(movie)).join("");
}

function applySort(movies, sortKey) {
  if (sortKey === "year-desc") {
    return sortMoviesByYear(movies, "desc");
  }
  if (sortKey === "title-asc") {
    return sortMoviesAlphabetically(movies, "asc");
  }
  return sortMoviesByYear(movies, "asc");
}

function movieCardHtml(movie) {
  const watched = state.progress.watched.includes(movie.id);
  const rating = state.progress.ratings[movie.id] || 0;
  const safeTitle = escapeHtml(movie.title);

  const poster = movie.posterPath
    ? `<img class="movie-poster" src="${movie.posterPath}" alt="Poster de ${safeTitle}" loading="lazy" />`
    : `<div class="poster-placeholder"><span>${safeTitle}</span></div>`;

  const stars = [1, 2, 3, 4, 5]
    .map(
      (value) =>
        `<button type="button" class="star${value <= rating ? " filled" : ""}" data-rating="${value}" aria-label="Dar nota ${value}">★</button>`,
    )
    .join("");

  return `
    <article class="movie-card" data-movie-id="${movie.id}">
      ${poster}
      <div class="movie-info">
        <h3>${safeTitle} <span class="movie-year">(${movie.year})</span></h3>
        <label class="watched-label">
          <input type="checkbox" class="watched-checkbox" ${watched ? "checked" : ""} />
          Assistido
        </label>
        <div class="stars">${stars}</div>
      </div>
    </article>
  `;
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
    state.progress = toggleWatched(state.progress, movieId);
    persistProgress();
    render();
  }
}

function persistProgress() {
  if (state.profile.mode === "guest") {
    saveLocalProgress(state.profile.id, state.progress);
  } else if (firebaseModule && firebaseRefs) {
    firebaseModule.saveUserProgress(firebaseRefs.db, state.profile.id, state.progress).catch((error) => {
      console.error("Erro ao salvar progresso no Firestore:", error);
    });
  }
}
