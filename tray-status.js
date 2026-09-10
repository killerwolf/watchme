// tray-status.js
//
// Turns the monitored-process count into what the tray shows: the badge
// text beside the icon and the hover tooltip. Kept free of Tauri so it
// can be exercised under plain `node --test`.

// Past this the badge would start stretching the menu bar, so it caps.
// The tooltip still reports the real count.
const BADGE_CAP = 99;

export function trayBadge(count) {
  if (count <= 0) {
    return '';
  }
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

export function trayTooltip(count) {
  return `WatchMe - Monitoring ${count} process${count === 1 ? '' : 'es'}`;
}
