import type { Metadata } from "next";
import { LinkView } from "./link-view";

export const metadata: Metadata = { title: "Swingscore", robots: { index: false, follow: false } };

export default async function PrivateLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LinkView token={token} />;
}
