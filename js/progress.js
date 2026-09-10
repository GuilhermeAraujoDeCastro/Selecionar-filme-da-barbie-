// Calcula o progresso de quantos filmes ja foram assistidos. Funcao pura:
// so olha pra listas que recebe, nunca le Firestore/localStorage direto,
// pra dar pra testar sem simular banco nenhum.

export function calculateProgress(movies, watchedIds) {
  const total = movies.length;
  const watchedSet = new Set(watchedIds);
  const watched = movies.filter((movie) => watchedSet.has(movie.id)).length;
  const percent = total === 0 ? 0 : Math.round((watched / total) * 100);
  return { watched, total, percent };
}

export function formatProgressLabel(progress) {
  return `${progress.watched} de ${progress.total} — ${progress.percent}%`;
}
