// preferences.js
//
// The preference shape, and how whatever is on disk becomes a complete one.
// Free of Electron and the DOM so both the main process and the renderer can
// share it, and so it can be exercised under plain `node --test`.

export const DEFAULT_PREFERENCES = {
  autoLaunch: false,
  prefilterRegex: '',
  desktopNotifications: true,
  notificationSound: true,
};

/**
 * Completes a stored preferences object with the defaults.
 *
 * The direction matters: defaults first, stored on top. Anyone who saved
 * their preferences before a setting existed has no key for it, and a missing
 * key has to mean "the behaviour you already had" rather than `undefined`,
 * which reads as off. Getting this backwards would silence notifications for
 * every existing user on upgrade.
 */
export function withDefaults(stored) {
  return { ...DEFAULT_PREFERENCES, ...stored };
}
