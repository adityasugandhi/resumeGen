import { create } from 'zustand';
import { UIStore } from '@/types';
import { loadSetting, saveSetting } from '@/lib/indexeddb';

export const useUIStore = create<UIStore>((set) => ({
  isSidebarCollapsed: false,
  theme: 'light',
  editorWidth: 50,
  previewWidth: 50,
  showQuickAccess: true,

  toggleSidebar: () =>
    set((state) => {
      const collapsed = !state.isSidebarCollapsed;
      saveSetting('sidebarCollapsed', collapsed);
      return { isSidebarCollapsed: collapsed };
    }),

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      saveSetting('theme', newTheme);

      // Update document class
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      }

      return { theme: newTheme };
    }),

  setEditorWidth: (width: number) =>
    set({ editorWidth: width }),

  setPreviewWidth: (width: number) =>
    set({ previewWidth: width }),

  toggleQuickAccess: () =>
    set((state) => {
      const show = !state.showQuickAccess;
      saveSetting('showQuickAccess', show);
      return { showQuickAccess: show };
    }),
}));

// Initialize UI settings from storage
if (typeof window !== 'undefined') {
  loadSetting('theme', 'light').then((theme) => {
    const validTheme = theme === 'dark' ? 'dark' : 'light';
    useUIStore.setState({ theme: validTheme });
    document.documentElement.classList.toggle('dark', validTheme === 'dark');
  });

  loadSetting('sidebarCollapsed', false).then((collapsed) => {
    useUIStore.setState({ isSidebarCollapsed: collapsed });
  });

  loadSetting('showQuickAccess', true).then((show) => {
    useUIStore.setState({ showQuickAccess: show });
  });
}
