import { OrganiserHeader } from "@/components/organiser-header";
import { serverSupabase } from "@/lib/supabase/server";

export default async function ContestsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await serverSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return (
    <>
      <OrganiserHeader email={user?.email} />
      {children}
    </>
  );
}
