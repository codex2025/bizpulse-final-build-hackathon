import { useContext } from 'react';
import { LayoutContext } from './layoutContextDef';
import type { LayoutContextType } from './layoutContextDef';

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    return {
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
      mobileMenuOpen: false,
      setMobileMenuOpen: () => {},
      toggleSidebar: () => {},
      toggleMobileMenu: () => {},
    };
  }
  return context;
};
