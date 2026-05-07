/**
 * Single source of truth for the default Rekindle profile avatar.
 *
 * New users no longer get an auto-generated dicebear avatar — they get this
 * generic placeholder until they upload one of their own from Settings.
 */
export const DEFAULT_AVATAR_URL = "/default-avatar.svg";

/** Returns the user's avatar URL, or the generic default when missing. */
export function avatarUrlOrDefault(url?: string | null): string {
  return url && url.trim().length > 0 ? url : DEFAULT_AVATAR_URL;
}
