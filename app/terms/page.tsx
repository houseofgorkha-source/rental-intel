import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — RentalIntel",
  description: "The terms that govern using RentalIntel.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium tracking-[-0.02em] text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted">{children}</div>
    </section>
  );
}

// Same standard as the privacy policy: reflects what this product actually
// does and permits today, not boilerplate. See the notice at the bottom.
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Legal</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.</p>

        <Section title="What RentalIntel is">
          <p>
            RentalIntel is a rental-intelligence platform: a place to search for rental
            properties, read tenant reviews, and share what you know about a place you&apos;ve lived
            in, own, or helped list. It is not a brokerage, not a listing marketplace charging
            for placement, and not a party to any lease or rental agreement between users.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You need an account (Google sign-in or an email magic link) to submit a property,
            write a review, or message another user. You&apos;re responsible for what happens under
            your account, and for giving us a working email address or Google account we can
            reach you through.
          </p>
        </Section>

        <Section title="Submitting a property">
          <p>
            When you add a property, you&apos;re asked to state your relationship to it — owner,
            tenant, or someone helping list it on another person&apos;s behalf. This is a
            self-declared claim, not something we independently verify, and we say so plainly on
            the property page. Submitting false information about a property, or claiming a
            relationship to it you don&apos;t actually have, is a violation of these terms.
          </p>
          <p>
            A property&apos;s name, address, area, and city can be edited later only by whoever
            originally submitted it, and only for that specific property — not by anyone else,
            and not for a property someone else added.
          </p>
        </Section>

        <Section title="Writing a review">
          <p>
            Reviews must reflect your own, genuine experience. We do not allow fake reviews,
            manipulated ratings, or reviews written on behalf of someone else. In turn, we make a
            commitment back to you: once published, a truthful review is never removed because of
            commercial pressure from a property owner or anyone else — our moderators cannot edit
            or delete a review at all, by design, only decide whether a stay-verification request
            attached to it is approved.
          </p>
          <p>
            An owner cannot review the property they themselves listed — this is enforced by the
            platform itself, not just a guideline.
          </p>
        </Section>

        <Section title="Stay verification">
          <p>
            Verification is optional and applies only to confirming that a reviewer actually
            stayed at a property — never to a submitter&apos;s ownership or tenancy claim, which
            remains self-declared. A verification decision (approved or rejected) is made by a
            RentalIntel administrator reviewing the documents you chose to submit.
          </p>
        </Section>

        <Section title="Moderation">
          <p>
            A newly submitted property is published immediately rather than held for approval,
            but an administrator can still change its status afterward — including rejecting one
            found to be fake, duplicate, or in violation of these terms. Reviews, once published,
            are permanent and not subject to takedown by moderators, as described above.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Don&apos;t scrape, spam, impersonate someone else, upload content you don&apos;t have the
            right to share, or attempt to circumvent the rate limits and protections built into
            property or review submission. We reserve the right to reject a submission, restrict
            an account&apos;s ability to submit content, or remove content that clearly violates these
            terms.
          </p>
        </Section>

        <Section title="No warranty on user-submitted content">
          <p>
            Property details, rent figures, and reviews are submitted by users, not verified by
            RentalIntel as a matter of course (stay verification is the one narrow exception, and
            only for what it explicitly covers). We do our best to keep the platform trustworthy,
            but we don&apos;t guarantee the accuracy of any individual listing or review, and
            RentalIntel is not a party to, and accepts no liability arising from, any rental
            transaction or agreement between users.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms as the product evolves. Material changes will be reflected
            by updating the date at the top of this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms — use the chat widget, or see the{" "}
            <a href="/contact" className="font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover hover:decoration-accent">
              Contact page
            </a>
            .
          </p>
        </Section>

        <div className="mt-14 rounded-2xl border border-warning/30 bg-warning/10 p-5 text-sm leading-6 text-foreground">
          <p className="font-medium">A note on this document</p>
          <p className="mt-1 text-muted">
            Written to accurately reflect what this product actually does and permits — not
            boilerplate — but it is not legal advice and hasn&apos;t been reviewed by a lawyer.
            We&apos;d recommend a qualified review before treating this as final, especially
            around liability and dispute-resolution language for an Indian audience.
          </p>
        </div>
      </div>
    </main>
  );
}
