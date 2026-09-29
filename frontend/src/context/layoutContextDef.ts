import { createContext } from 'react';

export interface LayoutContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
}

export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);
