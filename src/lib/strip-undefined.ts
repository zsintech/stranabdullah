/** Firestore rejects `undefined` fields. JSON round-trip drops them. */
export function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
