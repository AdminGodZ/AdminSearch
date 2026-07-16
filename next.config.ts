import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const isDevelopment = process.env.NODE_ENV !== "production";

const cspDirectives = [
  ["default-src", "'self'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["frame-ancestors", "'self'"],
  ["form-action", "'self'"],
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ],
  ["style-src", "'self'", "'unsafe-inline'"],
  ["img-src", "'self'", "data:", "blob:", "http:", "https:"],
  ["font-src", "'self'", "data:"],
  [
    "connect-src",
    "'self'",
    ...(isDevelopment
      ? ["http://localhost:*", "http://127.0.0.1:*", "ws:", "wss:"]
      : []),
  ],
  [
    "frame-src",
    "https://youtube.com",
    "https://www.youtube.com",
    "https://youtube-nocookie.com",
    "https://www.youtube-nocookie.com",
    "https://dailymotion.com",
    "https://www.dailymotion.com",
    "https://geo.dailymotion.com",
    "https://player.vimeo.com",
    "https://odysee.com",
    "https://www.odysee.com",
  ],
  ["media-src", "'self'", "http:", "https:"],
  ["worker-src", "'self'", "blob:"],
  ["manifest-src", "'self'"],
];

const contentSecurityPolicy = cspDirectives
  .map((directive) => directive.join(" "))
  .join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: ["ioredis"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
