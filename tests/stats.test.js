import { test } from "node:test";
import assert from "node:assert/strict";
import { averageRatingByDecade, genreCounts, mostWatchedGenre, topRatedMovies, yearWithMostWatchedReleases } from "../js/stats.js";

const MOVIES = [
  { id: 1, title: "Barbie as Rapunzel", year: 2002, genres: ["Familia", "Fantasia"] },
  { id: 2, title: "Barbie in the Nutcracker", year: 2001, genres: ["Familia"] },
  { id: 3, title: "Barbie", year: 2023, genres: ["Comedia", "Fantasia"] },
  { id: 4, title: "Barbie Life in the Dreamhouse", year: 2023, genres: ["Comedia"] },
];

test("topRatedMovies sorts by rating desc, then year desc, then title", () => {
  const progress = { watched: [1, 2, 3], ratings: { 1: 3, 2: 5, 3: 5 } };
  const ranked = topRatedMovies(MOVIES, progress);
  assert.deepEqual(
    ranked.map((movie) => movie.id),
    [3, 2, 1],
  );
});

test("topRatedMovies ignores movies without a rating and respects the limit", () => {
  const progress = { watched: [1, 2], ratings: { 1: 4 } };
  const ranked = topRatedMovies(MOVIES, progress, 1);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, 1);
});

test("genreCounts only counts watched movies", () => {
  const progress = { watched: [1, 3], ratings: {} };
  assert.deepEqual(genreCounts(MOVIES, progress), { Familia: 1, Fantasia: 2, Comedia: 1 });
});

test("mostWatchedGenre picks the highest count", () => {
  const progress = { watched: [1, 2], ratings: {} };
  assert.deepEqual(mostWatchedGenre(MOVIES, progress), { genre: "Familia", count: 2 });
});

test("mostWatchedGenre returns null with nothing watched", () => {
  assert.equal(mostWatchedGenre(MOVIES, { watched: [], ratings: {} }), null);
});

test("yearWithMostWatchedReleases picks the year with the most watched movies", () => {
  const progress = { watched: [3, 4], ratings: {} };
  assert.deepEqual(yearWithMostWatchedReleases(MOVIES, progress), { year: 2023, count: 2 });
});

test("yearWithMostWatchedReleases returns null with nothing watched", () => {
  assert.equal(yearWithMostWatchedReleases(MOVIES, { watched: [], ratings: {} }), null);
});

test("averageRatingByDecade groups ratings by decade of release year", () => {
  const progress = { ratings: { 1: 4, 2: 2, 3: 5 } };
  assert.deepEqual(averageRatingByDecade(MOVIES, progress), { "2000s": 3, "2020s": 5 });
});

test("averageRatingByDecade ignores movies without a rating", () => {
  assert.deepEqual(averageRatingByDecade(MOVIES, { ratings: {} }), {});
});
