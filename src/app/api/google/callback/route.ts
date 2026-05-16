import { NextRequest, NextResponse } from "next/server";

import { getOAuthSetupStatus } from "@/lib/config";
import {
  createGmailOAuthClient,
  encodeOAuthTokenResult,
  OAUTH_RESULT_COOKIE,
  OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const setupUrl = new URL("/setup", request.url);
  const setupStatus = getOAuthSetupStatus();

  if (!setupStatus.ready) {
    setupUrl.searchParams.set("error", "setup-not-ready");

    return NextResponse.redirect(setupUrl);
  }

  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    setupUrl.searchParams.set("error", error);

    return NextResponse.redirect(setupUrl);
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const signedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";

  if (!code || !verifyOAuthState(state, signedState)) {
    setupUrl.searchParams.set("error", "invalid-oauth-state");

    return NextResponse.redirect(setupUrl);
  }

  try {
    const { tokens } = await createGmailOAuthClient().getToken(code);

    if (!tokens.refresh_token) {
      setupUrl.searchParams.set("error", "missing-refresh-token");

      return NextResponse.redirect(setupUrl);
    }

    const response = NextResponse.redirect(new URL("/setup?connected=1", request.url));

    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.set(
      OAUTH_RESULT_COOKIE,
      encodeOAuthTokenResult({
        refreshToken: tokens.refresh_token,
        scope: tokens.scope ?? "",
      }),
      {
        httpOnly: true,
        maxAge: 10 * 60,
        path: "/setup",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      }
    );

    return response;
  } catch (tokenError) {
    console.error(tokenError);
    setupUrl.searchParams.set("error", "token-exchange-failed");

    return NextResponse.redirect(setupUrl);
  }
}
