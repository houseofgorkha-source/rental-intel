import SectionNav from "@/components/shared/SectionNav";

const sections = [
  { href: "/account", label: "Overview" },
  { href: "/account/properties", label: "My Properties" },
  { href: "/account/reviews", label: "My Reviews" },
  { href: "/account/messages", label: "Messages" },
  { href: "/account/verifications", label: "Verifications" },
  { href: "/account/profile", label: "Profile" },
];

// The account area's only chrome. Every section page renders its own heading
// and content and nothing else — no repeated wrappers, no per-section nav.
export default function AccountSectionNav() {
  return <SectionNav sections={sections} label="Account sections" />;
}
