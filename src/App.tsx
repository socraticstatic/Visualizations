import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChartsDemo from "./pages/ChartsDemo.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

/**
 * The route table on its own, with no router around it.
 *
 * Exported because the prerenderer mounts the same tree under a StaticRouter
 * to write real HTML for each route at build time. If the two ever drift, the
 * prerendered page stops being the page.
 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<ChartsDemo />} />
    <Route path="/charts" element={<ChartsDemo />} />
    <Route path="/blog" element={<Blog />} />
    <Route path="/blog/:slug" element={<BlogPost />} />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

/**
 * Everything outside the router: providers and the two toast viewports.
 *
 * Exported for the same reason AppRoutes is. The toast viewports render real
 * elements at the top of #root, so a prerender that left them out produced
 * markup the client could not hydrate - React threw #418 and fell back to a
 * full client render, which is the cost this whole approach exists to avoid.
 * One shell, used by both, means that cannot drift again.
 */
export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {children}
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => (
  <AppShell>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  </AppShell>
);

export default App;
