import { describe, expect, it } from "vitest";
import { isAuthorized } from "./admin-auth";

describe("isAuthorized", () => {
  it("rejects everything when token is not configured", () => {
    expect(isAuthorized("Bearer secret", undefined)).toBe(false);
    expect(isAuthorized("Bearer secret", "")).toBe(false);
    expect(isAuthorized("Bearer ", "")).toBe(false);
  });

  it("accepts only the exact Bearer token", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
    expect(isAuthorized("Bearer secreT", "secret")).toBe(false);
    expect(isAuthorized("Bearer secret2", "secret")).toBe(false);
    expect(isAuthorized("Bearer secre", "secret")).toBe(false);
  });

  it("rejects missing or malformed header", () => {
    expect(isAuthorized(null, "secret")).toBe(false);
    expect(isAuthorized(undefined, "secret")).toBe(false);
    expect(isAuthorized("secret", "secret")).toBe(false);
    expect(isAuthorized("Basic secret", "secret")).toBe(false);
    expect(isAuthorized("bearer secret", "secret")).toBe(false);
  });
});
