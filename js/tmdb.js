// Busca os filmes da Barbie na TMDB (The Movie Database). A TMDB nao tem uma
// unica "collection" oficial reunindo os 40+ filmes (existem varias
// collections fragmentadas, tipo "Barbie Fairytopia Collection" e "Barbie
// Mariposa Collection"), entao a busca junta dois caminhos: texto ("Barbie")
// na busca normal de filmes, e as collections cujo nome bate com "Barbie"
// (pra pegar filme cujo titulo nao tem "Barbie" mas pertence a uma delas,
// tipo uma sub-serie derivada), sem depender de acertar um ID especifico.

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MAX_PAGES = 5; // trava de seguranca: no maximo 5 paginas (ate 100 resultados)

// Empresas da Mattel cadastradas na TMDB. Filme com qualquer uma delas e' da franquia.
const MATTEL_COMPANY_IDS = [6220, 87780, 49983, 302609, 137586, 168848, 33365, 215690, 8810];
// Sem o selo da Mattel, o filme so' entra se parecer da franquia (a TMDB nao marca a empresa em todos).
const FRANCHISE_GENRES = [16, 10751]; // animacao, familia
const BLOCKED_GENRES = [27, 80, 99, 10752]; // terror, crime, documentario, guerra
const MIN_VOTES_WITHOUT_MATTEL = 20;

// genreMap ({id: nome}) e' opcional - so' usado pra anexar movie.genres
// (estatisticas do Perfil). Sem ele, os filmes ainda funcionam normalmente,
// so' ficam sem genero conhecido.
export async function searchBarbieMovies(apiKey, fetchImpl = fetch, genreMap = {}) {
  const [textRaw, mattelRaw] = await Promise.all([
    fetchTitlePages(apiKey, fetchImpl),
    searchByMattel(apiKey, fetchImpl),
  ]);
  const mattelIds = new Set(mattelRaw.map((movie) => movie.id));
  // A busca por texto sozinha traz "The Trial of Klaus Barbie", "Barbie Boy"...
  const textResults = normalizeMovies(
    textRaw.filter((movie) => mattelIds.has(movie.id) || looksLikeFranchise(movie)),
    { genreMap },
  );
  const mattelResults = normalizeMovies(mattelRaw, { genreMap });
  // Tem collection com "Barbie" no nome que nao e' da Mattel ("Barbie & Kendra", terror trash).
  const collectionRaw = await searchByCollections(apiKey, fetchImpl);
  const collectionResults = normalizeMovies(
    collectionRaw.filter((movie) => mattelIds.has(movie.id) || hasFranchiseGenre(movie)),
    { requireBarbieInTitle: false, genreMap },
  );

  const byId = new Map();
  for (const movie of [...textResults, ...mattelResults, ...collectionResults]) {
    byId.set(movie.id, movie);
  }
  return [...byId.values()].sort((a, b) => a.year - b.year);
}

// Animacao/familia e nenhum genero bloqueado.
function hasFranchiseGenre(movie) {
  const genres = Array.isArray(movie.genre_ids) ? movie.genre_ids : [];
  if (genres.some((id) => BLOCKED_GENRES.includes(id))) {
    return false;
  }
  return genres.some((id) => FRANCHISE_GENRES.includes(id));
}

// Pra busca por texto a regra e' mais dura: tambem exige ingles e votos suficientes.
function looksLikeFranchise(movie) {
  return hasFranchiseGenre(movie) && movie.original_language === "en" && (movie.vote_count || 0) >= MIN_VOTES_WITHOUT_MATTEL;
}

// Filmes produzidos pela Mattel. Falha aqui nao derruba a busca, so' tira o reforco.
async function searchByMattel(apiKey, fetchImpl) {
  try {
    const allResults = [];
    let page = 1;
    let totalPages = 1;
    do {
      const url = `${TMDB_BASE_URL}/discover/movie?api_key=${encodeURIComponent(apiKey)}&with_companies=${MATTEL_COMPANY_IDS.join("|")}&language=pt-BR&include_adult=false&page=${page}`;
      const response = await fetchImpl(url);
      if (!response.ok) {
        return allResults;
      }
      const data = await response.json();
      allResults.push(...(data.results || []));
      totalPages = data.total_pages || 1;
      page += 1;
    } while (page <= totalPages && page <= MAX_PAGES + 2);
    return allResults;
  } catch (error) {
    console.error("Nao foi possivel buscar os filmes da Mattel na TMDB:", error);
    return [];
  }
}

// Resultado bruto da busca por texto (todas as paginas, ate o limite).
async function fetchTitlePages(apiKey, fetchImpl) {
  const allResults = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${encodeURIComponent(apiKey)}&query=Barbie&language=pt-BR&include_adult=false&page=${page}`;
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Erro da TMDB: ${response.status}`);
    }
    const data = await response.json();
    allResults.push(...(data.results || []));
    totalPages = data.total_pages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return allResults;
}

// Nunca deixa a busca inteira falhar por causa dessa parte extra: se a
// TMDB mudar algo aqui ou a chamada falhar, so' fica sem o reforco das
// collections (a busca por texto sozinha ja cobre a maioria dos filmes).
async function searchByCollections(apiKey, fetchImpl) {
  try {
    const url = `${TMDB_BASE_URL}/search/collection?api_key=${encodeURIComponent(apiKey)}&query=Barbie&language=pt-BR`;
    const response = await fetchImpl(url);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    const collections = (data.results || []).filter(
      (collection) => collection.name && collection.name.toLowerCase().includes("barbie"),
    );

    const parts = await Promise.all(collections.map((collection) => fetchCollectionParts(collection.id, apiKey, fetchImpl)));
    return parts.flat();
  } catch (error) {
    console.error("Nao foi possivel buscar por collection na TMDB:", error);
    return [];
  }
}

async function fetchCollectionParts(collectionId, apiKey, fetchImpl) {
  const url = `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return Array.isArray(data.parts) ? data.parts : [];
}

// requireBarbieInTitle desligado so' faz sentido pra resultado que ja veio
// de uma collection da franquia (veja searchByCollections acima).
function normalizeMovies(rawResults, { requireBarbieInTitle = true, genreMap = {} } = {}) {
  return rawResults
    .filter((movie) => movie.title && (!requireBarbieInTitle || movie.title.toLowerCase().includes("barbie")))
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      releaseDate: movie.release_date || null,
      overview: movie.overview || "",
      posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
      genres: Array.isArray(movie.genre_ids) ? movie.genre_ids.map((id) => genreMap[id]).filter(Boolean) : [],
    }))
    .filter((movie) => movie.year !== null)
    .sort((a, b) => a.year - b.year);
}

// {id: nome} pra traduzir genre_ids em nome legivel nas estatisticas do
// Perfil. Endpoint publico da TMDB, nao muda com frequencia - dá pra
// cachear no cliente por bastante tempo (main.js cuida disso).
export async function fetchGenreMap(apiKey, fetchImpl = fetch) {
  const url = `${TMDB_BASE_URL}/genre/movie/list?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Erro da TMDB: ${response.status}`);
  }
  const data = await response.json();
  const map = {};
  for (const genre of data.genres || []) {
    map[genre.id] = genre.name;
  }
  return map;
}

// Sinopse completa, duracao e elenco - so' buscado quando a pessoa abre a
// ficha de um filme (nao pros ~40 filmes de uma vez, que seria 40 chamadas
// extras so' pra listar a colecao).
export async function fetchMovieDetail(movieId, apiKey, fetchImpl = fetch) {
  const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${encodeURIComponent(apiKey)}&language=pt-BR&append_to_response=credits`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Erro da TMDB: ${response.status}`);
  }
  const data = await response.json();
  const cast = data.credits && Array.isArray(data.credits.cast) ? data.credits.cast.slice(0, 5).map((person) => person.name) : [];
  return {
    overview: data.overview || "",
    runtime: typeof data.runtime === "number" && data.runtime > 0 ? data.runtime : null,
    cast,
  };
}
