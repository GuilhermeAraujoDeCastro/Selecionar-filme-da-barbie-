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

export function availableYears(movies) {
  return [...new Set(movies.map((movie) => movie.year))].sort((a, b) => a - b);
}
