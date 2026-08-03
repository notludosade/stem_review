/** @type {import('next').NextConfig} */
const nextConfig = {
  // content/index.html (the former root-level index.html) is served only at
  // "/" via the catch-all route — it's no longer a literal static file, so
  // every "STEM+ Home"/TOC link across the static pages (which points at
  // some depth of ../index.html, ~1,470 files) would 404 without this.
  async redirects() {
    return [
      {
        source: '/index.html',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
