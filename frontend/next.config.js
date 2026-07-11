const withSerwist = require("@serwist/next").default({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Service workers get in the way of iterating locally — only ship one in
  // production builds.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false, // never force-reload a page mid-form when connectivity returns
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

module.exports = withSerwist(nextConfig);
