/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Runs src/instrumentation.ts on server boot to start the retention sweep.
    instrumentationHook: true,
  },
};

export default nextConfig;
