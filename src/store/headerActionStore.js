/**
 * Header Action Store — Zustand-based reusable action slot in Header.
 * Pages register a button config on mount, unregister on unmount.
 */

import { create } from "zustand";

export const useHeaderActionStore = create((set) => ({
  action: null, // { label, icon, active, onClick, title }

  register: (action) => set({ action }),
  unregister: () => set({ action: null }),
}));
