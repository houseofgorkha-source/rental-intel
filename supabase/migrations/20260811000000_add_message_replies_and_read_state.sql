-- Let a property's creator reply to a message they received, and let a
-- recipient's inbox distinguish read from unread.
--
-- 20260810000000 built property_messages deliberately one-way and stated so
-- in its own comments: "no thread, no reply, no inbox state... anything past
-- a single delivered message is a messaging product this one does not need."
-- This migration is the considered exception to that, made after actually
-- using the feature end-to-end: a contributor who cannot answer the question
-- they were asked is a worse outcome than the extra surface area below. It
-- stays narrow -- a reply, and a read marker -- not a thread, not editing,
-- not deletion, not push notifications.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. Read state
-- ---------------------------------------------------------------------------
-- Null means unread. There is deliberately no "unread" boolean default;
-- read_at doubles as "when," which an inbox can use later without another
-- column, and every existing row is correctly unread by omission.
alter table public.property_messages
  add column read_at timestamptz;

-- No blanket UPDATE was ever granted on this table (20260810000000 granted
-- only select, insert), so this is additive, not a widening of something
-- already open: read_at is the ONLY column anyone can ever write here.
grant update (read_at) on public.property_messages to authenticated;

-- A recipient marking their own inbox read. Cannot be used to mark somebody
-- else's messages, and -- because it is the only granted column -- cannot be
-- used to alter a message's body, sender, recipient, or property.
create policy "Recipients can mark their own messages read"
on public.property_messages for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 2. Replies
-- ---------------------------------------------------------------------------
-- The original INSERT policy only ever allowed a message TO a property's
-- creator. A reply is a message FROM the creator, which that policy cannot
-- express, so it is replaced rather than widened in place.
--
-- The added branch is deliberately narrow: a property's creator may only
-- write to somebody who has already sent THEM a message about THAT property.
-- This is what keeps the table from becoming a general cold-messaging tool --
-- a creator still cannot initiate contact with a stranger, they can only
-- answer someone who reached out first. Nothing about who may send the FIRST
-- message on a property changes.
drop policy "Signed-in users can message a contributor who opted in" on public.property_messages;

create policy "Signed-in users can message an opted-in contributor, or reply to a sender"
on public.property_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    -- Original message: to a contributor who opted into 'message' on this
    -- published property. Unchanged from 20260810000000.
    exists (
      select 1 from public.properties p
      where p.id = property_messages.property_id
        and p.status = 'published'
        and p.contact_method = 'message'
        and p.created_by = property_messages.recipient_id
    )
    or
    -- Reply: the sender is this property's creator, and the recipient has
    -- already sent them a message about this same property.
    (
      exists (
        select 1 from public.properties p
        where p.id = property_messages.property_id
          and p.created_by = auth.uid()
      )
      and exists (
        select 1 from public.property_messages inbound
        where inbound.property_id = property_messages.property_id
          and inbound.sender_id = property_messages.recipient_id
          and inbound.recipient_id = auth.uid()
      )
    )
  )
);

-- Still no UPDATE on body/sender/recipient/property_id, and still no DELETE,
-- for the same reason 20260810000000 gave: a sent message is a record of
-- what was said, and neither party gets to rewrite or erase it through the
-- API. Only read_at is writable, and only by its recipient.
