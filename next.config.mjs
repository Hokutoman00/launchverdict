/** @type {import('next').NextConfig} */
const nextConfig = {
  // Engine modules use explicit .ts import specifiers (so the same source runs
  // under `node --experimental-strip-types` in tests). Turbopack/webpack resolve
  // these natively; nothing extra needed here.
};

export default nextConfig;
