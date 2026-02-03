/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase =
      process.env.NEXT_PUBLIC_READ_API_BASE_URL ||
      "https://read-api-imbz77zl2a-uc.a.run.app";
    return [
      {
        source: "/proxy/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
