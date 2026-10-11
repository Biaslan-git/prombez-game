import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Промбез Game — подготовка к аттестации",
    short_name: "Промбез",
    description: "Тренажёр для подготовки к аттестации по промышленной безопасности",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#d35400",
    lang: "ru",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
