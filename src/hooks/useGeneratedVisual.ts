import { useEffect, useMemo, useState } from 'react';
import {
  categoryVisualKey,
  GeneratedVisualKind,
  getOrCreateGeneratedVisual,
  readGeneratedVisual,
  taskVisualKey,
} from '../services/visualAssetService';

export const useGeneratedVisual = (
  kind: GeneratedVisualKind,
  subject: string,
  details: string[] = [],
): { imageUrl: string | null; isGenerating: boolean } => {
  const detailSignature = details.slice(0, 4).join('|');
  const key = useMemo(
    () => kind === 'TASK_STICKER' ? taskVisualKey(subject, details[0] || '') : categoryVisualKey(subject, details),
    [kind, subject, detailSignature],
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImageUrl(null);
    setIsGenerating(true);
    void readGeneratedVisual(key).then((cached) => {
      if (cancelled) return;
      if (cached) {
        setImageUrl(cached);
        setIsGenerating(false);
        return;
      }
      void getOrCreateGeneratedVisual(key, kind, subject, details).then((generated) => {
        if (!cancelled) setImageUrl(generated);
      }).finally(() => {
        if (!cancelled) setIsGenerating(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key, kind, subject, detailSignature]);

  return { imageUrl, isGenerating };
};
