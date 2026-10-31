import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://hdcreative.cloud";
  const now = new Date();
  // Single canonical URL per page (locale is cookie-based), so no
  // hreflang alternates are emitted here.
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms-of-service`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/data-deletion`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
}
