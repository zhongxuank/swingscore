import { describe, expect, it } from "vitest";
import { checkNewStage, kindForStage } from "./round-rules";

describe("kindForStage", () => {
  it("scores every stage before the final by callbacks", () => {
    expect(kindForStage("prelim")).toBe("callback");
    expect(kindForStage("quarter_final")).toBe("callback");
    expect(kindForStage("semi_final")).toBe("callback");
    expect(kindForStage("final")).toBe("final");
  });
});

describe("checkNewStage", () => {
  it("allows any stage as the first round", () => {
    expect(checkNewStage([], "prelim")).toBeNull();
    expect(checkNewStage([], "final")).toBeNull();
  });

  it("allows a later stage after the last one, skipping stages", () => {
    expect(checkNewStage(["prelim"], "semi_final")).toBeNull();
    expect(checkNewStage(["prelim", "semi_final"], "final")).toBeNull();
  });

  it("rejects a stage that is not later than the last round", () => {
    expect(checkNewStage(["prelim"], "prelim")).toMatch(/after/i);
    expect(checkNewStage(["semi_final"], "prelim")).toMatch(/after/i);
  });

  it("rejects any round after the final", () => {
    expect(checkNewStage(["prelim", "final"], "semi_final")).toMatch(/final/i);
  });
});
