// A flat property_messages row, exactly as the widget's data-fetching code
// will map a Supabase query result into. `senderName` travels with every
// row (not just looked up once) because grouping needs to find "the other
// participant's" name from whichever of their messages is available — there
// might not be one yet (you can be in a thread you started with zero
// replies from the other side).
export type PropertyMessageRow = {
  id: string;
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type MessageThread = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  otherParticipantId: string;
  otherParticipantName: string;
  // Chronological, oldest first — a thread reads top-to-bottom like a chat.
  messages: PropertyMessageRow[];
  unreadCount: number;
  lastMessageAt: string;
};

// Turns the flat, RLS-scoped result of "every property_messages row I sent
// or received" into one entry per (property, other person) — which is what
// makes this look like a chat thread instead of a bare inbox list. A thread
// is identified by property + the OTHER participant, never by the current
// user's own id, so the same query result groups correctly regardless of
// whether the viewer was the original sender or the recipient.
export function groupPropertyMessagesIntoThreads(
  rows: PropertyMessageRow[],
  currentUserId: string,
): MessageThread[] {
  const byKey = new Map<string, PropertyMessageRow[]>();

  for (const row of rows) {
    const otherParticipantId = row.senderId === currentUserId ? row.recipientId : row.senderId;
    const key = `${row.propertyId}:${otherParticipantId}`;
    const existing = byKey.get(key);
    if (existing) existing.push(row);
    else byKey.set(key, [row]);
  }

  const threads: MessageThread[] = [];

  for (const messages of byKey.values()) {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const first = sorted[0];
    const otherParticipantId = first.senderId === currentUserId ? first.recipientId : first.senderId;

    // The other participant's name comes from one of THEIR messages, if any
    // exist yet — a thread the viewer started with no reply yet still has
    // to render with something, hence the fallback.
    const messageFromOther = sorted.find((message) => message.senderId === otherParticipantId);
    const otherParticipantName = messageFromOther?.senderName ?? "RentalIntel member";

    const unreadCount = sorted.filter(
      (message) => message.recipientId === currentUserId && message.readAt === null,
    ).length;

    threads.push({
      propertyId: first.propertyId,
      propertySlug: first.propertySlug,
      propertyName: first.propertyName,
      otherParticipantId,
      otherParticipantName,
      messages: sorted,
      unreadCount,
      lastMessageAt: sorted[sorted.length - 1].createdAt,
    });
  }

  return threads.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export type SupportMessageRow = {
  id: string;
  // Whose thread this belongs to — not necessarily who wrote it. An admin
  // reply has senderId different from userId; the user's own messages have
  // senderId === userId. That's the entire signal this file uses to tell
  // "from the user" and "from support" apart — there's no separate role
  // column, since any admin can answer any thread.
  userId: string;
  userName: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type SupportThread = {
  userId: string;
  userName: string;
  messages: SupportMessageRow[];
  // Relevant to the admin inbox: messages the user sent that no admin has
  // read yet.
  unreadFromUserCount: number;
  // Relevant to the user's own widget: messages support sent that the user
  // hasn't read yet.
  unreadFromSupportCount: number;
  lastMessageAt: string;
};

// One thread per user_id — simpler than the property grouping above, since
// a support thread has exactly one fixed owner (the "other side" is
// whichever admin happens to reply, not a fixed second person).
export function groupSupportMessagesIntoThreads(rows: SupportMessageRow[]): SupportThread[] {
  const byUser = new Map<string, SupportMessageRow[]>();

  for (const row of rows) {
    const existing = byUser.get(row.userId);
    if (existing) existing.push(row);
    else byUser.set(row.userId, [row]);
  }

  const threads: SupportThread[] = [];

  for (const messages of byUser.values()) {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const first = sorted[0];

    threads.push({
      userId: first.userId,
      userName: first.userName,
      messages: sorted,
      unreadFromUserCount: sorted.filter(
        (message) => message.senderId === first.userId && message.readAt === null,
      ).length,
      unreadFromSupportCount: sorted.filter(
        (message) => message.senderId !== first.userId && message.readAt === null,
      ).length,
      lastMessageAt: sorted[sorted.length - 1].createdAt,
    });
  }

  return threads.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}
