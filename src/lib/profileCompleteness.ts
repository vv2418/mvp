export type ProfileCompletenessItem = {
  id: string;
  label: string;
  description: string;
  weight: number;
  done: boolean;
};

export type ProfileCompletenessResult = {
  percent: number;
  items: ProfileCompletenessItem[];
  /** First incomplete item’s actionable hint for the UI */
  nextHint: string | null;
};

const MIN_INTERESTS = 3;

/**
 * Weighted rubric (sums to 100):
 * — Name, photo, bio, location: profile trust
 * — Interests: onboarding quality
 * — At least one liked event: product engagement
 */
export function computeProfileCompleteness(input: {
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
  bio: string | undefined;
  location: string | undefined;
  interestCount: number;
  likedEventCount: number;
}): ProfileCompletenessResult {
  const name = (input.displayName ?? '').trim();
  const bio = (input.bio ?? '').trim();
  const loc = (input.location ?? '').trim();
  const avatar = (input.avatarUrl ?? '').trim();

  const items: ProfileCompletenessItem[] = [
    {
      id: 'name',
      label: 'Display name',
      description: 'Add how you want others to see you (at least 2 characters).',
      weight: 15,
      done: name.length >= 2,
    },
    {
      id: 'photo',
      label: 'Profile photo',
      description: 'Upload a photo so people recognize you in chats.',
      weight: 20,
      done: avatar.length > 0,
    },
    {
      id: 'bio',
      label: 'Bio',
      description: 'Add a short bio on your profile so people know you.',
      weight: 20,
      done: bio.length > 0,
    },
    {
      id: 'location',
      label: 'Location',
      description: 'Add your city or neighborhood on your profile.',
      weight: 15,
      done: loc.length >= 2,
    },
    {
      id: 'interests',
      label: 'Interests',
      description: `Pick at least ${MIN_INTERESTS} interests so we can rank events for you.`,
      weight: 15,
      done: input.interestCount >= MIN_INTERESTS,
    },
    {
      id: 'engagement',
      label: 'Discover',
      description: 'Like at least one event on Discover to build your calendar.',
      weight: 15,
      done: input.likedEventCount >= 1,
    },
  ];

  const earned = items.reduce((sum, it) => sum + (it.done ? it.weight : 0), 0);
  const percent = Math.min(100, Math.round(earned));
  const next = items.find((it) => !it.done);
  const nextHint = next ? `${next.label}: ${next.description}` : null;

  return { percent, items, nextHint };
}
