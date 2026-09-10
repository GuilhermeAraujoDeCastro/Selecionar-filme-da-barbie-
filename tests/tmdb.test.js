import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMovies, searchBarbieMovies } from "../js/tmdb.js";

function fakeFetch(responsesByPage) {
  return async (url) => {
    const pageMatch = url.match(/page=(\d+)/);
    const page = pageMatch ? Number(pageMatch[1]) : 1;
    const body = responsesByPage[page];
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  };
}

test("normalizeMovies keeps only titles that actually contain 'Barbie'", () => {
  const raw = [
    { id: 1, title: "Barbie in the Nutcracker", release_date: "2001-10-16" },
    { id: 2, title: "Totally Unrelated Movie", release_date: "2010-01-01" },
  ];
  const result = normalizeMovies(raw);
  assert.deepEqual(result.map((m) => m.id), [1]);
});

test("normalizeMovies discards entries without a release date", () => {
  const raw = [{ id: 1, title: "Barbie: Upcoming", release_date: "" }];
  assert.deepEqual(normalizeMovies(raw), []);
});

test("normalizeMovies extracts the year and builds the full poster URL", () => {
  const raw = [{ id: 1, title: "Barbie as Rapunzel", release_date: "2002-10-08", poster_path: "/abc.jpg" }];
  const [movie] = normalizeMovies(raw);
  assert.equal(movie.year, 2002);
  assert.equal(movie.posterPath, "https://image.tmdb.org/t/p/w342/abc.jpg");
});

test("normalizeMovies sorts by release year", () => {
  const raw = [
    { id: 1, title: "Barbie B", release_date: "2015-01-01" },
    { id: 2, title: "Barbie A", release_date: "2001-01-01" },
  ];
  const result = normalizeMovies(raw);
  assert.deepEqual(result.map((m) => m.id), [2, 1]);
});

test("searchBarbieMovies fetches every page reported by the API", async () => {
  const fetchImpl = fakeFetch({
    1: {
      results: [{ id: 1, title: "Barbie Filme 1", release_date: "2001-01-01" }],
      total_pages: 2,
    },
    2: {
      results: [{ id: 2, title: "Barbie Filme 2", release_date: "2002-01-01" }],
      total_pages: 2,
    },
  });

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);

  assert.equal(movies.length, 2);
  assert.deepEqual(movies.map((m) => m.id), [1, 2]);
});

test("searchBarbieMovies stops after the safety cap even if the API reports more pages", async () => {
  const responsesByPage = {};
  for (let page = 1; page <= 10; page += 1) {
    responsesByPage[page] = {
      results: [{ id: page, title: `Barbie Filme ${page}`, release_date: `20${10 + page}-01-01` }],
      total_pages: 10,
    };
  }
  const fetchImpl = fakeFetch(responsesByPage);

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);

  assert.equal(movies.length, 5); // MAX_PAGES = 5
});

test("searchBarbieMovies throws a clear error on HTTP failure", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });

  await assert.rejects(() => searchBarbieMovies("chave-invalida", fetchImpl), /401/);
});
