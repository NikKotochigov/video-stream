import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface StreamContextValue {
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;
  clearStream: () => void;
}

const StreamContext = createContext<StreamContextValue | null>(null);

export function StreamProvider({ children }: { children: ReactNode }) {
  const [stream, setStreamState] = useState<MediaStream | null>(null);

  const setStream = useCallback((next: MediaStream | null) => {
    setStreamState((prev) => {
      if (prev && prev !== next) {
        prev.getTracks().forEach((track) => track.stop());
      }
      return next;
    });
  }, []);

  const clearStream = useCallback(() => {
    setStream(null);
  }, [setStream]);

  const value = useMemo(
    () => ({ stream, setStream, clearStream }),
    [stream, setStream, clearStream],
  );

  return (
    <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
  );
}

export function useStream() {
  const ctx = useContext(StreamContext);
  if (!ctx) {
    throw new Error('useStream must be used within StreamProvider');
  }
  return ctx;
}
