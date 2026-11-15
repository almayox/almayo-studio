import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/adminAccess";
import { DashboardShell } from "@/components/DashboardShell";

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

  return <DashboardShell email={user.email}>{children}</DashboardShell>;
}
