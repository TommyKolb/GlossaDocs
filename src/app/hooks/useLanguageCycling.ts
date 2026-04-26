const ANIMATION_INTERVAL_MS = 3000;
const ANIMATION_DURATION_S = 0.8;

interface AnimationConfig {
  interval: number;
  duration: number;
}

/** Used by `LanguageBadge` motion config; interval kept for possible future use. */
export const LANGUAGE_BADGE_ANIMATION: AnimationConfig = {
  interval: ANIMATION_INTERVAL_MS,
  duration: ANIMATION_DURATION_S,
};
