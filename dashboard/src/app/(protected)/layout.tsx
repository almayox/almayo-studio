import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/adminAccess";
import { DashboardShell } from "@/components/DashboardShell";
import { unseenCountsByCampaign } from "@/lib/campaignActivity";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Second check, independent of the middleware: no page under this layout
  // renders without a signed-in, allowlisted admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAllowedAdmin(supabase, user.email))) redirect("/login?error=unauthorized");

  // Campaigns where the client did something the studio has not seen yet.
  const waiting = Object.keys(await unseenCountsByCampaign(supabase)).length;

  return (
    <DashboardShell email={user.email} badges={waiting ? { "/campaigns": waiting } : {}}>
      {children}
    </DashboardShell>
  );
}
