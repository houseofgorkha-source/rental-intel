import SectionNav from "@/components/shared/SectionNav";

const sections = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/reviews", label: "Reviews" },
];

export default function AdminSectionNav() {
  return <SectionNav sections={sections} label="Moderation sections" />;
}
