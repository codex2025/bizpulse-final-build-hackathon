import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { dropdownVariants } from '../../utils/motion';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string;
  description?: string;
}

export interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const el = items[focusedIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, isOpen]);

  const open = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [disabled, selectedIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  const select = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      close();
    },
    [onChange, close],
  );

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        isOpen ? close() : open();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) open();
        else setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) open();
        else setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) select(options[focusedIndex].value);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  };

  return (
    <div
      className={`relative inline-block text-left ${isOpen ? 'z-50' : 'z-10'} ${className}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selectedOption?.label ?? placeholder}
        className={`flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-semibold select-none cursor-pointer ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-cobalt-500 ring-2 ring-cobalt-500/15 text-ink-900 shadow-2xs'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-ink-900 shadow-2xs'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <span className="text-cobalt-600 flex-shrink-0">
              <selectedOption.icon size={14} />
            </span>
          )}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          size={13}
          className={`text-slate-400 transition-transform duration-150 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-cobalt-600' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute z-[100] mt-1 w-full min-w-[200px] bg-white rounded-lg border border-slate-200 shadow-dropdown overflow-hidden p-1"
            onKeyDown={handleListKeyDown}
          >
            <div
              role="listbox"
              ref={listRef}
              className="max-h-60 overflow-y-auto space-y-0.5"
              tabIndex={-1}
            >
              {options.map((option, idx) => {
                const isSelected = option.value === value;
                const isFocused = idx === focusedIndex;
                const Icon = option.icon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(option.value)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cobalt-50 text-cobalt-700 font-semibold'
                        : isFocused
                        ? 'bg-slate-100 text-ink-900'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-ink-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {Icon && (
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-cobalt-100 text-cobalt-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon size={12} />
                        </div>
                      )}
                      <div className="truncate">
                        <p className="truncate">{option.label}</p>
                        {option.description && (
                          <p className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {option.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                          {option.badge}
                        </span>
                      )}
                      {isSelected && (
                        <span className="w-3.5 h-3.5 rounded-full bg-cobalt-600 text-white flex items-center justify-center text-[9px]">
                          <Check size={9} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
