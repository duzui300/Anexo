import { useCallback, useEffect, useRef, useState } from 'react';
import { startAiRequest, type AiStreamHandle } from './transport';
import type { AiSemanticRequest } from './types';

export type AiStreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface AiStreamState {
  text: string;
  status: AiStreamStatus;
  error: { code: string; message: string } | null;
  start: (request: AiSemanticRequest) => void;
  cancel: () => void;
  reset: () => void;
}

export function useAiStream(): AiStreamState {
  const handleRef = useRef<AiStreamHandle | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<AiStreamStatus>('idle');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setText('');
    setStatus((current) => (current === 'streaming' ? 'idle' : current));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setText('');
    setStatus('idle');
    setError(null);
  }, [cancel]);

  const start = useCallback(
    (request: AiSemanticRequest) => {
      cancel();
      setText('');
      setError(null);
      setStatus('streaming');

      handleRef.current = startAiRequest(request, {
        onDelta: (delta) => {
          setText((current) => current + delta);
        },
        onDone: (full) => {
          setText(full);
          setStatus('done');
          handleRef.current = null;
        },
        onError: (code, message) => {
          setError({ code, message });
          setStatus('error');
          handleRef.current = null;
        },
      });
    },
    [cancel],
  );

  useEffect(() => () => handleRef.current?.cancel(), []);

  return { text, status, error, start, cancel, reset };
}
