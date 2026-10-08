import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages. The deploy workflow sets PAGES_BASE_PATH
  // (e.g. "/hiero-notes"); locally the site is served from the root.
  output: "export",
  basePath,
  // Client code needs the base path to fetch files from public/ (e.g. pulse/pulse.json).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
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
