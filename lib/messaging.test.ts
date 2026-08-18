import { describe, expect, it } from "vitest";
import {
  groupPropertyMessagesIntoThreads,
  groupSupportMessagesIntoThreads,
  type PropertyMessageRow,
  type SupportMessageRow,
} from "./messaging";

const YOU = "you";
const OWNER = "owner";
const OTHER_OWNER = "other-owner";

function row(overrides: Partial<PropertyMessageRow> = {}): PropertyMessageRow {
  return {
    id: "msg-1",
    propertyId: "property-1",
    propertySlug: "test-property",
    propertyName: "Test Property",
    senderId: YOU,
    senderName: "You",
    recipientId: OWNER,
    body: "Hello",
    createdAt: "2026-01-01T00:00:00Z",
    readAt: null,
    ...overrides,
  };
}

describe("groupPropertyMessagesIntoThreads", () => {
  it("groups messages by property + other participant, not by sender", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "1", senderId: YOU, recipientId: OWNER, senderName: "You" }),
        row({ id: "2", senderId: OWNER, recipientId: YOU, senderName: "Owner" }),
        row({ id: "3", senderId: YOU, recipientId: OWNER, senderName: "You" }),
      ],
      YOU,
    );

    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(3);
    expect(threads[0].otherParticipantId).toBe(OWNER);
    expect(threads[0].otherParticipantName).toBe("Owner");
  });

  it("keeps two different properties as two separate threads", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "1", propertyId: "property-1" }),
        row({ id: "2", propertyId: "property-2" }),
      ],
      YOU,
    );

    expect(threads).toHaveLength(2);
  });

  it("keeps the same property with two different other-participants as two threads", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "1", recipientId: OWNER }),
        row({ id: "2", recipientId: OTHER_OWNER }),
      ],
      YOU,
    );

    expect(threads).toHaveLength(2);
  });

  it("sorts messages within a thread chronologically, oldest first", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "later", createdAt: "2026-01-02T00:00:00Z", body: "second" }),
        row({ id: "earlier", createdAt: "2026-01-01T00:00:00Z", body: "first" }),
      ],
      YOU,
    );

    expect(threads[0].messages.map((m) => m.body)).toEqual(["first", "second"]);
  });

  it("counts unread only for messages addressed to the current viewer", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "1", senderId: YOU, recipientId: OWNER, readAt: null }), // sent by viewer — never "unread" to them
        row({ id: "2", senderId: OWNER, recipientId: YOU, readAt: null, senderName: "Owner" }),
        row({ id: "3", senderId: OWNER, recipientId: YOU, readAt: "2026-01-01T00:00:00Z", senderName: "Owner" }),
      ],
      YOU,
    );

    expect(threads[0].unreadCount).toBe(1);
  });

  it("falls back to a generic name when the other participant hasn't sent anything yet", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [row({ id: "1", senderId: YOU, recipientId: OWNER, senderName: "You" })],
      YOU,
    );

    expect(threads[0].otherParticipantName).toBe("RentalIntel member");
  });

  it("sorts threads by most recent message first", () => {
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "1", propertyId: "old-property", createdAt: "2026-01-01T00:00:00Z" }),
        row({ id: "2", propertyId: "new-property", createdAt: "2026-01-05T00:00:00Z" }),
      ],
      YOU,
    );

    expect(threads.map((t) => t.propertyId)).toEqual(["new-property", "old-property"]);
  });

  it("groups correctly regardless of whether the viewer was the sender or recipient across rows", () => {
    // The viewer both sent to, and received from, the same other person —
    // must still collapse to one thread, not split by "who sent this row".
    const threads = groupPropertyMessagesIntoThreads(
      [
        row({ id: "1", senderId: OWNER, recipientId: YOU, senderName: "Owner" }),
        row({ id: "2", senderId: YOU, recipientId: OWNER, senderName: "You" }),
      ],
      YOU,
    );

    expect(threads).toHaveLength(1);
  });
});

const RENTER = "renter-1";
const ADMIN = "admin-1";
const OTHER_ADMIN = "admin-2";
const OTHER_RENTER = "renter-2";

function supportRow(overrides: Partial<SupportMessageRow> = {}): SupportMessageRow {
  return {
    id: "msg-1",
    userId: RENTER,
    userName: "Renter",
    senderId: RENTER,
    body: "Hello",
    createdAt: "2026-01-01T00:00:00Z",
    readAt: null,
    ...overrides,
  };
}

describe("groupSupportMessagesIntoThreads", () => {
  it("groups all messages for a user into one thread regardless of which admin replied", () => {
    const threads = groupSupportMessagesIntoThreads([
      supportRow({ id: "1", senderId: RENTER }),
      supportRow({ id: "2", senderId: ADMIN }),
      supportRow({ id: "3", senderId: OTHER_ADMIN }),
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(3);
  });

  it("keeps two different users as two separate threads", () => {
    const threads = groupSupportMessagesIntoThreads([
      supportRow({ id: "1", userId: RENTER }),
      supportRow({ id: "2", userId: OTHER_RENTER, userName: "Other renter" }),
    ]);

    expect(threads).toHaveLength(2);
  });

  it("counts unread-from-user messages for the admin side", () => {
    const threads = groupSupportMessagesIntoThreads([
      supportRow({ id: "1", senderId: RENTER, readAt: null }),
      supportRow({ id: "2", senderId: RENTER, readAt: "2026-01-02T00:00:00Z" }),
      supportRow({ id: "3", senderId: ADMIN, readAt: null }),
    ]);

    expect(threads[0].unreadFromUserCount).toBe(1);
    expect(threads[0].unreadFromSupportCount).toBe(1);
  });

  it("sorts messages within a thread chronologically and threads by most recent", () => {
    const threads = groupSupportMessagesIntoThreads([
      supportRow({ id: "1", userId: RENTER, createdAt: "2026-01-01T00:00:00Z", body: "first" }),
      supportRow({ id: "2", userId: RENTER, createdAt: "2026-01-03T00:00:00Z", body: "second" }),
      supportRow({ id: "3", userId: OTHER_RENTER, userName: "Other renter", createdAt: "2026-01-05T00:00:00Z" }),
    ]);

    expect(threads[0].userId).toBe(OTHER_RENTER);
    expect(threads[1].messages.map((m) => m.body)).toEqual(["first", "second"]);
  });
});
