"use client";

import { useEffect } from "react";
import { markMessagesRead } from "@/app/actions/messages";

// Fires markMessagesRead() once, right after /account/messages mounts.
// markMessagesRead calls revalidatePath — Next.js 16 no longer allows a
// Server Action to do that while it's invoked directly from another Server
// Component's render (which is what this replaced: the page used to
// `await markMessagesRead()` inline). Invoking it from a client-side effect
// instead makes it a genuine action call, not part of the page's render.
export default function MarkMessagesReadOnMount() {
  useEffect(() => {
    markMessagesRead();
  }, []);

  return null;
}
