import { useEffect, useState } from "react";

export function useRememberedToggle(key: string, defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") {
      setOpen(false);
      return;
    }
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) {
        setOpen(saved === "1");
      } else {
        setOpen(false);
      }
    } catch {
      setOpen(false);
    }
  }, [key]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // ignore persistence errors
    }
  }, [key, open, mounted]);

  return { open, setOpen, mounted } as const;
}
