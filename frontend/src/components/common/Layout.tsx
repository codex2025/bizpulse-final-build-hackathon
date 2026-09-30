import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { LayoutProvider } from '../../context/LayoutContext';
import { useLayout } from '../../context/useLayout';
import { drawerLeft, fadeIn } from '../../utils/motion';

interface LayoutContentProps {
  children: React.ReactNode;
}

const LayoutContent: React.FC<LayoutContentProps> = ({ children }) => {
  const { mobileMenuOpen, setMobileMenuOpen } = useLayout();

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-[#F8FAFC] text-ink-900">
      {/* Desktop Sidebar (Persistent) */}
      <div className="hidden lg:flex h-full flex-shrink-0 z-20">
        <Sidebar />
      </div>

      {/* Mobile Drawer (Overlay on screen < lg) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden overflow-hidden">
            {/* Backdrop */}
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-ink-950/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Slide-in sidebar drawer */}
            <div className="fixed inset-y-0 left-0 max-w-full flex">
              <motion.div
                variants={drawerLeft}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-72 max-w-xs bg-white/95 backdrop-blur-xl h-full shadow-dialog z-10"
              >
                <Sidebar
                  isMobileDrawer={true}
                  onCloseMobile={() => setMobileMenuOpen(false)}
                />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative z-10">
        {children}
      </main>
    </div>
  );
};

export const Layout: React.FC<LayoutContentProps> = ({ children }) => {
  return (
    <LayoutProvider>
      <LayoutContent>{children}</LayoutContent>
    </LayoutProvider>
  );
};
