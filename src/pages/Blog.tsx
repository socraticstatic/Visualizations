import { Link } from "react-router-dom";
import { BlogLayout, Prose } from "@/components/blog/BlogLayout";
import { POSTS, formatPostDate } from "@/posts/registry";

/**
 * Notes index. One card per post, whole card is the target so it works the
 * same under a thumb as under a cursor.
 */
export default function Blog() {
  return (
    <BlogLayout>
      <Prose>
        <header className="pt-10 sm:pt-14">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Notes</h1>
          <p className="mt-2 max-w-[60ch] text-sm text-chart-muted-text">
            Working notes on chart color, contrast, and the encodings that keep a chart readable
            when color stops carrying it.
          </p>
        </header>

        <ul className="mt-8 flex flex-col gap-3 pb-4">
          {POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                to={`/blog/${post.slug}`}
                className="panel group block p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
              >
                <time dateTime={post.date} className="text-[11px] uppercase tracking-wide text-chart-axis">
                  {formatPostDate(post.date)}
                </time>
                <h2 className="mt-1.5 font-display text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-chart-muted-text">{post.summary}</p>
                <span className="mt-3 inline-block text-xs font-medium text-primary">
                  Read the note
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Prose>
    </BlogLayout>
  );
}
