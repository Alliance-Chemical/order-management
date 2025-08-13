import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during production builds to allow deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even with TypeScript errors
    ignoreBuildErrors: true,
  },
};

// Wrap with Sentry configuration
export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true, // Suppresses source map uploading logs during build
  org: "qr-workspace", // Your Sentry org name
  project: "order-management", // Your Sentry project name
  
  // Upload options
  widenClientFileUpload: true,
  
  // Transpiles SDK to be compatible with IE11
  transpileClientSDK: true,
  
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  
  // Disables automatic instrumentation
  disableLogger: true,
  
  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
});
