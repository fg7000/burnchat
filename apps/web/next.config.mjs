/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/b",
  webpack: (config) => {
    // Handle pdf.js worker
    config.resolve.alias.canvas = false;
    return config;
  },
  // Redirect / to /b since basePath won't handle bare root
  async redirects() {
    return [
      {
        source: "/",
        destination: "/b",
        basePath: false,
        permanent: false,
      },
    ];
  },
  // Disable caching for all assets in dev to prevent stale JS through tunnels
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
