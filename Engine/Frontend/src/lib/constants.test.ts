import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./constants";

describe("resolveApiBaseUrl", () => {
  it("uses a real configured backend URL when one is provided", () => {
    expect(resolveApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("ignores placeholder deployment URLs during local development", () => {
    expect(
      resolveApiBaseUrl("https://your-render-backend.onrender.com", {
        hostname: "localhost",
        protocol: "http:",
      }),
    ).toBe("http://localhost:8787");
  });

  it("falls back to the local backend port when running on localhost without an env override", () => {
    expect(
      resolveApiBaseUrl(undefined, {
        hostname: "127.0.0.1",
        protocol: "http:",
      }),
    ).toBe("http://127.0.0.1:8787");
  });

  it("keeps relative same-origin API calls in non-local environments when no override is set", () => {
    expect(
      resolveApiBaseUrl(undefined, {
        hostname: "taptap.example.com",
        protocol: "https:",
      }),
    ).toBe("");
  });
});
