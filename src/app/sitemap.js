import { SITE } from "@/lib/site";

/** @type {import('next').MetadataRoute.Sitemap} */
export default async function sitemap() {
  const now = new Date().toISOString();

  // 必要に応じて動的にページを列挙（/studio など）
  const routes = [
    "",
    "/studio",
    "/work",
    "/archive",
    "/contact",
  ];

  return routes.map((path) => ({
    url: `${SITE.domain}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1.0 : 0.7,
  }));
}