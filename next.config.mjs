const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const api = new URL(apiUrl);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Lets next/image load uploaded media (logos, menu photos) from the Django backend.
    remotePatterns: [
      {
        protocol: api.protocol.replace(':', ''),
        hostname: api.hostname,
        port: api.port,
        pathname: '/media/**',
      },
    ],
  },
};

export default nextConfig;
