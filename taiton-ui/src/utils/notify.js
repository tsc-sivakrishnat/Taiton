import { notification } from 'antd';
import { humanizeMessage } from './displayLabels.js';

notification.config({
  placement: 'topRight',
  duration: 4,
  top: 72,
});

function show(type, title, description) {
  const msg = humanizeMessage(title);
  const isError = type === 'error' || type === 'warning';
  const descRaw =
    !isError && description && description !== title ? humanizeMessage(description) : undefined;
  const desc = descRaw && descRaw !== msg ? descRaw : undefined;
  notification[type]({
    message: msg,
    description: desc,
    duration: isError ? 3.5 : 4,
    showProgress: type === 'success' || type === 'info',
  });
}

/** Ant Design toast notifications for user actions across the app. */
export const notify = {
  success: (title, description) => show('success', title, description),
  error: (title, description) => show('error', title, description),
  info: (title, description) => show('info', title, description),
  warning: (title, description) => show('warning', title, description),
  /** Form validation — short title, optional detail line. */
  formWarning: (detail) => {
    const d = detail ? humanizeMessage(detail) : undefined;
    show('warning', 'Please fill required fields', d && d.length < 120 ? d : undefined);
  },
  /** Show API / caught error message. */
  apiError: (err, fallback = 'Something went wrong.') => {
    const raw = err?.message || (typeof err === 'string' ? err : fallback);
    show('error', humanizeMessage(raw));
  },
};
