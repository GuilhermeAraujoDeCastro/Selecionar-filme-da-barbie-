// Filtros e ordenacao da lista de filmes. Tudo funcao pura: recebe a lista
// de filmes (e o estado de "assistido"), devolve uma lista nova, nunca
// mexe no DOM nem em armazenamento.

export function filterMovies(movies, options = {}) {
  const { year = null, onlyUnwatched = false, watchedIds = [], search = "" } = options;
  const watchedSet = new Set(watchedIds);
  const searchTerm = search.trim().toLowerCase();

  return movies.filter((movie) => {
    if (year !== null && movie.year !== year) {
      return false;
    }
    if (onlyUnwatched && watchedSet.has(movie.id)) {
      return false;
    }
    if (searchTerm && !movie.title.toLowerCase().includes(searchTerm)) {
      return false;
    }
    return true;
  });
}

export function sortMoviesByYear(movies, direction = "asc") {
  const sorted = [...movies].sort((a, b) => a.year - b.year);
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function sortMoviesAlphabetically(movies, direction = "asc") {
  const sorted = [...movies].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  return direction === "desc" ? sorted.reverse() : sorted;
}

// Sem nota vira 0 pra ficar sempre por ultimo, tanto em "maior primeiro"
// quanto (depois do reverse) em "menor primeiro".
export function sortMoviesByRating(movies, ratings, direction = "desc") {
  const sorted = [...movies].sort((a, b) => (ratings[a.id] || 0) - (ratings[b.id] || 0));
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function availableYears(movies) {
  return [...new Set(movies.map((movie) => movie.year))].sort((a, b) => a - b);
}

// Um filme e' "concluido" quando foi marcado como assistido E ja tem nota.
// So' assistido (sem nota ainda) continua contando como pendente e fica na
// grade principal, esperando a nota.
export function isCompleted(progress, movieId) {
  return progress.watched.includes(movieId) && Boolean(progress.ratings[movieId]);
}

// Separa a lista em dois grupos: o que ainda fica na grade principal
// ("active") e o que ja foi assistido e avaliado, que sai da grade e vai
// pra lista de assistidos no Perfil ("completed").
export function splitByCompletion(movies, progress) {
  const active = [];
  const completed = [];
  for (const movie of movies) {
    if (isCompleted(progress, movie.id)) {
      completed.push(movie);
    } else {
      active.push(movie);
    }
  }
  return { active, completed };
}

// A TMDB inclui filme anunciado mas ainda sem estrear (releaseDate no
// futuro) - sem isso ele contava contra o progresso como se a pessoa
// tivesse "deixado de assistir" um filme que nem lancou ainda. now e'
// parametro so' pra dar pra testar sem depender da data real do sistema.
export function isMovieUpcoming(movie, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return Boolean(movie.releaseDate) && movie.releaseDate > today;
}

// Separa em "ja lancado" e "em breve" usando isMovieUpcoming acima -
// usado tanto na grade principal (so' mostra "em breve" numa secao a
// parte) quanto na ficha do filme (esconde os controles de nota/assistido).
export function splitUpcoming(movies, now = new Date()) {
  const released = [];
  const upcoming = [];
  for (const movie of movies) {
    (isMovieUpcoming(movie, now) ? upcoming : released).push(movie);
  }
  return { released, upcoming };
}
