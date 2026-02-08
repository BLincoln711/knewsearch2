import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KnewSearch — AI Search Visibility Analytics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "#4338ca",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "white", fontSize: "36px", fontWeight: 700 }}>
              K
            </span>
          </div>
          <span style={{ fontSize: "40px", fontWeight: 700, color: "#1e1b4b" }}>
            KnewSearch
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: "#1e1b4b",
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: 1.2,
            marginBottom: "24px",
          }}
        >
          AI Search Visibility Analytics
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: "24px",
            color: "#6b7280",
            textAlign: "center",
            maxWidth: "700px",
            lineHeight: 1.5,
          }}
        >
          See how your brand appears in ChatGPT, Perplexity, Gemini, and Google AI Overviews
        </div>

        {/* URL badge */}
        <div
          style={{
            marginTop: "48px",
            padding: "12px 32px",
            background: "#4338ca",
            borderRadius: "999px",
            color: "white",
            fontSize: "20px",
            fontWeight: 600,
          }}
        >
          knewsearch.com
        </div>
      </div>
    ),
    { ...size }
  );
}
