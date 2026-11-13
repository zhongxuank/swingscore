import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * Where the email link lands. Handles the default link (?code=, needs the same browser that asked for it)
 * and a token-hash link (?token_hash=&type=, works in any browser if the email template is changed to use it).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const supabase = await serverSupabase();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    target.pathname = next;
  } else {
    target.pathname = "/sign-in";
    target.searchParams.set("error", "link");
    target.searchParams.set("next", next);
  }
  return NextResponse.redirect(target);
}
