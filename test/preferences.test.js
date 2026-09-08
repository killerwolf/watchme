import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PREFERENCES, withDefaults } from '../preferences.js';

test('an empty store yields every default', () => {
  assert.deepEqual(withDefaults({}), DEFAULT_PREFERENCES);
  assert.deepEqual(withDefaults(undefined), DEFAULT_PREFERENCES);
});

test('stored values win over the defaults', () => {
  const stored = {
    autoLaunch: true,
    prefilterRegex: '^node',
    desktopNotifications: false,
    notificationSound: false,
  };
  assert.deepEqual(withDefaults(stored), stored);
});

// The upgrade case, and the reason this module exists. Someone who saved
// their preferences before these settings shipped has a stored object with
// only the two old keys. Merging the wrong way round would leave the new
// keys undefined, which reads as false, and would silently turn off
// notifications and sound for every existing user.
test('settings absent from an older stored object default to on', () => {
  const beforeUpgrade = { autoLaunch: true, prefilterRegex: '^node' };
  const merged = withDefaults(beforeUpgrade);

  assert.equal(merged.desktopNotifications, true);
  assert.equal(merged.notificationSound, true);
  assert.equal(merged.autoLaunch, true, 'existing settings must survive');
  assert.equal(merged.prefilterRegex, '^node');
});

test('an explicit false is kept, not overwritten by the default', () => {
  const merged = withDefaults({ desktopNotifications: false });

  assert.equal(
    merged.desktopNotifications,
    false,
    'turning a setting off has to stick across restarts'
  );
  assert.equal(merged.notificationSound, true);
});

test('withDefaults does not mutate its argument', () => {
  const stored = { autoLaunch: true };
  withDefaults(stored);
  assert.deepEqual(stored, { autoLaunch: true });
});
