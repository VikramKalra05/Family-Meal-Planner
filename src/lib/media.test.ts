import { describe, expect, it } from "vitest";
import { parseMediaUrl, recipeSearchLinks } from "@/lib/media";

describe("parseMediaUrl", () => {
  it("recognises YouTube links and derives thumbnails", () => {
    expect(parseMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      platform: "youtube",
      videoId: "dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
    expect(parseMediaUrl("https://youtu.be/dQw4w9WgXcQ").videoId).toBe("dQw4w9WgXcQ");
  });

  it("recognises Instagram and generic links", () => {
    expect(parseMediaUrl("https://www.instagram.com/reel/abc123/").platform).toBe("instagram");
    expect(parseMediaUrl("https://example.com/a-recipe").platform).toBe("link");
    expect(parseMediaUrl("not a url").platform).toBe("link");
  });
});

describe("recipeSearchLinks", () => {
  it("builds an encoded YouTube search", () => {
    const links = recipeSearchLinks("Aloo Mutter");
    expect(links.youtube).toBe("https://www.youtube.com/results?search_query=Aloo%20Mutter%20recipe");
  });

  it("builds an Instagram keyword search (universal link opens the app)", () => {
    const links = recipeSearchLinks("Aloo Mutter");
    expect(links.instagram).toBe(
      "https://www.instagram.com/explore/search/keyword/?q=Aloo%20Mutter%20recipe",
    );
  });

  it("trims and collapses title whitespace, and encodes punctuation", () => {
    expect(recipeSearchLinks("  Dal   Makhani  & roti ").youtube).toContain(
      "Dal%20Makhani%20%26%20roti%20recipe",
    );
  });
});
