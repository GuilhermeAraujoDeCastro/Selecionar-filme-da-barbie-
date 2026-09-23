import { test } from "node:test";
import assert from "node:assert/strict";
import { debounce } from "../js/debounce.js";

test("debounce only calls fn once after rapid calls settle", async () => {
  let calls = 0;
  const debounced = debounce(() => {
    calls += 1;
  }, 10);

  debounced();
  debounced();
  debounced();
  assert.equal(calls, 0);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(calls, 1);
});

test("debounce forwards arguments to fn", async () => {
  let received = null;
  const debounced = debounce((value) => {
    received = value;
  }, 5);

  debounced("barbie");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(received, "barbie");
});
