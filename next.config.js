/** @methodType {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    WIX_APP_JWT_KEY: process.env.WIX_APP_JWT_KEY,
    WIX_APP_ID: process.env.WIX_APP_ID,
    WIX_APP_SECRET: process.env.WIX_APP_SECRET,
  },
};

module.exports = nextConfig;
