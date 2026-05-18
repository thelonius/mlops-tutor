import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { buildGlossaryConfig, type GlossaryConfig } from '../../lib/rehype-glossary';

const GlossaryContext = createContext<GlossaryConfig | null>(null);

// Глоссарий ~100KB raw / ~25KB gz — лениво грузим после маунта, чтобы
// initial chunk остался лёгким. До загрузки rehype-плагин ничего не
// делает, тултипы появятся когда придёт chunk.
export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GlossaryConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('../../lib/glossary-data').then(({ GLOSSARY }) => {
      if (cancelled) return;
      setConfig(buildGlossaryConfig(GLOSSARY));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <GlossaryContext.Provider value={config}>{children}</GlossaryContext.Provider>;
}

export function useGlossary(): GlossaryConfig | null {
  return useContext(GlossaryContext);
}
