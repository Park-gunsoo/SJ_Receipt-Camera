import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  outputFileTracingIncludes: { "/*": ["./certs/supabase-ca.crt"] },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "sharp", "@google-cloud/vision", "@google-cloud/tasks", "@google-cloud/storage", "googleapis"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ] }, { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};
export default config;
