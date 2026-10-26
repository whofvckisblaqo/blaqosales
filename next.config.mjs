/** @type {import('next').NextConfig} */
const nextConfig = {
  // These read their own font/data files from disk, so they must not be bundled.
  serverExternalPackages: ["pdfkit", "exceljs"],
};

export default nextConfig;
