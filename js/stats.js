// Estatisticas do Perfil (genero mais assistido, ano com mais lancamentos
// assistidos, nota media por decada, ranking pessoal). Funcoes puras, mesmo
// estilo de filters.js/progress.js: recebem filmes + progresso, nunca tocam
// em DOM/storage.

function watchedMovies(movies, progress) {
  const watchedSet = new Set(progress.watched);
  return movies.filter((movie) => watchedSet.has(movie.id));
}

export function topRatedMovies(movies, progress, limit = 10) {
  const ratings = progress.ratings || {};
  return movies
    .filter((movie) => typeof ratings[movie.id] === "number" && ratings[movie.id] > 0)
    .map((movie) => ({ ...movie, rating: ratings[movie.id] }))
    .sort((a, b) => b.rating - a.rating || b.year - a.year || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, limit);
}

// {nome do genero: quantidade assistida}, so' com generos que tem pelo
// menos 1 filme (pra nao poluir a barra de estatistica com zero).
export function genreCounts(movies, progress) {
  const counts = {};
  for (const movie of watchedMovies(movies, progress)) {
    for (const genre of movie.genres || []) {
      counts[genre] = (counts[genre] || 0) + 1;
    }
  }
  return counts;
}

// O genero com mais filmes assistidos; null se nao tiver nenhum filme
// assistido com genero conhecido (cache antigo, sem genreIds ainda).
export function mostWatchedGenre(movies, progress) {
  const counts = genreCounts(movies, progress);
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return null;
  }
  const [genre, count] = entries.sort((a, b) => b[1] - a[1])[0];
  return { genre, count };
}

// O ano de lancamento com mais filmes assistidos (nao o ano em que a
// pessoa assistiu - essa data nao existe no app, so' o ano do filme).
export function yearWithMostWatchedReleases(movies, progress) {
  const counts = {};
  for (const movie of watchedMovies(movies, progress)) {
    counts[movie.year] = (counts[movie.year] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return null;
  }
  const [year, count] = entries.sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
  return { year: Number(year), count };
}

// {"1990s": 4.2, ...} - so' entra decada com pelo menos 1 nota; a media e'
// so' dos filmes avaliados (nao dos so' assistidos sem nota ainda).
export function averageRatingByDecade(movies, progress) {
  const ratings = progress.ratings || {};
  const sums = {};
  const counts = {};
  for (const movie of movies) {
    const rating = ratings[movie.id];
    if (typeof rating !== "number") {
      continue;
    }
    const decade = `${Math.floor(movie.year / 10) * 10}s`;
    sums[decade] = (sums[decade] || 0) + rating;
    counts[decade] = (counts[decade] || 0) + 1;
  }
  const averages = {};
  for (const decade of Object.keys(sums)) {
    averages[decade] = Math.round((sums[decade] / counts[decade]) * 10) / 10;
  }
  return averages;
}
