/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  webpack: (config) => {
    // Handle pdf.js worker
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
