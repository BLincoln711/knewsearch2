import { Metadata } from "next";
import Link from "next/link";
import { getAllBlogPosts } from "@/lib/blog-posts";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Blog | KnewSearch - AI Search Visibility Intelligence",
  description:
    "Learn about AI search visibility, GEO optimization, and how to get your brand cited by ChatGPT, Perplexity, Gemini, and Google AI Overviews.",
  keywords: [
    "AI search visibility",
    "GEO",
    "generative engine optimization",
    "AI citations",
    "Share of Model",
  ],
};

const typeColors: Record<string, string> = {
  "Pillar Page / Definitive Guide": "bg-primary-50 text-primary-700",
  "Definitive Guide": "bg-primary-50 text-primary-700",
  "Comparison / Educational": "bg-amber-50 text-amber-700",
  "How-To Guide": "bg-emerald-50 text-emerald-700",
  "Platform-Specific Guide": "bg-emerald-50 text-emerald-700",
  "Educational / Research": "bg-blue-50 text-blue-700",
  "Actionable Checklist / Tool": "bg-violet-50 text-violet-700",
  "Research / Thought Leadership": "bg-blue-50 text-blue-700",
  "Original Research / Data Report": "bg-blue-50 text-blue-700",
  "Case Studies / Social Proof": "bg-amber-50 text-amber-700",
};

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-28 pb-20">
        <div className="section-container max-w-4xl">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-display-sm text-charcoal mb-4">
              KnewSearch Blog
            </h1>
            <p className="text-body-lg text-charcoal-muted max-w-2xl mx-auto">
              Insights on AI search visibility, GEO optimization, and winning in
              the age of AI-powered discovery.
            </p>
          </div>

          {/* Blog Posts */}
          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl bg-surface-0 shadow-card hover:shadow-card-hover transition-shadow duration-300 p-6"
              >
                <Link href={`/blog/${post.slug}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={`text-caption font-medium px-2.5 py-0.5 rounded-full ${
                        typeColors[post.contentType] ||
                        "bg-surface-100 text-charcoal-muted"
                      }`}
                    >
                      {post.contentType}
                    </span>
                    <span className="text-caption text-charcoal-faint">
                      {post.readingTime}
                    </span>
                  </div>
                  <h2 className="text-heading-sm text-charcoal mb-2 hover:text-primary-700 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-body-sm text-charcoal-muted mb-4 line-clamp-2">
                    {post.metaDescription}
                  </p>
                  <div className="flex items-center gap-3 text-caption text-charcoal-faint">
                    <span className="font-medium text-charcoal-light">
                      {post.author}
                    </span>
                    <span>&middot;</span>
                    <time dateTime={post.publishedDate}>
                      {new Date(post.publishedDate).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "long", day: "numeric" }
                      )}
                    </time>
                  </div>
                </Link>
              </article>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/50 p-10">
            <h2 className="text-heading text-charcoal mb-3">
              Ready to Improve Your AI Visibility?
            </h2>
            <p className="text-body-sm text-charcoal-muted mb-6 max-w-lg mx-auto">
              Track your brand across ChatGPT, Perplexity, Gemini, and Google AI
              Overviews.
            </p>
            <a
              href="https://app.knewsearch.com/sign-up"
              className="inline-flex items-center px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-lg transition-colors"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
