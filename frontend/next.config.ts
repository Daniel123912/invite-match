import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone нужен только Docker; на Vercel — обычная сборка Next.js
  ...(process.env.DOCKER === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
