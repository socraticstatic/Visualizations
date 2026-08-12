import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { BlogLayout, Prose } from "@/components/blog/BlogLayout";
import { findPost, formatPostDate } from "@/posts/registry";

export default function BlogPost() {
  const { slug } = useParams();
  const post = findPost(slug);

  // A route change inside an SPA keeps the old scroll position, which drops
  // the reader into the middle of a post they have not started.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    const previous = document.title;
    document.title = `${post.title} · Micah's Chart System`;
    return () => {
      document.title = previous;
    };
  }, [post]);

  if (!post) {
    return (
      <BlogLayout>
        <Prose>
          <div className="py-20">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Note not found</h1>
            <p className="mt-2 text-sm text-chart-muted-text">
              That note does not exist, or its link has changed.
            </p>
            <Link
              to="/blog"
              className="mt-5 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              All notes
            </Link>
          </div>
        </Prose>
      </BlogLayout>
    );
  }

  const { Component } = post;

  return (
    <BlogLayout>
      <Prose>
        <div className="pt-8 sm:pt-12">
          <Link
            to="/blog"
            className="tap-target inline-flex items-center gap-1.5 rounded text-xs text-chart-muted-text hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            <span aria-hidden>&larr;</span> All notes
          </Link>
          <h1 className="mt-4 font-display text-[28px] font-semibold leading-[1.15] tracking-tight md:text-[38px]">
            {post.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-chart-muted-text">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>Micah Boswell</span>
          </p>
          <hr className="mt-6 border-chart-grid" />
        </div>
      </Prose>

      <Component />

      <Prose>
        <nav className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-chart-grid pt-5">
          <Link to="/blog" className="text-sm font-medium text-primary underline underline-offset-4">
            &larr; All notes
          </Link>
          <Link
            to="/"
            className="tap-target rounded-md border border-chart-grid bg-chart-surface px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-chart-grid/30"
          >
            Open the builder
          </Link>
        </nav>
      </Prose>
    </BlogLayout>
  );
}
