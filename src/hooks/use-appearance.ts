import { useEffect, useState } from "react";
import {
  APPEARANCE_EVENT,
  DEFAULT_APPEARANCE,
  getAppearance,
  type Appearance,
} from "@/lib/ponto-storage";

export function useAppearance(): Appearance {
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let mounted = true;
    getAppearance().then((a) => {
      if (mounted) setAppearanceState(a);
    });
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Appearance>).detail;
      if (detail) setAppearanceState(detail);
      else getAppearance().then(setAppearanceState);
    };
    window.addEventListener(APPEARANCE_EVENT, onChange);
    return () => {
      mounted = false;
      window.removeEventListener(APPEARANCE_EVENT, onChange);
    };
  }, []);

  return appearance;
}