import { useEffect, useMemo, useState } from 'react';
import {
  categoryVisualKey,
  GeneratedVisualKind,
  getOrCreateGeneratedVisual,
  getVisualGenerationStatus,
  readGeneratedVisual,
  retryPendingVisualGeneration,
  taskVisualKey,
  VisualGenerationStatus,
  VISUAL_READY_EVENT,
  VISUAL_STATUS_EVENT,
} from '../services/visualAssetService';

export const useGeneratedVisual = (
  kind: GeneratedVisualKind,
  subject: string,
  details: string[] = [],
): {
  imageUrl: string | null;
  isGenerating: boolean;
  visualStatus: VisualGenerationStatus;
  retry: () => Promise<VisualGenerationStatus>;
} => {
  const detailSignature = details.slice(0, 4).join('|');
  const key = useMemo(
    () => kind === 'TASK_STICKER' ? taskVisualKey(subject, details[0] || '') : categoryVisualKey(subject, details),
    [kind, subject, detailSignature],
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [visualStatus, setVisualStatus] = useState<VisualGenerationStatus>(() => getVisualGenerationStatus());

  useEffect(() => {
    let cancelled = false;
    const handleReady = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; dataUrl?: string }>).detail;
      if (!cancelled && detail?.key === key && detail.dataUrl) {
        setImageUrl(detail.dataUrl);
        setIsGenerating(false);
      }
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<VisualGenerationStatus>).detail;
      if (!cancelled && detail?.state) setVisualStatus(detail);
    };
    window.addEventListener(VISUAL_READY_EVENT, handleReady);
    window.addEventListener(VISUAL_STATUS_EVENT, handleStatus);
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
      window.removeEventListener(VISUAL_READY_EVENT, handleReady);
      window.removeEventListener(VISUAL_STATUS_EVENT, handleStatus);
    };
  }, [key, kind, subject, detailSignature]);

  return {
    imageUrl,
    isGenerating,
    visualStatus,
    retry: retryPendingVisualGeneration,
  };
};
