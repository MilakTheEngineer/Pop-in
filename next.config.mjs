/** @type {import('next').NextConfig} */
const config = { distDir: process.env.POPIN_NEXT_DIST_DIR || '.next', devIndicators: false, experimental: { serverActions: { bodySizeLimit: '4mb' } } };
export default config;
