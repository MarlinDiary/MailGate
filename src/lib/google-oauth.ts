import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { google } from "googleapis";

import { getGmailConfig, getSessionSecret } from "@/lib/config";

export const OAUTH_STATE_COOKIE = "mailgate_oauth_state";
export const OAUTH_RESULT_COOKIE = "mailgate_oauth_result";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export type OAuthTokenResult = {
  refreshToken: string;
  scope: string;
};

export function createGmailOAuthClient() {
  const config = getGmailConfig();

  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function signOAuthState(state: string): string {
  return `${state}.${sign(state)}`;
}

export function verifyOAuthState(candidate: string, signedState: string): boolean {
  const [state, signature] = signedState.split(".");

  if (!candidate || !state || !signature || candidate !== state) {
    return false;
  }

  return timingSafeStringEqual(signature, sign(state));
}

export function getGmailAuthorizationUrl(state: string): string {
  return createGmailOAuthClient().generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: false,
    prompt: "consent",
    scope: [GMAIL_READONLY_SCOPE],
    state,
  });
}

export function encodeOAuthTokenResult(result: OAuthTokenResult): string {
  const payload = Buffer.from(JSON.stringify(result)).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function decodeOAuthTokenResult(value: string): OAuthTokenResult | null {
  const [payload, signature] = value.split(".");

  if (!payload || !signature || !timingSafeStringEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const result = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as OAuthTokenResult;

    if (!result.refreshToken) {
      return null;
    }

    return {
      refreshToken: result.refreshToken,
      scope: result.scope ?? "",
    };
  } catch {
    return null;
  }
}

function sign(value: string): string {
  const secret = getSessionSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}
