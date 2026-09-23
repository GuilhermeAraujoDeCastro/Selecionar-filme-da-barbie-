import { test } from "node:test";
import assert from "node:assert/strict";
import { exportProgressPayload, parseImportedProgress } from "../js/backup.js";

const PROFILE = { mode: "guest", id: "Ana", name: "Ana" };
const PROGRESS = { watched: [1, 2], ratings: { 1: 5 }, reviews: { 1: "Adorei" } };

test("exportProgressPayload includes profile name and a copy of the progress", () => {
  const payload = exportProgressPayload(PROFILE, PROGRESS);
  assert.equal(payload.profileName, "Ana");
  assert.deepEqual(payload.progress, PROGRESS);
  assert.ok(payload.exportedAt);
});

test("exportProgressPayload does not mutate the original progress", () => {
  const payload = exportProgressPayload(PROFILE, PROGRESS);
  payload.progress.watched.push(999);
  assert.deepEqual(PROGRESS.watched, [1, 2]);
});

test("parseImportedProgress round-trips a payload made by exportProgressPayload", () => {
  const payload = exportProgressPayload(PROFILE, PROGRESS);
  const parsed = parseImportedProgress(JSON.stringify(payload));
  assert.deepEqual(parsed, PROGRESS);
});

test("parseImportedProgress returns null for invalid JSON", () => {
  assert.equal(parseImportedProgress("not json"), null);
});

test("parseImportedProgress returns null when the progress field is missing", () => {
  assert.equal(parseImportedProgress(JSON.stringify({ exportedAt: "now" })), null);
});

test("parseImportedProgress filters out malformed entries instead of throwing", () => {
  const raw = JSON.stringify({
    progress: {
      watched: [1, "two", 3],
      ratings: { 1: 5, 2: "nota", 3: 9 },
      reviews: { 1: "ok", 2: 42 },
    },
  });
  const parsed = parseImportedProgress(raw);
  assert.deepEqual(parsed, { watched: [1, 3], ratings: { 1: 5 }, reviews: { 1: "ok" } });
});

test("parseImportedProgress defaults missing watched/ratings/reviews to empty", () => {
  const parsed = parseImportedProgress(JSON.stringify({ progress: {} }));
  assert.deepEqual(parsed, { watched: [], ratings: {}, reviews: {} });
});
