import { describe, expect, test } from "bun:test";
import { cn } from "./utils";

describe("utils", () => {
  test("cn combines class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("cn handles conditional classes", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });
});
