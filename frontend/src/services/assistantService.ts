import api from './api';

export interface AssistantStep {
  page: string;
  label: string;
  say: string;
}

export interface AssistantReply {
  answer: string;
  facts: string[];
  tools: string[];
  navigate: string | null;
  steps: AssistantStep[];
  startTour: boolean;
  /** 'ai' = a language model chose the tools; 'keywords' = fixed keyword rules did. The numbers come from the app's own code either way. */
  mode: 'ai' | 'keywords';
  model: string | null;
}

export const assistantService = {
  status: (): Promise<{ ai: boolean; model: string | null }> => api.get('/assistant/status').then((r) => r.data),
  chat: (message: string): Promise<AssistantReply> => api.post('/assistant/chat', { message }).then((r) => r.data),
};
