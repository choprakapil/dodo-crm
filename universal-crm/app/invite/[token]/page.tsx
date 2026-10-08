import { Metadata } from "next";
import { AcceptInvitationView } from "@/components/settings/accept-invitation-view";

export const metadata: Metadata = {
  title: "Accept Invitation | DODO CRM",
  description: "Accept your invitation to join DODO CRM",
};

export default async function AcceptInviteRootPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const resolvedParams = await params;
  return <AcceptInvitationView token={resolvedParams.token} />;
}
