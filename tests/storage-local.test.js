import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearLastGuestName,
  loadLastGuestName,
  loadLocalProgress,
  saveLastGuestName,
  saveLocalProgress,
  setRating,
  toggleWatched,
} from "../js/storage-local.js";

// Node nao tem localStorage global por padrao (isso e' uma API de navegador),
// entao pra testar sem abrir um navegador de verdade, um Map simples faz o
// papel dele aqui.
class FakeLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, value);
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  globalThis.localStorage = new FakeLocalStorage();
});

test("loadLocalProgress with nothing saved returns an empty progress", () => {
  const progress = loadLocalProgress("Ana");
  assert.deepEqual(progress, { watched: [], ratings: {} });
});

test("saveLocalProgress then loadLocalProgress round-trips correctly", () => {
  const progress = { watched: [1, 2], ratings: { 1: 5 } };
  saveLocalProgress("Ana", progress);
  assert.deepEqual(loadLocalProgress("Ana"), progress);
});

test("different profile names do not share progress", () => {
  saveLocalProgress("Ana", { watched: [1], ratings: {} });
  saveLocalProgress("Beatriz", { watched: [2], ratings: {} });
  assert.deepEqual(loadLocalProgress("Ana").watched, [1]);
  assert.deepEqual(loadLocalProgress("Beatriz").watched, [2]);
});

test("loadLocalProgress recovers from corrupted JSON instead of throwing", () => {
  globalThis.localStorage.setItem("barbie-tracker:Ana", "{isso nao e json valido");
  assert.deepEqual(loadLocalProgress("Ana"), { watched: [], ratings: {} });
});

test("toggleWatched adds an id that is not there yet", () => {
  const progress = { watched: [1], ratings: {} };
  const result = toggleWatched(progress, 2);
  assert.deepEqual(result.watched.sort(), [1, 2]);
});

test("toggleWatched removes an id that is already there", () => {
  const progress = { watched: [1, 2], ratings: {} };
  const result = toggleWatched(progress, 2);
  assert.deepEqual(result.watched, [1]);
});

test("toggleWatched does not mutate the original object", () => {
  const progress = { watched: [1], ratings: {} };
  toggleWatched(progress, 2);
  assert.deepEqual(progress.watched, [1]);
});

test("setRating adds a rating without touching the others", () => {
  const progress = { watched: [], ratings: { 1: 5 } };
  const result = setRating(progress, 2, 3);
  assert.deepEqual(result.ratings, { 1: 5, 2: 3 });
});

test("loadLastGuestName with nothing saved returns null", () => {
  assert.equal(loadLastGuestName(), null);
});

test("saveLastGuestName then loadLastGuestName round-trips correctly", () => {
  saveLastGuestName("Ana");
  assert.equal(loadLastGuestName(), "Ana");
});

test("saveLastGuestName overwrites a previously saved name", () => {
  saveLastGuestName("Ana");
  saveLastGuestName("Beatriz");
  assert.equal(loadLastGuestName(), "Beatriz");
});

test("clearLastGuestName removes the saved name", () => {
  saveLastGuestName("Ana");
  clearLastGuestName();
  assert.equal(loadLastGuestName(), null);
});
