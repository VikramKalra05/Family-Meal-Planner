import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Meal Planner",
    short_name: "MealPlanner",
    description:
      "AI-powered personalized nutrition for the whole household — plans, pantry, shopping and cooking.",
    start_url: "/",
    display: "standalone",
    share_target: {
      action: "/recipes/from-reel",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    background_color: "#fafafa",
    theme_color: "#059669",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
