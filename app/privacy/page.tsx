import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — RentalIntel",
  description: "How RentalIntel collects, uses, and protects your data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium tracking-[-0.02em] text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted">{children}</div>
    </section>
  );
}

// Drafted directly from what this codebase actually collects and stores —
// not a generic template — so every claim here is checkable against
// app/actions/*.ts and supabase/migrations/*. Still a good-faith draft, not
// a substitute for review by a lawyer familiar with India's DPDP Act 2023
// before this is treated as a compliance document — see the notice at the
// bottom.
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Legal</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.</p>

        <Section title="What we collect">
          <p>
            <strong className="text-foreground">Account information.</strong> When you sign in
            with Google or an email magic link, we store your email address and, if you set one,
            a display name. We never see or store a password — sign-in is passwordless or
            handled entirely by Google.
          </p>
          <p>
            <strong className="text-foreground">Content you submit.</strong> Property details
            you add (name, address, area, city, rent, attributes, photos), reviews you write
            (including anonymous ones — see below), and messages you send through the chat
            widget or support channel.
          </p>
          <p>
            <strong className="text-foreground">Contact details for a listing.</strong> If you
            choose to be reached by phone or email on a property you submit, that number or
            address is stored separately from the public property record and is only ever shown
            to other signed-in users — never to the public, never sold, never used for marketing.
          </p>
          <p>
            <strong className="text-foreground">Stay verification documents.</strong> If you
            choose to verify a review, any document you upload (e.g. a rental agreement or rent
            receipt) is stored in a private location only you and RentalIntel administrators can
            access, used solely to confirm the stay the review describes.
          </p>
          <p>
            <strong className="text-foreground">Location.</strong> &quot;Use my current location&quot; is
            entirely optional and only ever runs when you tap it. Your device&apos;s raw GPS
            coordinates never leave your browser and are never sent to us or stored anywhere —
            we only use them locally to suggest a city/area or confirm you&apos;re near a property.
          </p>
        </Section>

        <Section title="What we don't do">
          <p>
            We don&apos;t run advertising trackers, sell your data, or share it with data brokers.
            We don&apos;t use any reverse-geocoding service — your location, when you choose to share
            it, is matched against a small local list of areas entirely in your browser.
          </p>
        </Section>

        <Section title="Who your information is shared with">
          <p>
            Only the infrastructure providers that make the product work: Supabase (our
            database, authentication, and file storage provider) and Google (only if you choose
            Google sign-in). We may also use privacy-respecting, aggregate-only analytics (no
            personal data, no cross-site tracking) to understand how many people are using the
            site. Signed-in users can see a property&apos;s contributor contact details if the
            contributor opted into phone or email contact — that&apos;s the one place your contact
            information is shown to other users, and only if you chose that setting yourself.
          </p>
        </Section>

        <Section title="Reviews and anonymity">
          <p>
            If you post a review anonymously, your name is withheld from public view — the
            review displays as &quot;Anonymous.&quot; We still know who wrote it internally (for
            moderation and stay verification), but it is never shown publicly.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can edit or remove your own property submissions and profile details from your
            account at any time. Reviews are kept permanently once published — this is a
            deliberate trust commitment (we never take down a truthful review under pressure),
            so a review isn&apos;t something you can delete unilaterally the way you can a property
            listing. If you&apos;d like your account or personal data removed, or want a copy of what
            we hold about you, reach out through the contact page and we&apos;ll act on it.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use one essential cookie to keep you signed in (set by Supabase Auth). We don&apos;t
            use advertising or third-party tracking cookies.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data — use the chat widget, or see the{" "}
            <a href="/contact" className="font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover hover:decoration-accent">
              Contact page
            </a>
            .
          </p>
        </Section>

        <div className="mt-14 rounded-2xl border border-warning/30 bg-warning/10 p-5 text-sm leading-6 text-foreground">
          <p className="font-medium">A note on this document</p>
          <p className="mt-1 text-muted">
            This policy was written to accurately describe what RentalIntel&apos;s product actually
            does, but it is not legal advice and has not been reviewed by a lawyer. Given India&apos;s
            DPDP Act, 2023 governs personal data handling for Indian users, we&apos;d recommend a
            qualified review before treating this as a final compliance document.
          </p>
        </div>
      </div>
    </main>
  );
}
