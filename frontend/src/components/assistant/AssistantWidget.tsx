import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Mic, Send, Square, Volume2, VolumeX, X } from 'lucide-react';
import { assistantService } from '../../services/assistantService';
import type { AssistantStep } from '../../services/assistantService';
import { useTour } from '../../context/TourContext';
import { MIC_ERRORS, canListen, canSpeak, createRecognition, speak, stopSpeaking } from '../../utils/speech';
import type { Recognition } from '../../utils/speech';

interface Message {
  id: number;
  from: 'user' | 'assistant';
  text: string;
  note?: string;
}

const SUGGESTIONS = [
  'Which deals should we prioritise today?',
  'How am I doing this month?',
  'Who owes me money?',
  'What happens if we add two sales reps?',
  'Show me around',
];

const GREETING =
  'Hi, I am the Bizpulse assistant. Ask me about your deals, invoices, expenses, contracts or goals and I will answer from your own data and open the right page. You can type, or press the microphone and talk.';

const readPref = (key: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};
const writePref = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage blocked */
  }
};

/** Floating assistant: chat and voice. It answers from the signed-in user's data and can open pages. */
export const AssistantWidget: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { restartTour, isOpen: tourOpen } = useTour();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: 'assistant', text: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [walking, setWalking] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(() => readPref('bizpulse_assistant_voice', true));

  const recRef = useRef<Recognition | null>(null);
  const walkRef = useRef(0);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const voiceRepliesRef = useRef(voiceReplies);
  voiceRepliesRef.current = voiceReplies;

  const { data: status } = useQuery({ queryKey: ['assistant-status'], queryFn: assistantService.status, enabled: open, staleTime: 300_000, retry: false });

  const add = useCallback((from: Message['from'], text: string, note?: string) => {
    setMessages((m) => [...m, { id: idRef.current++, from, text, note }]);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, heard, busy]);

  const stopEverything = useCallback(() => {
    walkRef.current++;
    setWalking(false);
    stopSpeaking();
    recRef.current?.abort();
    setListening(false);
    setHeard('');
  }, []);

  useEffect(() => stopEverything, [stopEverything]);

  // "Show me around": open each page in turn and describe it, until the end or Stop.
  const walk = useCallback(
    async (steps: AssistantStep[]) => {
      const token = ++walkRef.current;
      setWalking(true);
      for (const step of steps) {
        if (walkRef.current !== token) return;
        navigate(step.page);
        add('assistant', step.say);
        await new Promise<void>((resolve) => {
          if (voiceRepliesRef.current && canSpeak()) speak(step.say, resolve);
          else setTimeout(resolve, 3500);
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      if (walkRef.current === token) {
        setWalking(false);
        add('assistant', 'That is every page. Ask me anything, or start in DecisionForge by adding your data.');
      }
    },
    [add, navigate],
  );

  const startListening = useCallback(() => {
    const rec = createRecognition();
    if (!rec) return;
    stopSpeaking();
    recRef.current = rec;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setHeard(finalText || interim);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') add('assistant', MIC_ERRORS[e.error] || 'I could not use the microphone. You can type instead.');
    };
    rec.onend = () => {
      setListening(false);
      setHeard('');
      const said = finalText.trim();
      if (said) void sendRef.current(said, true);
    };
    setListening(true);
    setHeard('');
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [add]);

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const question = text.trim();
      if (!question || busy) return;
      walkRef.current++;
      setWalking(false);
      stopSpeaking();
      setInput('');
      add('user', question);
      setBusy(true);
      try {
        const reply = await assistantService.chat(question);
        const note = reply.mode === 'ai' ? 'Understood by AI · numbers from your data' : 'Matched by keywords · numbers from your data';
        add('assistant', reply.answer, note);
        if (reply.tools.includes('sales_decisions')) queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('decision') });
        if (reply.startTour) {
          setOpen(false);
          restartTour();
          return;
        }
        if (reply.steps.length > 0) {
          void walk(reply.steps);
          return;
        }
        if (reply.navigate) navigate(reply.navigate);
        if (voiceRepliesRef.current && canSpeak()) {
          // A spoken question gets a spoken answer, then the microphone opens again for the next one.
          speak(reply.answer, () => {
            if (viaVoice && canListen()) startListening();
          });
        }
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (err as any)?.response?.data?.message;
        add('assistant', typeof msg === 'string' ? msg : 'I could not reach the server. Please try again in a moment.');
      } finally {
        setBusy(false);
      }
    },
    [add, busy, navigate, queryClient, restartTour, startListening, walk],
  );
  const sendRef = useRef(send);
  sendRef.current = send;

  const toggleVoiceReplies = () => {
    const next = !voiceReplies;
    setVoiceReplies(next);
    writePref('bizpulse_assistant_voice', next);
    if (!next) stopSpeaking();
  };

  const close = () => {
    stopEverything();
    setOpen(false);
  };

  if (tourOpen) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="assistant-open"
        aria-label="Open the Bizpulse assistant"
        className="fixed bottom-4 right-4 z-40 flex items-center justify-center gap-2 w-12 sm:w-auto sm:pl-3 sm:pr-4 h-12 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold shadow-lg shadow-violet-600/30 cursor-pointer transition"
      >
        <Bot size={18} />
        <span className="hidden sm:inline">Ask Bizpulse</span>
      </button>
    );
  }

  return (
    <section
      data-testid="assistant-panel"
      aria-label="Bizpulse assistant"
      className="fixed z-40 bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[24rem] h-[70vh] sm:h-[34rem] max-h-[calc(100vh-1rem)] flex flex-col bg-white border border-slate-200 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
    >
      <header className="flex items-center gap-2 px-4 py-3 bg-violet-600 text-white shrink-0">
        <Bot size={18} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-tight">Bizpulse assistant</p>
          <p className="text-[11px] text-violet-100 truncate" data-testid="assistant-mode">
            {status ? (status.ai ? 'AI understanding on · answers from your data' : 'Keyword mode · answers from your data') : 'Answers from your data'}
          </p>
        </div>
        {canSpeak() && (
          <button
            type="button"
            onClick={toggleVoiceReplies}
            aria-pressed={voiceReplies}
            aria-label={voiceReplies ? 'Turn spoken replies off' : 'Turn spoken replies on'}
            title={voiceReplies ? 'Spoken replies are on' : 'Spoken replies are off'}
            className="p-2 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            {voiceReplies ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        )}
        <button type="button" onClick={close} aria-label="Close the assistant" className="p-2 rounded-lg hover:bg-white/15 cursor-pointer">
          <X size={16} />
        </button>
      </header>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              data-testid={m.from === 'assistant' ? 'assistant-message' : 'user-message'}
              className={`max-w-[88%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                m.from === 'user' ? 'bg-violet-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
              }`}
            >
              {m.text}
              {m.note && <span className="block mt-1.5 text-[10px] font-semibold text-slate-400">{m.note}</span>}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-slate-400 px-1">Working it out…</p>}
        {listening && (
          <p className="text-xs text-violet-700 font-semibold px-1" data-testid="assistant-listening">
            Listening… {heard}
          </p>
        )}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="px-2.5 py-1.5 rounded-full bg-white border border-slate-200 hover:border-violet-300 text-[11.5px] font-semibold text-slate-700 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {walking && (
        <div className="px-3 py-2 bg-violet-50 border-t border-violet-100 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-semibold text-violet-800">Showing you around…</span>
          <button type="button" onClick={stopEverything} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-violet-200 text-xs font-bold text-violet-800 cursor-pointer">
            <Square size={10} /> Stop
          </button>
        </div>
      )}

      <form
        className="flex items-center gap-2 p-3 border-t border-slate-200 bg-white shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        {canListen() && (
          <button
            type="button"
            onClick={() => (listening ? recRef.current?.stop() : startListening())}
            data-testid="assistant-mic"
            aria-label={listening ? 'Stop listening' : 'Talk to the assistant'}
            aria-pressed={listening}
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center cursor-pointer transition ${
              listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {listening ? <Square size={14} /> : <Mic size={16} />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder={canListen() ? 'Type, or press the microphone' : 'Type your question'}
          aria-label="Your question"
          data-testid="assistant-input"
          className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          data-testid="assistant-send"
          className="w-10 h-10 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer"
        >
          <Send size={15} />
        </button>
      </form>
    </section>
  );
};
