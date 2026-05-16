"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  verifyAccessPassword,
} from "@/lib/auth";
import { getConfigStatus } from "@/lib/config";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const status = getConfigStatus();

  if (!status.ready) {
    return { error: "Mail Gate is not configured yet." };
  }

  const password = String(formData.get("password") ?? "");

  if (!verifyAccessPassword(password)) {
    return { error: "Incorrect access password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  redirect("/");
}
