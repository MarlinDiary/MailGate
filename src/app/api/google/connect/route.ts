import { NextRequest, NextResponse } from "next/server";

import { getOAuthSetupStatus } from "@/lib/config";
import {
  createOAuthState,
  getGmailAuthorizationUrl,
  OAUTH_STATE_COOKIE,
  signOAuthState,
} from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const setupStatus = getOAuthSetupStatus();
  const setupUrl = new URL("/setup", request.url);

  if (!setupStatus.ready) {
    setupUrl.searchParams.set("error", "setup-not-ready");

    return NextResponse.redirect(setupUrl);
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(getGmailAuthorizationUrl(state));

  response.cookies.set(OAUTH_STATE_COOKIE, signOAuthState(state), {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
