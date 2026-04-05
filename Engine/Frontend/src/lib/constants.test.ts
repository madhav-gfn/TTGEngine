import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl, resolveApiEndpoint } from "./constants";

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

describe("resolveApiEndpoint", () => {
  it("maps relative API paths to the local backend when running on localhost", () => {
    expect(resolveApiEndpoint("/api/leaderboard/maze-runner-v2", "http://localhost:8787")).toBe(
      "http://localhost:8787/api/leaderboard/maze-runner-v2",
    );
  });

  it("leaves absolute API URLs untouched", () => {
    expect(resolveApiEndpoint("https://api.example.com/api/score")).toBe(
      "https://api.example.com/api/score",
    );
  });
});
