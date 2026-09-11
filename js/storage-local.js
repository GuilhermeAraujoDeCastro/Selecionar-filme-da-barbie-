// Persistencia do modo visitante: so' digita o nome, sem cadastro, e o
// progresso fica salvo no localStorage do navegador (nao sincroniza entre
// aparelhos, mas funciona na hora, sem depender do Firebase).

const KEY_PREFIX = "barbie-tracker:";
const LAST_GUEST_KEY = "barbie-tracker:last-guest";

function emptyProgress() {
  return { watched: [], ratings: {} };
}

export function loadLocalProgress(profileName) {
  const raw = localStorage.getItem(KEY_PREFIX + profileName);
  if (!raw) {
    return emptyProgress();
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      watched: Array.isArray(parsed.watched) ? parsed.watched : [],
      ratings: typeof parsed.ratings === "object" && parsed.ratings !== null ? parsed.ratings : {},
    };
  } catch {
    return emptyProgress();
  }
}

export function saveLocalProgress(profileName, progress) {
  localStorage.setItem(KEY_PREFIX + profileName, JSON.stringify(progress));
}

export function toggleWatched(progress, movieId) {
  const watched = new Set(progress.watched);
  if (watched.has(movieId)) {
    watched.delete(movieId);
  } else {
    watched.add(movieId);
  }
  return { ...progress, watched: [...watched] };
}

export function setRating(progress, movieId, rating) {
  return { ...progress, ratings: { ...progress.ratings, [movieId]: rating } };
}

// Guarda so' o nome do ultimo visitante que entrou, pra reabrir a sessao
// dele sozinho na proxima visita (sem precisar digitar o nome de novo).
// O progresso em si continua em barbie-tracker:<nome>, isso aqui e so' um
// "lembrete" de qual nome usar.
export function loadLastGuestName() {
  return localStorage.getItem(LAST_GUEST_KEY);
}

export function saveLastGuestName(profileName) {
  localStorage.setItem(LAST_GUEST_KEY, profileName);
}

export function clearLastGuestName() {
  localStorage.removeItem(LAST_GUEST_KEY);
}
