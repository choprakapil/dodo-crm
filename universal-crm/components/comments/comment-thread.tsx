"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  AtSign,
  Check,
  X,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  getComments,
  createComment,
  editComment,
  deleteComment,
  getTeamMembersForMention,
  CommentItem,
} from "@/lib/actions/comment-actions";

interface CommentThreadProps {
  entityType: "LEAD" | "CUSTOMER" | "DEAL" | "TASK";
  entityId: string;
  onCommentAdded?: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export function CommentThread({
  entityType,
  entityId,
  onCommentAdded,
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Mention autocomplete state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCursorPos, setMentionCursorPos] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
    loadTeamMembers();
  }, [entityId, entityType]);

  async function loadComments() {
    setLoading(true);
    setError(null);
    try {
      const res = await getComments(entityType, entityId);
      if (res.success && res.data) {
        setComments(res.data);
      } else {
        setError(res.error || "Failed to load comments");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamMembers() {
    try {
      const res = await getTeamMembersForMention();
      if (res.success && res.data) {
        setTeamMembers(res.data);
      }
    } catch (err) {
      // quiet fail
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setNewContent(val);

    // Check if user is typing an @mention
    const textBeforeCursor = val.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show autocomplete if no space in query (or short first name query)
      if (!query.includes("\n") && query.length <= 20) {
        setMentionQuery(query.toLowerCase());
        setMentionCursorPos(lastAtIndex);
        setShowMentionMenu(true);
        return;
      }
    }

    setShowMentionMenu(false);
  }

  function selectMention(member: TeamMember) {
    const textBefore = newContent.slice(0, mentionCursorPos);
    const textAfter = newContent.slice(textareaRef.current?.selectionStart || mentionCursorPos);
    const token = `@[${member.name}](user:${member.id}) `;
    const updated = textBefore + token + textAfter;

    setNewContent(updated);
    setShowMentionMenu(false);

    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = textBefore.length + token.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  }

  async function handlePostComment(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newContent.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await createComment({
        entityType,
        entityId,
        content: newContent,
      });

      if (res.success) {
        setNewContent("");
        setShowMentionMenu(false);
        await loadComments();
        if (onCommentAdded) onCommentAdded();
      } else {
        setError(res.error || "Failed to post comment");
      }
    } catch (err: any) {
      setError(err.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(commentId: string) {
    if (!editContent.trim()) return;
    try {
      const res = await editComment(commentId, editContent);
      if (res.success) {
        setEditingId(null);
        setEditContent("");
        await loadComments();
      } else {
        setError(res.error || "Failed to update comment");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update comment");
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      const res = await deleteComment(commentId);
      if (res.success) {
        await loadComments();
      } else {
        setError(res.error || "Failed to delete comment");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete comment");
    }
  }

  function renderFormattedContent(text: string) {
    // Regex matches @[Name](user:id)
    const parts: React.ReactNode[] = [];
    const regex = /@\[([^\]]+)\]\(user:[a-zA-Z0-9_-]+\)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const mentionName = match[1];
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 mx-0.5"
        >
          @{mentionName}
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return <span className="whitespace-pre-wrap text-slate-700">{parts}</span>;
  }

  function formatTime(date: Date | string) {
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(mentionQuery) ||
      m.email.toLowerCase().includes(mentionQuery)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-semibold text-slate-800">Team Comments</h3>
          <span className="text-[11px] font-mono text-slate-500">({comments.length})</span>
        </div>
        <span className="text-[11px] text-slate-500">
          Internal notes &amp; @mentions
        </span>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Comment List */}
      <div className="space-y-2.5">
        {loading && comments.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center bg-slate-50/70 rounded-xl border border-slate-200/80">
            <p className="text-xs text-slate-500">
              No internal comments yet. Share an update or @mention a teammate.
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isEditing = editingId === comment.id;

            return (
              <div
                key={comment.id}
                className="p-3.5 bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 transition shadow-2xs space-y-2"
              >
                {/* Author row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {comment.author.name
                        ? comment.author.name.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                    <span className="text-xs font-semibold text-slate-900">
                      {comment.author.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatTime(comment.createdAt)}
                    </span>
                    {comment.isEdited && (
                      <span className="text-[9px] text-slate-400 italic">
                        (edited)
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit / Delete */}
                  <div className="flex items-center gap-1">
                    {comment.canEdit && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditContent(comment.content);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                        title="Edit comment (15m grace window)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {comment.canDelete && !isEditing && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment body */}
                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none min-h-[70px]"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-600 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        15-minute edit window
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditContent("");
                          }}
                          className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          className="px-3 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-700 leading-relaxed pl-8">
                    {renderFormattedContent(comment.content)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Comment Input Box */}
      <div className="relative pt-2">
        {/* @mention autocomplete popup */}
        {showMentionMenu && (
          <div className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 text-[10px] font-semibold text-slate-600 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-indigo-600" />
              <span>Mention Team Member</span>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  No matching members found
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => selectMention(member)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition group"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium text-slate-800 group-hover:text-indigo-600 truncate">
                        {member.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {member.email}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200/90 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 shadow-2xs transition overflow-hidden">
          <textarea
            ref={textareaRef}
            value={newContent}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handlePostComment();
              }
            }}
            placeholder="Write a comment... Type @ to mention a colleague (Ctrl+Enter to post)"
            className="w-full p-3 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden resize-none min-h-[75px]"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="hidden sm:inline">Use</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] font-mono shadow-2xs">
                @
              </kbd>
              <span className="hidden sm:inline">to notify a colleague</span>
            </div>
            <button
              onClick={() => handlePostComment()}
              disabled={!newContent.trim() || submitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Posting..." : "Post Comment"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
