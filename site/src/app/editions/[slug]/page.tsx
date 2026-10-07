import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Edition } from "@/components/Edition";
import { getBriefings, getEdition } from "@/lib/briefings";

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = getBriefings().map((b) => ({ slug: b.slug }));
  // Static export needs at least one param; the placeholder renders a 404.
  return slugs.length ? slugs : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/editions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const edition = getEdition(slug);
  return { title: edition ? `${edition.briefing.weekday}, ${edition.briefing.dateLabel}` : "Edition" };
}

export default async function EditionPage({ params }: PageProps<"/editions/[slug]">) {
  const { slug } = await params;
  const edition = getEdition(slug);
  if (!edition) notFound();
  return <Edition {...edition} />;
}
