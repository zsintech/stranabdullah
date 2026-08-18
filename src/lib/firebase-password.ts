import { getPublicEnv } from "@/lib/env";

type SignInResult = {
  idToken: string;
  localId: string;
  email: string;
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  EMAIL_NOT_FOUND: "ئیمەیڵ یان وشەی نهێنی هەڵەیە.",
  INVALID_PASSWORD: "ئیمەیڵ یان وشەی نهێنی هەڵەیە.",
  INVALID_LOGIN_CREDENTIALS: "ئیمەیڵ یان وشەی نهێنی هەڵەیە.",
  USER_DISABLED: "ئەم هەژمارە داخراوە.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "هەوڵی زۆر درا. دواتر دووبارە هەوڵبدەرەوە.",
};

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const { NEXT_PUBLIC_FIREBASE_API_KEY } = getPublicEnv();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(NEXT_PUBLIC_FIREBASE_API_KEY)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = (await response.json()) as {
    idToken?: string;
    localId?: string;
    email?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.idToken || !data.localId || !data.email) {
    const code = data.error?.message?.split(" ")[0] ?? "";
    throw new AuthError(AUTH_MESSAGES[code] ?? "چوونەژوورەوە سەرکەوتوو نەبوو.");
  }

  return {
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
  };
}
