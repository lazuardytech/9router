/**
 * Notification Store — Zustand-based global toast notification system.
 * Delegates to sonner for rendering.
 */

import { toast } from "sonner";

export const useNotificationStore = () => ({
  success: (message, title) => toast.success(title || message, { description: title ? message : undefined }),
  error: (message, title) =>
    toast.error(title || message, { description: title ? message : undefined, duration: 8000 }),
  warning: (message, title) => toast.warning(title || message, { description: title ? message : undefined }),
  info: (message, title) => toast.info(title || message, { description: title ? message : undefined }),
  addNotification: ({ type, message, title }) => {
    const fn = { success: toast.success, error: toast.error, warning: toast.warning, info: toast.info }[type] ?? toast;
    fn(title || message, { description: title ? message : undefined });
  },
});

// Also export direct toast helpers for non-hook usage
export const notify = {
  success: (message, title) => toast.success(title || message, { description: title ? message : undefined }),
  error: (message, title) =>
    toast.error(title || message, { description: title ? message : undefined, duration: 8000 }),
  warning: (message, title) => toast.warning(title || message, { description: title ? message : undefined }),
  info: (message, title) => toast.info(title || message, { description: title ? message : undefined }),
};
