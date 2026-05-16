import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { getAccessPassword, getSessionSecret } from "@/lib/config";

export const SESSION_COOKIE_NAME = "mailgate_session";

type SessionPayload = {
  exp: number;
  iat: number;
};

export async function hasValidSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawCookie) {
    return false;
  }

  return verifySessionCookie(rawCookie);
}

export function verifyAccessPassword(candidate: string): boolean {
  const expected = getAccessPassword();

  if (!expected || !candidate) {
    return false;
  }

  return timingSafeStringEqual(candidate, expected);
}

export function createSessionCookieValue(): string {
  const now = Date.now();
  const ttlHours = Number.parseInt(process.env.MAILGATE_SESSION_HOURS ?? "12", 10);
  const ttlMs =
    Number.isFinite(ttlHours) && ttlHours > 0
      ? ttlHours * 60 * 60 * 1000
      : 12 * 60 * 60 * 1000;
  const payload: SessionPayload = {
    iat: now,
    exp: now + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionCookie(value: string): boolean {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  if (!timingSafeStringEqual(signature, sign(encodedPayload))) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionPayload;

    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
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
