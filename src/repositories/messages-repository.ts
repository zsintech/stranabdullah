import { getAdminFirestore } from "@/server/auth/firebase-admin";
import { isUsingSeedFallback } from "@/repositories";

export type ContactMessageInput = {
  name: string;
  email: string;
  message: string;
};

export async function saveContactMessage(
  input: ContactMessageInput,
): Promise<{ persisted: boolean }> {
  if (isUsingSeedFallback()) {
    return { persisted: false };
  }

  try {
    await getAdminFirestore().collection("messages").add({
      name: input.name,
      email: input.email,
      message: input.message,
      createdAt: new Date().toISOString(),
    });
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}
