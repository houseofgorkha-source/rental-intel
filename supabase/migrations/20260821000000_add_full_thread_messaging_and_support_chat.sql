-- Two changes, bundled because they're both part of the same product
-- decision: retiring /account/messages (a flat, one-reply-max inbox) in
-- favor of a persistent chat widget with real back-and-forth threads, plus
-- a new "chat to support" channel.
--
-- This is a deliberate reversal of a decision recorded elsewhere in this
-- project's reference material: property_messages was originally built as
-- "not a messaging platform... no threads... no replies-to-replies", one
-- row per enquiry. The product owner confirmed this reversal explicitly.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. property_messages: allow real back-and-forth
-- ---------------------------------------------------------------------------
-- The table itself is untouched -- same columns, same indexes, same
-- read_at tracking. Only the INSERT policy changes. Today's policy allows
-- exactly two cases: a first message to an opted-in contributor, or the
-- property's creator replying to someone who already messaged them -- which
-- is why a conversation could only ever bounce once. The new policy keeps
-- both of those, and adds a third: a message is allowed whenever ANY prior
-- message already exists between the same two people on the same property,
-- in EITHER direction. That's what turns "one reply" into a real thread --
-- once a conversation has started, either side can keep talking.
drop policy "Signed-in users can message an opted-in contributor, or reply to a sender" on public.property_messages;

create policy "Signed-in users can message within an existing or newly opted-in conversation"
on public.property_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    -- First message: the property must still be published and its creator
    -- must have chosen "message" as their contact method.
    exists (
      select 1 from public.properties p
      where p.id = property_messages.property_id
        and p.status = 'published'
        and p.contact_method = 'message'
        and p.created_by = property_messages.recipient_id
    )
    or
    -- Any later message in an already-started conversation, from either
    -- participant -- no re-check of contact_method/status, since the
    -- conversation already exists and shouldn't vanish mid-thread if a
    -- property's listing state changes later.
    exists (
      select 1 from public.property_messages existing
      where existing.property_id = property_messages.property_id
        and (
          (existing.sender_id = property_messages.sender_id
            and existing.recipient_id = property_messages.recipient_id)
          or
          (existing.sender_id = property_messages.recipient_id
            and existing.recipient_id = property_messages.sender_id)
        )
    )
  )
);


-- ---------------------------------------------------------------------------
-- 2. support_messages
-- ---------------------------------------------------------------------------
-- One thread per user -- `user_id` identifies whose thread a row belongs to;
-- `sender_id` identifies who actually wrote it (the user themselves, or
-- whichever administrator replies). There's no separate "support agent"
-- role: anyone who already passes is_admin() (the same check /admin already
-- gates on) can read and reply to any user's thread, the same way any admin
-- can moderate any property today.
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index support_messages_user_idx on public.support_messages(user_id, created_at desc);

alter table public.support_messages enable row level security;

-- A user sees only their own thread; an admin sees every thread, since
-- answering support is exactly what is_admin() already gates elsewhere.
create policy "Users can read their own support thread, admins can read all"
on public.support_messages for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- A user can only write into their own thread, as themselves. An admin can
-- write into ANY thread, also as themselves (sender_id is always the real
-- caller -- there is no anonymous/shared "support" identity).
create policy "Users can message their own thread, admins can reply to any"
on public.support_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and (user_id = auth.uid() or public.is_admin())
);

-- Marking read: you can mark read anything you didn't send, in a thread you
-- have access to (your own, or any thread if you're an admin).
create policy "Recipients can mark their own support messages read"
on public.support_messages for update to authenticated
using (
  sender_id <> auth.uid()
  and (user_id = auth.uid() or public.is_admin())
)
with check (
  sender_id <> auth.uid()
  and (user_id = auth.uid() or public.is_admin())
);

grant select, insert on public.support_messages to authenticated;
grant update (read_at) on public.support_messages to authenticated;
grant select, insert, update, delete on public.support_messages to service_role;
