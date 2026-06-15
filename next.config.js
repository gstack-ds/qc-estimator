/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/vendors', destination: '/venues', permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
      bodySizeLimit: '10mb',
    },
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'puppeteer-core', '@sparticuz/chromium-min'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ysondqarwktqhcesjsyd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;
