/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for production builds; dev server needs rewrites.
  ...(process.env.NODE_ENV === "production" ? { output: "export" } : {}),
  // Generate /dir/index.html instead of /dir.html — most static servers
  // serve index.html for directory paths, fixing 404s on /auth/callback etc.
  trailingSlash: true,
  images: { unoptimized: true },
  webpack: (config) => {
    // Handle pdf.js worker
    config.resolve.alias.canvas = false;
    return config;
  },
  // Proxy API requests to the Python backend during `next dev`.
  // (rewrites are ignored by `next export` but active in the dev server)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
