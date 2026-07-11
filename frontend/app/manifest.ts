import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dreston Elite Montessori School",
    short_name: "Dreston Elite",
    description:
      "Attendance, morning feeding money, school fees, and parent messaging for Dreston Elite Montessori School.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFF8FB",
    theme_color: "#6B429F",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
