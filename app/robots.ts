import type { MetadataRoute } from "next";

// A private diary: ask every crawler to stay away.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
