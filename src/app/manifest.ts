import type { MetadataRoute } from "next";

// Lets people "Add to Home Screen" so it opens full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dataking",
    short_name: "Dataking",
    description: "Track every leg of your parlays on one scoreboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c2c20",
    theme_color: "#0c2c20",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
