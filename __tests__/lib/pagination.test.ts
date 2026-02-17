import { describe, it, expect } from "vitest";
import {
  parsePagination,
  buildPaginationUrl,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/lib/pagination";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("pagination constants", () => {
  it("DEFAULT_PAGE_SIZE is 25", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it("MAX_PAGE_SIZE is 100", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it("MIN_PAGE_SIZE is 10", () => {
    expect(MIN_PAGE_SIZE).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// parsePagination
// ---------------------------------------------------------------------------

describe("parsePagination", () => {
  describe("defaults", () => {
    it("returns defaults when called with no arguments", () => {
      expect(parsePagination()).toEqual({ page: 1, pageSize: 25 });
    });

    it("returns defaults when called with null", () => {
      expect(parsePagination(null)).toEqual({ page: 1, pageSize: 25 });
    });

    it("returns defaults when called with undefined", () => {
      expect(parsePagination(undefined)).toEqual({ page: 1, pageSize: 25 });
    });

    it("returns defaults for an empty object", () => {
      expect(parsePagination({})).toEqual({ page: 1, pageSize: 25 });
    });
  });

  describe("record-style params", () => {
    it("parses page and pageSize from a record", () => {
      expect(parsePagination({ page: "3", pageSize: "50" })).toEqual({
        page: 3,
        pageSize: 50,
      });
    });

    it("uses the first element for array values", () => {
      expect(parsePagination({ page: ["2", "3"] })).toEqual({
        page: 2,
        pageSize: 25,
      });
    });

    it("handles undefined values in record", () => {
      expect(parsePagination({ page: undefined })).toEqual({
        page: 1,
        pageSize: 25,
      });
    });
  });

  describe("URLSearchParams", () => {
    it("parses from URLSearchParams", () => {
      const params = new URLSearchParams("page=5&pageSize=10");
      expect(parsePagination(params)).toEqual({ page: 5, pageSize: 10 });
    });

    it("returns defaults for empty URLSearchParams", () => {
      const params = new URLSearchParams();
      expect(parsePagination(params)).toEqual({ page: 1, pageSize: 25 });
    });
  });

  describe("clamping", () => {
    it("clamps page below 1 to 1", () => {
      expect(parsePagination({ page: "0" })).toEqual({ page: 1, pageSize: 25 });
    });

    it("clamps negative page to 1", () => {
      expect(parsePagination({ page: "-5" })).toEqual({ page: 1, pageSize: 25 });
    });

    it("clamps NaN page to 1", () => {
      expect(parsePagination({ page: "abc" })).toEqual({ page: 1, pageSize: 25 });
    });

    it("clamps pageSize below MIN to MIN", () => {
      expect(parsePagination({ pageSize: "5" })).toEqual({
        page: 1,
        pageSize: MIN_PAGE_SIZE,
      });
    });

    it("clamps pageSize above MAX to MAX", () => {
      expect(parsePagination({ pageSize: "200" })).toEqual({
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      });
    });

    it("clamps NaN pageSize to MIN", () => {
      expect(parsePagination({ pageSize: "xyz" })).toEqual({
        page: 1,
        pageSize: MIN_PAGE_SIZE,
      });
    });
  });

  describe("custom defaults", () => {
    it("uses custom default pageSize", () => {
      expect(parsePagination(undefined, { pageSize: 50 })).toEqual({
        page: 1,
        pageSize: 50,
      });
    });

    it("uses custom default when no pageSize in params", () => {
      expect(parsePagination({}, { pageSize: 50 })).toEqual({
        page: 1,
        pageSize: 50,
      });
    });

    it("overrides custom default when params provide pageSize", () => {
      expect(parsePagination({ pageSize: "30" }, { pageSize: 50 })).toEqual({
        page: 1,
        pageSize: 30,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// buildPaginationUrl
// ---------------------------------------------------------------------------

describe("buildPaginationUrl", () => {
  it("builds a basic URL with page", () => {
    const url = buildPaginationUrl("/users", {}, 2);
    expect(url).toBe("/users?page=2");
  });

  it("preserves existing search params", () => {
    const url = buildPaginationUrl("/users", { search: "john" }, 2);
    expect(url).toContain("search=john");
    expect(url).toContain("page=2");
  });

  it("strips existing page and pageSize params", () => {
    const url = buildPaginationUrl(
      "/users",
      { page: "1", pageSize: "10", search: "john" },
      3
    );
    expect(url).toContain("search=john");
    expect(url).toContain("page=3");
    // Should not have the old page=1
    expect(url).not.toContain("page=1");
  });

  it("includes non-default pageSize in URL", () => {
    const url = buildPaginationUrl("/users", {}, 1, 50);
    expect(url).toContain("pageSize=50");
  });

  it("omits default pageSize (25) from URL", () => {
    const url = buildPaginationUrl("/users", {}, 1, 25);
    expect(url).not.toContain("pageSize");
  });

  it("handles array param values", () => {
    const url = buildPaginationUrl("/users", { tag: ["a", "b"] }, 1);
    expect(url).toContain("tag=a");
    expect(url).toContain("tag=b");
  });

  it("skips undefined values", () => {
    const url = buildPaginationUrl("/users", { search: undefined }, 1);
    expect(url).not.toContain("search");
  });
});
