import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPollinationsImageUrl, getImageProviderConfig } from "../lib/image-provider.ts";

test("pollinations config does not require an API key", () => {
  const config = getImageProviderConfig({
    IMAGE_PROVIDER: "pollinations",
  });

  assert.equal(config.provider, "pollinations");
  assert.equal(config.requiresApiKey, false);
});

test("builds a pollinations image URL with encoded prompt and comic dimensions", () => {
  const url = new URL(
    buildPollinationsImageUrl({
      prompt: "a noir detective in rain",
      width: 864,
      height: 1184,
      seed: 123,
    }),
  );

  assert.equal(url.origin, "https://image.pollinations.ai");
  assert.equal(url.pathname, "/prompt/a%20noir%20detective%20in%20rain");
  assert.equal(url.searchParams.get("width"), "864");
  assert.equal(url.searchParams.get("height"), "1184");
  assert.equal(url.searchParams.get("seed"), "123");
  assert.equal(url.searchParams.get("nologo"), "true");
});
