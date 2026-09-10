// Persistencia do modo visitante: so' digita o nome, sem cadastro, e o
// progresso fica salvo no localStorage do navegador (nao sincroniza entre
// aparelhos, mas funciona na hora, sem depender do Firebase).

const KEY_PREFIX = "barbie-tracker:";

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
