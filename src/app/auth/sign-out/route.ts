import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await serverSupabase();
  await supabase.auth.signOut();
  const target = request.nextUrl.clone();
  target.pathname = "/sign-in";
  target.search = "";
  return NextResponse.redirect(target, { status: 303 });
}
