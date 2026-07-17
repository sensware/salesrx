import type { MetadataRoute } from "next";

/** v2.6 — installable PWA: the pocket brief reps read in parking lots. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalesRx — Walk in already knowing",
    short_name: "SalesRx",
    description: "Pre-meeting sales intelligence with NEPQ question ladders.",
    start_url: "/pocket",
    display: "standalone",
    background_color: "#061224",
    theme_color: "#061224",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
