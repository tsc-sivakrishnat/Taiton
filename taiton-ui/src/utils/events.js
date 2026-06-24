export const UNREAD_REFRESH = 'cpanel:unread-refresh';

export function emitUnreadRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UNREAD_REFRESH));
}
