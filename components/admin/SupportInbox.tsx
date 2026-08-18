"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getAllSupportThreads,
  markSupportThreadReadForUser,
  sendSupportReply,
} from "@/app/actions/messages";
import type { SupportThread } from "@/lib/messaging";
import { EmptyState } from "@/components/shared/StatusPrimitives";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Every user's support thread, unread-first. An administrator can reply to
// any of them — see sendSupportReply's own comment for why there's no
// separate "support agent" concept, just the same is_admin() gate the rest
// of /admin already uses.
export default function SupportInbox() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAllSupportThreads().then(setThreads);
  }, []);

  const sorted = [...threads].sort((a, b) => {
    if (a.unreadFromUserCount !== b.unreadFromUserCount) {
      return b.unreadFromUserCount - a.unreadFromUserCount;
    }
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const selected = sorted.find((thread) => thread.userId === selectedUserId) ?? null;

  async function selectThread(userId: string) {
    setSelectedUserId(userId);
    setError(null);
    setReply("");
    await markSupportThreadReadForUser(userId);
    getAllSupportThreads().then(setThreads);
  }

  function handleReply() {
    if (!selectedUserId || reply.trim().length < 10) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", selectedUserId);
      formData.set("body", reply.trim());
      const result = await sendSupportReply(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setReply("");
      getAllSupportThreads().then(setThreads);
    });
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        title="No support conversations yet."
        description="Threads appear here as soon as someone messages support from the chat widget."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <ul className="flex flex-col gap-2">
        {sorted.map((thread) => (
          <li key={thread.userId}>
            <button
              type="button"
              onClick={() => selectThread(thread.userId)}
              className={`flex w-full items-start justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition ${
                thread.userId === selectedUserId
                  ? "border-accent bg-accent/5"
                  : "border-border-subtle bg-surface hover:border-accent/40"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {thread.userName}
                </span>
                <span className="block truncate text-xs text-muted">
                  {thread.messages.at(-1)?.body}
                </span>
              </span>
              {thread.unreadFromUserCount > 0 && (
                <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-warm px-1 text-[11px] font-semibold text-white">
                  {thread.unreadFromUserCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        {!selected ? (
          <p className="text-sm text-muted">Select a conversation to read and reply.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">{selected.userName}</p>
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {selected.messages.map((message) => {
                const isFromUser = message.senderId === message.userId;
                return (
                  <li
                    key={message.id}
                    className={`flex flex-col ${isFromUser ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-5 ${
                        isFromUser
                          ? "border border-border-subtle bg-surface-raised text-foreground"
                          : "bg-accent text-white"
                      }`}
                    >
                      {message.body}
                    </div>
                    <span className="mt-1 text-[11px] text-muted">
                      {formatDate(message.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Write a reply…"
                className="flex-1 resize-none rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              <button
                type="button"
                onClick={handleReply}
                disabled={isPending || reply.trim().length < 10}
                aria-busy={isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-muted"
              >
                Reply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
