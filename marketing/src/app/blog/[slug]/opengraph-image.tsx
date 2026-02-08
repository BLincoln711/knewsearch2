import { ImageResponse } from "next/og";
import { getBlogPost, getAllBlogPosts } from "@/lib/blog-posts";

export const runtime = "edge";
export const alt = "KnewSearch Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  const title = post?.title ?? "KnewSearch Blog";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#4338ca",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "white", fontSize: "26px", fontWeight: 700 }}>
              K
            </span>
          </div>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "#1e1b4b" }}>
            KnewSearch
          </span>
        </div>

        {/* Middle: Title */}
        <div
          style={{
            fontSize: title.length > 60 ? "42px" : "52px",
            fontWeight: 700,
            color: "#1e1b4b",
            lineHeight: 1.2,
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>

        {/* Bottom: URL + Blog badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              padding: "8px 20px",
              background: "#4338ca",
              borderRadius: "999px",
              color: "white",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            knewsearch.com/blog
          </div>
          {post && (
            <span style={{ fontSize: "18px", color: "#6b7280" }}>
              {post.readingTime}
            </span>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
