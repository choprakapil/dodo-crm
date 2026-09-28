"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { HELP_CATEGORIES, HELP_ARTICLES, HelpArticle } from "@/lib/help-articles";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  BookOpen,
  ArrowLeft,
  Lock,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  FileText,
  Tag,
  ShieldAlert,
} from "lucide-react";

interface HelpCenterWorkspaceProps {
  userRole: string;
  hasAdminAccess: boolean;
  hasManagerAccess: boolean;
}

export function HelpCenterWorkspace({
  userRole,
  hasAdminAccess,
  hasManagerAccess,
}: HelpCenterWorkspaceProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeArticleSlug = searchParams.get("article");
  const activeCategoryParam = searchParams.get("category");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    activeCategoryParam || "all"
  );

  // Filter categories based on permissions
  const visibleCategories = useMemo(() => {
    return HELP_CATEGORIES.filter((cat) => {
      if (!cat.adminOnly) return true;
      return hasAdminAccess;
    });
  }, [hasAdminAccess]);

  // Filter articles based on user access
  const accessibleArticles = useMemo(() => {
    return HELP_ARTICLES.filter((article) => {
      if (!article.requiredRole) return true;
      if (article.requiredRole === "ADMIN") return hasAdminAccess;
      if (article.requiredRole === "MANAGER") return hasAdminAccess || hasManagerAccess;
      return true;
    });
  }, [hasAdminAccess, hasManagerAccess]);

  // Search and category filtered articles
  const filteredArticles = useMemo(() => {
    return accessibleArticles.filter((article) => {
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;

      if (!searchQuery.trim()) {
        return matchesCategory;
      }

      const q = searchQuery.toLowerCase().trim();
      const inTitle = article.title.toLowerCase().includes(q);
      const inSummary = article.summary.toLowerCase().includes(q);
      const inTags = article.tags.some((t) => t.toLowerCase().includes(q));
      const inContent = article.content.toLowerCase().includes(q);

      return (inTitle || inSummary || inTags || inContent) && (selectedCategory === "all" || matchesCategory);
    });
  }, [accessibleArticles, selectedCategory, searchQuery]);

  // Current active article if selected
  const activeArticle = useMemo(() => {
    if (!activeArticleSlug) return null;
    return accessibleArticles.find((a) => a.slug === activeArticleSlug) || null;
  }, [activeArticleSlug, accessibleArticles]);

  const selectArticle = (slug: string) => {
    router.push(`/app/help?article=${slug}`);
  };

  const clearArticle = () => {
    if (selectedCategory && selectedCategory !== "all") {
      router.push(`/app/help?category=${selectedCategory}`);
    } else {
      router.push("/app/help");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Help & Documentation Center</h1>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-xs">
              Knowledge Base
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Complete user guides, administrative workflows, and operational procedures for Universal CRM.
          </p>
        </div>

        {/* Global Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, topics, keywords..."
            className="pl-9 bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-500 text-sm focus-visible:ring-indigo-500 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Categories */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="text-xs font-semibold text-slate-400 px-3 py-1.5 uppercase tracking-wider">
              Categories
            </div>
            <button
              onClick={() => {
                setSelectedCategory("all");
                if (activeArticleSlug) clearArticle();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                selectedCategory === "all" && !activeArticleSlug
                  ? "bg-indigo-600 text-white font-semibold shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/80"
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4" />
                <span>All Guides</span>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-400">
                {accessibleArticles.length}
              </Badge>
            </button>

            {visibleCategories.map((cat) => {
              const count = accessibleArticles.filter((a) => a.category === cat.id).length;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (activeArticleSlug) clearArticle();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span>{cat.title}</span>
                    {cat.adminOnly && (
                      <span title="Admin only">
                        <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-400">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Quick Access Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
              <span>Need Direct Assistance?</span>
            </div>
            <p>
              Check our FAQ guide or reach out to your organization administrator for account-specific role updates.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectArticle("faq")}
              className="w-full text-xs h-7 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300"
            >
              Open FAQ
            </Button>
          </div>
        </div>

        {/* Right Column: Content Area */}
        <div className="lg:col-span-3">
          {activeArticle ? (
            /* Article Reader View */
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-6">
              {/* Reader Header & Breadcrumbs */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <button
                  onClick={clearArticle}
                  className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to {selectedCategory === "all" ? "All Articles" : "Category"}</span>
                </button>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-[11px]">
                    {activeArticle.categoryTitle}
                  </Badge>
                  {activeArticle.requiredRole && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                      {activeArticle.requiredRole} Role Required
                    </Badge>
                  )}
                </div>
              </div>

              {/* Article Content Render */}
              <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-code:text-indigo-300 prose-code:bg-slate-950 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300 space-y-4">
                  {/* Clean rendered text */}
                  {activeArticle.content
                    .trim()
                    .split("\n\n")
                    .map((block, idx) => {
                      if (block.startsWith("# ")) {
                        return (
                          <h1 key={idx} className="text-2xl font-bold text-white tracking-tight pb-2 border-b border-slate-800">
                            {block.replace("# ", "")}
                          </h1>
                        );
                      }
                      if (block.startsWith("## ")) {
                        return (
                          <h2 key={idx} className="text-lg font-semibold text-indigo-300 pt-4 pb-1">
                            {block.replace("## ", "")}
                          </h2>
                        );
                      }
                      if (block.startsWith("### ")) {
                        return (
                          <h3 key={idx} className="text-base font-semibold text-slate-200 pt-2">
                            {block.replace("### ", "")}
                          </h3>
                        );
                      }
                      if (block.startsWith("> [!NOTE]")) {
                        return (
                          <div key={idx} className="bg-indigo-950/40 border-l-4 border-indigo-500 p-3 rounded-r-lg text-xs text-indigo-200">
                            {block.replace("> [!NOTE]\n> ", "")}
                          </div>
                        );
                      }
                      if (block.startsWith("> [!IMPORTANT]") || block.startsWith("> [!WARNING]")) {
                        return (
                          <div key={idx} className="bg-amber-950/40 border-l-4 border-amber-500 p-3 rounded-r-lg text-xs text-amber-200 flex items-start space-x-2">
                            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>{block.replace(/> \[!(IMPORTANT|WARNING)\]\n> /, "")}</span>
                          </div>
                        );
                      }
                      if (block.startsWith("- ") || block.startsWith("1. ")) {
                        const items = block.split("\n");
                        return (
                          <ul key={idx} className="list-disc list-inside space-y-1 text-sm text-slate-300 pl-2">
                            {items.map((item, i) => (
                              <li key={i} className="leading-relaxed">
                                {item.replace(/^[-*]\s+|\d+\.\s+/, "")}
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      return (
                        <p key={idx} className="text-sm text-slate-300 leading-relaxed">
                          {block}
                        </p>
                      );
                    })}
                </div>
              </article>

              {/* Tags & Footer */}
              <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <Tag className="h-3.5 w-3.5 text-slate-500" />
                  <div className="flex flex-wrap gap-1.5">
                    {activeArticle.tags.map((t) => (
                      <span key={t} className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearArticle}
                  className="text-xs h-7 border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300"
                >
                  Done Reading
                </Button>
              </div>
            </div>
          ) : (
            /* Article Listing View */
            <div className="space-y-4">
              {searchQuery && (
                <div className="text-xs text-slate-400 flex items-center justify-between pb-2">
                  <span>
                    Found <strong>{filteredArticles.length}</strong> matching guide{filteredArticles.length === 1 ? "" : "s"} for &quot;{searchQuery}&quot;
                  </span>
                  <button onClick={() => setSearchQuery("")} className="text-indigo-400 hover:underline">
                    Reset Search
                  </button>
                </div>
              )}

              {filteredArticles.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center space-y-3">
                  <FileText className="h-8 w-8 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-semibold text-slate-200">No matching articles found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try refining your search query or selecting a different category from the sidebar.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                    className="text-xs h-8 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300"
                  >
                    View All Guides
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredArticles.map((article) => (
                    <div
                      key={article.slug}
                      onClick={() => selectArticle(article.slug)}
                      className="group bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 cursor-pointer transition flex flex-col justify-between space-y-4 hover:shadow-md hover:shadow-indigo-500/5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px] bg-slate-950">
                            {article.categoryTitle}
                          </Badge>
                          {article.requiredRole && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0">
                              {article.requiredRole}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition line-clamp-1">
                          {article.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {article.summary}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-indigo-400 font-medium">
                        <span>Read guide</span>
                        <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
