const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase =
      process.env.NEXT_PUBLIC_READ_API_BASE_URL ||
      "https://read-api-1046864181643.us-central1.run.app";
    return [
      {
        source: "/proxy/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
});
