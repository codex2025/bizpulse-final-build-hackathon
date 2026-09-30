import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, BrainCircuit, Receipt, CreditCard, Target, TrendingUp, FileText, BarChart3, Settings, Users,
} from 'lucide-react';
import { invoiceService, clientService } from '../../services/invoiceService';
import { contractService } from '../../services/contractService';

interface Command {
  id: string;
  group: 'Pages' | 'Invoices' | 'Clients' | 'Contracts';
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  path: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const PAGES: Command[] = [
  { id: 'p-dash', group: 'Pages', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'p-df', group: 'Pages', label: 'DecisionForge AI', hint: 'Ranked opportunities, evidence, what-if', icon: BrainCircuit, path: '/decision-forge' },
  { id: 'p-bill', group: 'Pages', label: 'Invoicing & GST', icon: Receipt, path: '/billing' },
  { id: 'p-exp', group: 'Pages', label: 'Expenses', icon: CreditCard, path: '/expenses' },
  { id: 'p-goals', group: 'Pages', label: 'Goals', icon: Target, path: '/goals' },
  { id: 'p-wealth', group: 'Pages', label: 'Net Worth', icon: TrendingUp, path: '/wealth' },
  { id: 'p-con', group: 'Pages', label: 'Contract Intelligence', icon: FileText, path: '/contracts' },
  { id: 'p-an', group: 'Pages', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'p-set', group: 'Pages', label: 'Settings & Appearance', icon: Settings, path: '/settings' },
];

const asList = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);

/** Global Ctrl/Cmd+K palette: jump to pages, invoices, clients and contracts. */
export const CommandPalette: React.FC<Props> = ({ open, onClose }) =>
  createPortal(
    <AnimatePresence>{open && <PaletteBody key="palette" onClose={onClose} />}</AnimatePresence>,
    document.body,
  );

// Mounted only while open, so its state (query, highlighted row) starts fresh every time.
const PaletteBody: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: invoiceService.getAll, enabled: true, staleTime: 30_000 });
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll, enabled: true, staleTime: 30_000 });
  const { data: contracts } = useQuery({ queryKey: ['contracts'], queryFn: contractService.getAll, enabled: true, staleTime: 30_000 });

  const commands = useMemo<Command[]>(() => {
    const inv: Command[] = asList(invoices).slice(0, 50).map((i) => ({
      id: `i-${String(i.id)}`,
      group: 'Invoices',
      label: String(i.invoice_number ?? 'Invoice'),
      hint: String((i.client as { name?: string } | undefined)?.name ?? i.client_name ?? ''),
      icon: Receipt,
      path: '/billing',
    }));
    const cli: Command[] = asList(clients).slice(0, 50).map((c) => ({
      id: `c-${String(c.id)}`,
      group: 'Clients',
      label: String(c.name ?? 'Client'),
      hint: String(c.email ?? ''),
      icon: Users,
      path: '/billing',
    }));
    const con: Command[] = asList(contracts).slice(0, 50).map((c) => ({
      id: `k-${String(c.id)}`,
      group: 'Contracts',
      label: String(c.title ?? c.name ?? c.filename ?? 'Contract'),
      icon: FileText,
      path: '/contracts',
    }));
    return [...PAGES, ...inv, ...cli, ...con];
  }, [invoices, clients, contracts]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.group}`.toLowerCase().includes(q))
      : commands.filter((c) => c.group === 'Pages');
    return list.slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const choose = (c?: Command) => {
    if (!c) return;
    navigate(c.path);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    }
  };

  return (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh] px-4 bg-slate-900/50 backdrop-blur-sm no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            data-testid="command-palette"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Jump to a page, invoice, client or contract…"
                aria-label="Search commands"
                className="flex-1 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <kbd className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">Esc</kbd>
            </div>
            <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-xs font-medium text-slate-400">Nothing matches &ldquo;{query}&rdquo;.</li>
              )}
              {results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <li key={r.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(r)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-colors ${
                        i === active ? 'bg-violet-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          i === active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 truncate">{r.label}</span>
                        {r.hint && <span className="block text-[11px] font-medium text-slate-400 truncate">{r.hint}</span>}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{r.group}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
  );
};
