import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps cashier controls and receipt reprint features wired", async () => {
  const [client, backoffice, route, migration] = await Promise.all([
    read("app/pos-client.tsx"),
    read("app/backoffice.tsx"),
    read("app/api/pos/route.ts"),
    read("drizzle/0002_living_boom_boom.sql"),
  ]);

  assert.match(client, /Cashier Mode/);
  assert.match(client, /Hold Sale/);
  assert.match(client, /Recall Sale/);
  assert.match(client, /Reprint Last/);
  assert.match(client, /ManagerAccessModal/);
  assert.match(client, /Invoice No\./);
  assert.match(backoffice, /onReprintSale/);
  assert.match(backoffice, /Invoice No\./);
  assert.match(route, /getSaleReceipt/);
  assert.match(route, /verifyManagerPin/);
  assert.match(route, /for \(const product of seedProducts\)/);
  assert.match(migration, /manager_pin_hash/);
});
