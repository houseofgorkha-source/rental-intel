"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMessageThreads,
  getSupportThread,
  markThreadRead,
  markSupportThreadRead,
  sendThreadMessage,
  sendSupportMessage,
} from "@/app/actions/messages";
import type { MessageThread, SupportMessageRow } from "@/lib/messaging";

// Global event name used by anything that wants to open the widget straight
// to the support thread — e.g. the homepage's "Need support?" link — without
// that caller needing to know or hold any of this widget's state.
export const OPEN_SUPPORT_CHAT_EVENT = "rentalintel:open-support-chat";

const POLL_INTERVAL_MS = 20000;

type Selection =
  | { kind: "list" }
  | { kind: "support" }
  | { kind: "property"; propertyId: string; propertySlug: string; propertyName: string; otherParticipantId: string; otherParticipantName: string };

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

// The one persistent, screen-anchored UI element in the app — see
// 20260821000000's migration comment and the reference doc for why this
// replaced /account/messages. Desktop: a floating panel above the bubble.
// Mobile: a full-screen takeover (confirmed explicitly — a corner panel is
// too small to type in on a phone). No realtime subscription exists in this
// codebase, so "live" here means poll-on-interval + refetch-after-send, not
// a websocket.
export default function ChatWidget({ isSignedIn }: { isSignedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "list" });
  const [propertyThreads, setPropertyThreads] = useState<MessageThread[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    const [threads, support] = await Promise.all([getMessageThreads(), getSupportThread()]);
    setPropertyThreads(threads);
    setSupportMessages(support);
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSignedIn, refresh]);

  useEffect(() => {
    function handleOpenSupport() {
      if (!isSignedIn) {
        router.push(`/login?next=${encodeURIComponent("/")}`);
        return;
      }
      setSelection({ kind: "support" });
      setIsOpen(true);
    }
    window.addEventListener(OPEN_SUPPORT_CHAT_EVENT, handleOpenSupport);
    return () => window.removeEventListener(OPEN_SUPPORT_CHAT_EVENT, handleOpenSupport);
  }, [isSignedIn, router]);

  function handleBubbleClick() {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    setIsOpen((open) => !open);
  }

  async function openThread(next: Selection) {
    setSelection(next);
    setError(null);
    setDraft("");
    if (next.kind === "support") await markSupportThreadRead();
    else if (next.kind === "property") await markThreadRead(next.propertyId, next.otherParticipantId);
    refresh();
  }

  async function handleSend() {
    const body = draft.trim();
    if (body.length < 10 || selection.kind === "list") return;

    setIsSending(true);
    setError(null);

    const formData = new FormData();
    formData.set("body", body);

    const result =
      selection.kind === "support"
        ? await sendSupportMessage(formData)
        : await (() => {
            formData.set("propertyId", selection.propertyId);
            formData.set("otherParticipantId", selection.otherParticipantId);
            return sendThreadMessage(formData);
          })();

    setIsSending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft("");
    refresh();
  }

  const supportUnread = supportMessages.filter(
    (message) => message.senderId !== message.userId && message.readAt === null,
  ).length;
  const propertyUnread = propertyThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const totalUnread = supportUnread + propertyUnread;

  const activeMessages: { id: string; body: string; createdAt: string; isOwn: boolean }[] =
    selection.kind === "support"
      ? supportMessages.map((message) => ({
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          isOwn: message.senderId === message.userId,
        }))
      : selection.kind === "property"
        ? (propertyThreads.find(
            (thread) =>
              thread.propertyId === selection.propertyId &&
              thread.otherParticipantId === selection.otherParticipantId,
          )?.messages ?? []
          ).map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            isOwn: message.senderId !== selection.otherParticipantId,
          }))
        : [];

  return (
    <>
      <button
        type="button"
        onClick={handleBubbleClick}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent-hover"
      >
        {isOpen ? (
          <span className="text-xl leading-none">×</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-warm px-1 text-[11px] font-semibold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex h-full w-full flex-col bg-surface sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[32rem] sm:w-96 sm:rounded-2xl sm:border sm:border-border-subtle sm:shadow-xl">
          <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
            {selection.kind !== "list" ? (
              <button
                type="button"
                onClick={() => openThread({ kind: "list" })}
                aria-label="Back to conversations"
                className="text-muted transition hover:text-foreground"
              >
                ←
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {selection.kind === "list"
                  ? "Chats"
                  : selection.kind === "support"
                    ? "RentalIntel Support"
                    : selection.propertyName}
              </p>
              {selection.kind === "property" && (
                <p className="truncate text-xs text-muted">with {selection.otherParticipantName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-muted transition hover:text-foreground"
            >
              ×
            </button>
          </div>

          {selection.kind === "list" ? (
            <ThreadList
              supportUnread={supportUnread}
              supportPreview={supportMessages.at(-1)?.body ?? null}
              supportLastAt={supportMessages.at(-1)?.createdAt ?? null}
              propertyThreads={propertyThreads}
              onOpenSupport={() => openThread({ kind: "support" })}
              onOpenProperty={(thread) =>
                openThread({
                  kind: "property",
                  propertyId: thread.propertyId,
                  propertySlug: thread.propertySlug,
                  propertyName: thread.propertyName,
                  otherParticipantId: thread.otherParticipantId,
                  otherParticipantName: thread.otherParticipantName,
                })
              }
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {selection.kind === "property" && (
                  <Link
                    href={`/property/${selection.propertySlug}`}
                    className="mb-3 inline-block text-xs font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover"
                  >
                    View property →
                  </Link>
                )}
                {activeMessages.length === 0 ? (
                  <p className="mt-6 text-center text-sm text-muted">
                    {selection.kind === "support"
                      ? "Ask us anything — we typically reply within a day."
                      : "Say hello to start the conversation."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {activeMessages.map((message) => (
                      <li
                        key={message.id}
                        className={`flex flex-col ${message.isOwn ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-5 ${
                            message.isOwn
                              ? "bg-accent text-white"
                              : "border border-border-subtle bg-surface-raised text-foreground"
                          }`}
                        >
                          {message.body}
                        </div>
                        <span className="mt-1 text-[11px] text-muted">
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-border-subtle p-3">
                {error && (
                  <p role="alert" className="mb-2 text-xs text-danger">
                    {error}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Write a message…"
                    className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending || draft.trim().length < 10}
                    aria-busy={isSending}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-muted"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ThreadList({
  supportUnread,
  supportPreview,
  supportLastAt,
  propertyThreads,
  onOpenSupport,
  onOpenProperty,
}: {
  supportUnread: number;
  supportPreview: string | null;
  supportLastAt: string | null;
  propertyThreads: MessageThread[];
  onOpenSupport: () => void;
  onOpenProperty: (thread: MessageThread) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <button
        type="button"
        onClick={onOpenSupport}
        className="flex w-full items-start gap-3 border-b border-border-subtle px-4 py-3 text-left transition hover:bg-surface-raised"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
          RI
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">RentalIntel Support</span>
            {supportLastAt && (
              <span className="shrink-0 text-[11px] text-muted">{formatMessageTime(supportLastAt)}</span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {supportPreview ?? "Chat with the RentalIntel team"}
          </span>
        </span>
        {supportUnread > 0 && (
          <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-warm px-1 text-[11px] font-semibold text-white">
            {supportUnread}
          </span>
        )}
      </button>

      {propertyThreads.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          Message a contributor from any property page and the conversation will show up here.
        </p>
      ) : (
        propertyThreads.map((thread) => (
          <button
            key={`${thread.propertyId}:${thread.otherParticipantId}`}
            type="button"
            onClick={() => onOpenProperty(thread)}
            className="flex w-full items-start gap-3 border-b border-border-subtle px-4 py-3 text-left transition hover:bg-surface-raised"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-semibold text-muted">
              {thread.otherParticipantName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{thread.propertyName}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {formatMessageTime(thread.lastMessageAt)}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {thread.otherParticipantName}: {thread.messages.at(-1)?.body}
              </span>
            </span>
            {thread.unreadCount > 0 && (
              <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-warm px-1 text-[11px] font-semibold text-white">
                {thread.unreadCount}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
