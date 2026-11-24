"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { adminReviewListQuery } = require("../src/services/reviewListQuery");

test("sin page conserva el límite anterior", () => {
  assert.deepEqual(adminReviewListQuery({}), { paginated: false, limit: 100 });
  assert.deepEqual(adminReviewListQuery({ limit: "150" }), { paginated: false, limit: 150 });
  assert.deepEqual(adminReviewListQuery({ limit: "500" }), { paginated: false, limit: 200 });
});

test("con page solo admite 10 o 20 y una página válida", () => {
  assert.deepEqual(adminReviewListQuery({ page: "2", limit: "20" }), { paginated: true, page: 2, limit: 20 });
  assert.equal(adminReviewListQuery({ page: "1", limit: "15" }).status, 400);
  assert.equal(adminReviewListQuery({ page: "0", limit: "10" }).status, 400);
  assert.equal(adminReviewListQuery({ page: "1" }).status, 400);
});
