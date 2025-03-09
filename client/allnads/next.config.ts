import { default as withPWAInit } from 'next-pwa';

const config = {
  /* config options here */
  reactStrictMode: true,
  // other config options...
};

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
    image: '/offline',
    audio: '/offline',
    video: '/offline',
    font: '/offline',
  }
});

const nextConfig = withPWA(config);

export default nextConfig;
