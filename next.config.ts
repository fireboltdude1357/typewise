import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The development badge overlaps the mobile quick-team dock and can capture
  // taps that should edit the first team member.
  devIndicators: false,
};

export default nextConfig;
