import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Layers, Sparkles, X } from 'lucide-react';

interface CategoryItem {
  category: string;
  amount: number;
  percentage: number;
  subCategories?: Array<{ name: string; amount: number }>;
}

interface Props {
  data: CategoryItem[];
}

export const HorizontalCategoryBar: React.FC<Props> = ({ data = [] }) => {
  const [selectedCat, setSelectedCat] = useState<CategoryItem | null>(null);

  const colors = [
    { bg: 'bg-cobalt-600', fill: '#2457FF' },
    { bg: 'bg-vermilion-500', fill: '#F04438' },
    { bg: 'bg-teal-600', fill: '#00A88F' },
    { bg: 'bg-amber-500', fill: '#F5B700' },
    { bg: 'bg-slate-600', fill: '#64748B' },
  ];

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-5 bg-white relative shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <Layers size={16} className="text-cobalt-600" /> Category Outflow & Drill-Down
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Select any category bar to inspect granular sub-item expenditures
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          Ranked by Value
        </span>
      </div>

      <div className="space-y-3.5 pt-1">
        {data.map((item, idx) => {
          const colorObj = colors[idx % colors.length];
          return (
            <motion.div
              key={item.category}
              whileHover={{ scale: 1.008 }}
              onClick={() => setSelectedCat(item)}
              className="p-3 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorObj.fill }} />
                  {item.category}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-ink-900 font-extrabold font-mono tabular-nums">
                    ₹{item.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-slate-400 font-medium text-[11px] font-mono tabular-nums">
                    ({item.percentage}%)
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-cobalt-600 transition-colors" />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: colorObj.fill }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Drill-Down Modal / Flyout */}
      <AnimatePresence>
        {selectedCat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-cobalt-600" />
                  <h4 className="font-extrabold text-sm text-ink-900">
                    {selectedCat.category} — Sub-Item Breakdown
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedCat(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Total Outflow</span>
                <span className="text-base font-black text-ink-900 font-mono tabular-nums">
                  ₹{selectedCat.amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Itemized Operational Line Items
                </p>
                {selectedCat.subCategories && selectedCat.subCategories.length > 0 ? (
                  selectedCat.subCategories.map((sub, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white"
                    >
                      <span className="text-xs font-bold text-slate-700">{sub.name}</span>
                      <span className="text-xs font-black text-ink-900 font-mono tabular-nums">
                        ₹{sub.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 font-medium">No granular items found for this record.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedCat(null)}
                className="btn-primary w-full py-2.5 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Drill-Down
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
