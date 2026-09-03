import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trayBadge, trayTooltip } from '../tray-status.js';

test('no badge while nothing is monitored', () => {
  assert.equal(trayBadge(0), '');
});

test('the badge is the monitored count', () => {
  assert.equal(trayBadge(1), '1');
  assert.equal(trayBadge(42), '42');
});

test('the badge caps at 99+ so it cannot stretch the menu bar', () => {
  assert.equal(trayBadge(99), '99');
  assert.equal(trayBadge(100), '99+');
  assert.equal(trayBadge(4321), '99+');
});

test('the tooltip pluralises the process count', () => {
  assert.equal(trayTooltip(0), 'Script Watcher - Monitoring 0 processes');
  assert.equal(trayTooltip(1), 'Script Watcher - Monitoring 1 process');
  assert.equal(trayTooltip(2), 'Script Watcher - Monitoring 2 processes');
});

test('the tooltip reports the real count even past the badge cap', () => {
  assert.equal(trayTooltip(150), 'Script Watcher - Monitoring 150 processes');
});
