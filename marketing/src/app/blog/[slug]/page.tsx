import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { getBlogPost, getAllBlogPosts } from "@/lib/blog-posts";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: "Post Not Found | KnewSearch",
    };
  }

  return {
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: "article",
      publishedTime: post.publishedDate,
      modifiedTime: post.modifiedDate,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.metaDescription,
    },
  };
}

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

function parseContent(content: string): string {
  let html = content
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-xl font-semibold text-charcoal mt-8 mb-4">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-2xl font-bold text-charcoal mt-12 mb-6 pb-2 border-b border-surface-200">$1</h2>'
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold text-charcoal">$1</strong>'
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-primary-700 hover:text-primary-800 underline underline-offset-2">$1</a>'
    )
    .replace(
      /^> (.+)$/gm,
      '<blockquote class="border-l-4 border-primary-400 pl-4 py-2 my-4 text-charcoal-light italic bg-primary-50/50 rounded-r-lg">$1</blockquote>'
    )
    .replace(/^---$/gm, '<hr class="my-8 border-surface-200" />')
    .replace(
      /```([^`]+)```/g,
      '<pre class="bg-surface-50 border border-surface-200 rounded-xl p-4 overflow-x-auto my-4"><code class="text-sm text-charcoal-light">$1</code></pre>'
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-primary-50 px-1.5 py-0.5 rounded text-primary-700 text-sm">$1</code>'
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-4 text-charcoal-light">$1</li>'
    )
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<li class="ml-4 text-charcoal-light" value="$1">$2</li>'
    )
    .replace(
      /^(?!<[hblpuorc]|<li|<hr|<code|<pre|<table|\|)(.+)$/gm,
      '<p class="text-charcoal-light leading-relaxed mb-4">$1</p>'
    );

  const tableRegex = /\|(.+)\|\n\|[-|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, header, body) => {
    const headerCells = header
      .split("|")
      .filter((c: string) => c.trim())
      .map(
        (c: string) =>
          `<th class="px-4 py-3 text-left text-sm font-semibold text-charcoal bg-surface-50">${c.trim()}</th>`
      )
      .join("");

    const bodyRows = body
      .trim()
      .split("\n")
      .map((row: string) => {
        const cells = row
          .split("|")
          .filter((c: string) => c.trim())
          .map(
            (c: string) =>
              `<td class="px-4 py-3 text-sm text-charcoal-light border-t border-surface-200">${c.trim()}</td>`
          )
          .join("");
        return `<tr class="hover:bg-surface-50/50">${cells}</tr>`;
      })
      .join("");

    return `<div class="overflow-x-auto my-6"><table class="w-full border border-surface-200 rounded-xl overflow-hidden"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
  });

  html = html.replace(
    /(<li class="ml-4 text-charcoal-light">.+<\/li>\n?)+/g,
    (match) => {
      return `<ul class="list-disc space-y-2 my-4 pl-4">${match}</ul>`;
    }
  );

  return html;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    author: {
      "@type": "Person",
      name: post.author,
      url: "https://www.knewsearch.com/about",
    },
    publisher: {
      "@type": "Organization",
      name: "KnewSearch",
      url: "https://www.knewsearch.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.knewsearch.com/logo.png",
      },
    },
    datePublished: post.publishedDate,
    dateModified: post.modifiedDate,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.knewsearch.com/blog/${post.slug}`,
    },
    keywords: post.keywords.join(", "),
  };

  const parsedContent = parseContent(post.content);

  return (
    <>
      <Script
        id="article-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Navbar />

      <main className="min-h-screen pt-28 pb-20">
        <article className="section-container max-w-3xl">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <Link
              href="/blog"
              className="text-primary-700 hover:text-primary-800 text-body-sm font-medium"
            >
              &larr; Back to Blog
            </Link>
          </nav>

          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-3 mb-4">
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

            <h1 className="text-display-sm text-charcoal mb-6 leading-tight">
              {post.title}
            </h1>

            <div className="flex items-center gap-4 text-body-sm text-charcoal-muted pb-6 border-b border-surface-200">
              <span className="font-medium text-charcoal">{post.author}</span>
              <span>&middot;</span>
              <time dateTime={post.publishedDate}>
                {new Date(post.publishedDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              {post.modifiedDate !== post.publishedDate && (
                <>
                  <span>&middot;</span>
                  <span>
                    Updated{" "}
                    {new Date(post.modifiedDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          </header>

          {/* Content */}
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: parsedContent }}
          />

          {/* CTA Section */}
          <div className="mt-16 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/50 p-10 text-center">
            <h2 className="text-heading text-charcoal mb-3">
              Start Measuring Your AI Search Visibility
            </h2>
            <p className="text-body-sm text-charcoal-muted mb-6 max-w-lg mx-auto">
              You can&apos;t improve what you don&apos;t measure. See how your
              brand appears in ChatGPT, Perplexity, Gemini, and more.
            </p>
            <a
              href="https://app.knewsearch.com/sign-up"
              className="inline-flex items-center px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-lg transition-colors"
            >
              Start Free Trial &rarr;
            </a>
          </div>

          {/* Related Articles */}
          <div className="mt-12 pt-8 border-t border-surface-200">
            <h3 className="text-heading-sm text-charcoal mb-4">
              Related Articles
            </h3>
            <div className="space-y-3">
              {getAllBlogPosts()
                .filter((p) => p.slug !== post.slug)
                .slice(0, 3)
                .map((relatedPost) => (
                  <Link
                    key={relatedPost.slug}
                    href={`/blog/${relatedPost.slug}`}
                    className="block text-body-sm text-primary-700 hover:text-primary-800 font-medium"
                  >
                    &rarr; {relatedPost.title}
                  </Link>
                ))}
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
