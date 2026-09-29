import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export type AccountPersonaType = 'business' | 'self_employed' | 'personal';
export type PersonaType = 'business' | 'self_employed' | 'personal' | 'employee';

export interface PersonaConfig {
  type: PersonaType;
  title: string;
  badge: string;
  inflowLabel: string;
  outflowLabel: string;
  surplusLabel: string;
  loanLabel: string;
  tagline: string;
}

export const PERSONA_CONFIGS: Record<PersonaType, PersonaConfig> = {
  business: {
    type: 'business',
    title: 'Business Owner / SME',
    badge: 'Business Owner Mode',
    inflowLabel: 'Commercial Revenue (Cash In)',
    outflowLabel: 'Operating Expenses (Cash Out)',
    surplusLabel: 'Net Operating Profit',
    loanLabel: 'Commercial Debt & Credit Line',
    tagline: 'Company cashflow, GST billing, and corporate loan intelligence'
  },
  self_employed: {
    type: 'self_employed',
    title: 'Freelancer / Self-Employed',
    badge: 'Freelancer Mode',
    inflowLabel: 'Client Payouts & Retainers',
    outflowLabel: 'Freelance Burn & Expenses',
    surplusLabel: 'Freelance Net Margin',
    loanLabel: 'Micro-Business & Equipment Loan',
    tagline: 'Milestone invoicing, retainer tracking, and volatility-protected loans'
  },
  personal: {
    type: 'personal',
    title: 'Personal & Salaried Employee',
    badge: 'Personal Finance Mode',
    inflowLabel: 'Salary & Personal Income',
    outflowLabel: 'Personal & Household Expenses',
    surplusLabel: 'Net Personal Savings',
    loanLabel: 'Personal & Vehicle Loans',
    tagline: 'Personal daily expense tracking, salary budgets, and savings goals'
  },
  employee: {
    type: 'personal',
    title: 'Personal & Salaried Employee',
    badge: 'Personal Finance Mode',
    inflowLabel: 'Salary & Personal Income',
    outflowLabel: 'Personal & Household Expenses',
    surplusLabel: 'Net Personal Savings',
    loanLabel: 'Personal & Vehicle Loans',
    tagline: 'Personal daily expense tracking, salary budgets, and savings goals'
  }
};

interface PersonaContextValue {
  persona: PersonaType;
  accountPersona: AccountPersonaType;
  config: PersonaConfig;
  setPersona: (type: PersonaType) => Promise<void>;
  setAccountMode: (type: AccountPersonaType) => Promise<void>;
  toggleWorkPersonal: () => Promise<void>;
  canSwitchToPersonal: boolean;
  isLoading: boolean;
}

const PersonaContext = createContext<PersonaContextValue>({
  persona: 'business',
  accountPersona: 'business',
  config: PERSONA_CONFIGS.business,
  setPersona: async () => {},
  setAccountMode: async () => {},
  toggleWorkPersonal: async () => {},
  canSwitchToPersonal: false,
  isLoading: false,
});

export const PersonaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Base Account Mode set during Authentication
  const [accountPersona, setAccountPersona] = useState<AccountPersonaType>(() => {
    const saved = localStorage.getItem('bizpulse_account_persona') || localStorage.getItem('bizpulse_persona');
    if (saved === 'self_employed' || saved === 'personal' || saved === 'employee') {
      return saved === 'employee' ? 'personal' : (saved as AccountPersonaType);
    }
    return 'business';
  });

  // Active View Mode (can be switched between work and personal for business/freelancer)
  const [persona, setPersonaState] = useState<PersonaType>(() => {
    const savedView = localStorage.getItem('bizpulse_active_view');
    if (savedView === 'personal' || savedView === 'business' || savedView === 'self_employed') {
      return savedView as PersonaType;
    }
    const saved = localStorage.getItem('bizpulse_persona');
    if (saved === 'self_employed' || saved === 'personal' || saved === 'employee') {
      return saved === 'employee' ? 'personal' : (saved as PersonaType);
    }
    return 'business';
  });

  const setAccountMode = async (type: AccountPersonaType) => {
    const normalized: AccountPersonaType = (type as string) === 'employee' ? 'personal' : type;
    setAccountPersona(normalized);
    setPersonaState(normalized);
    localStorage.setItem('bizpulse_account_persona', normalized);
    localStorage.setItem('bizpulse_active_view', normalized);
    localStorage.setItem('bizpulse_persona', normalized);
    try {
      await api.patch('/users/profile', { persona_type: normalized });
    } catch {
      // Offline fallback
    }
  };

  const setPersona = async (type: PersonaType) => {
    const normalized: PersonaType = type === 'employee' ? 'personal' : type;
    setPersonaState(normalized);
    if (normalized === 'business' || normalized === 'self_employed') {
      setAccountPersona(normalized as AccountPersonaType);
      localStorage.setItem('bizpulse_account_persona', normalized);
    }
    localStorage.setItem('bizpulse_active_view', normalized);
    localStorage.setItem('bizpulse_persona', normalized);
    try {
      await api.patch('/users/profile', { persona_type: normalized });
    } catch {
      // Offline fallback
    }
  };

  const toggleWorkPersonal = async () => {
    if (accountPersona === 'personal') return;
    const nextMode: PersonaType = persona === 'personal' ? accountPersona : 'personal';
    setPersonaState(nextMode);
    localStorage.setItem('bizpulse_active_view', nextMode);
    localStorage.setItem('bizpulse_persona', nextMode);
    try {
      await api.patch('/users/profile', { persona_type: nextMode });
    } catch {
      // Offline fallback
    }
  };

  const canSwitchToPersonal = accountPersona === 'business' || accountPersona === 'self_employed';

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const res = await api.get('/users/profile');
        if (res.data?.persona_type) {
          const rawType = res.data.persona_type;
          const mappedType: AccountPersonaType = rawType === 'employee' ? 'personal' : (rawType as AccountPersonaType);
          setAccountPersona(mappedType);
          localStorage.setItem('bizpulse_account_persona', mappedType);
          
          const savedView = localStorage.getItem('bizpulse_active_view') as PersonaType;
          if (savedView === 'personal' && mappedType !== 'personal') {
            setPersonaState('personal');
          } else {
            setPersonaState(mappedType);
            localStorage.setItem('bizpulse_active_view', mappedType);
          }
        }
      } catch {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserProfile();
  }, []);

  return (
    <PersonaContext.Provider value={{
      persona,
      accountPersona,
      config: PERSONA_CONFIGS[persona] || PERSONA_CONFIGS.business,
      setPersona,
      setAccountMode,
      toggleWorkPersonal,
      canSwitchToPersonal,
      isLoading
    }}>
      {children}
    </PersonaContext.Provider>
  );
};

export const usePersona = () => useContext(PersonaContext);
