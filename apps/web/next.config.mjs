/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config) => {
    // Handle pdf.js worker
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
