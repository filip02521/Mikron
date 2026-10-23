import assert from "node:assert/strict";
import { demandStats, quantile } from "./sim.mjs";
assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
// 52 regular weeks of 10 + one week with a single 200-unit document → trimmed
const lines = [];
for (let w = 0; w < 52; w++) lines.push([-1 - w * 7, 10 + (w % 3), 1000 + w]);
lines.push([-3, 200, 9999]);
const st = demandStats(lines, 0);
assert.equal(st.trimmedWeeks, 1);
assert.ok(st.d < 2, `d̄ after trim ${st.d}`);
// sparse item: no trimming, Z-like
const sparse = demandStats([[-10, 5, 1], [-200, 3, 2]], 0);
assert.equal(sparse.trimmedWeeks, 0);
assert.equal(sparse.nz, 2);
console.log("sim self-check ok");
