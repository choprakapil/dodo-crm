import { Metadata } from "next";
import { AcceptInvitationView } from "@/components/settings/accept-invitation-view";

export const metadata: Metadata = {
  title: "Accept Invitation | Universal CRM",
  description: "Accept your invitation to join Universal CRM",
};

export default async function AcceptInviteAppPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const resolvedParams = await params;
  return <AcceptInvitationView token={resolvedParams.token} />;
}
