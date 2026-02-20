/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for production builds; dev server needs rewrites.
  ...(process.env.NODE_ENV === "production" ? { output: "export" } : {}),
  // trailingSlash only for production static export (generates /dir/index.html).
  // In dev mode it causes cascading 308 redirects that break OAuth and API proxy.
  ...(process.env.NODE_ENV === "production" ? { trailingSlash: true } : {}),
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
