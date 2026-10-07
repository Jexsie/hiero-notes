import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages. The deploy workflow sets PAGES_BASE_PATH
  // (e.g. "/hiero-notes"); locally the site is served from the root.
  output: "export",
  basePath: process.env.PAGES_BASE_PATH || "",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
