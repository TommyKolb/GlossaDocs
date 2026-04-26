import { describe, expect, it } from "vitest";

import { createInMemorySlidingWindowIpRateLimiter } from "../../src/modules/api-edge/in-memory-sliding-window-rate-limit.js";

describe("createInMemorySlidingWindowIpRateLimiter", () => {
  it("allows up to maxAttempts then throws", () => {
    const limiter = createInMemorySlidingWindowIpRateLimiter({
      windowMs: 60_000,
      maxAttempts: 2,
      tooManyMessage: "slow down"
    });
    limiter.enforce("1.2.3.4");
    limiter.enforce("1.2.3.4");
    expect(() => limiter.enforce("1.2.3.4")).toThrow(/slow down/);
  });

  it("tracks keys independently", () => {
    const limiter = createInMemorySlidingWindowIpRateLimiter({
      windowMs: 60_000,
      maxAttempts: 1,
      tooManyMessage: "nope"
    });
    limiter.enforce("a");
    limiter.enforce("b");
    expect(() => limiter.enforce("a")).toThrow();
  });
});
