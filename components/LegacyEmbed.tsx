"use client";

import { useEffect, useRef } from "react";

type LegacyEmbedProps = {
  src: string;
  title: string;
  minHeight?: number;
};

export default function LegacyEmbed({ src, title, minHeight = 1600 }: LegacyEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleLoad = () => {
      try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc) return;
        const height = doc.body.scrollHeight + 48;
        frame.style.height = `${Math.max(minHeight, height)}px`;
      } catch (error) {
        console.warn("LegacyEmbed: unable to resize iframe", error);
      }
    };

    frame.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      frame.removeEventListener("load", handleLoad);
    };
  }, [minHeight]);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className="w-full rounded-xl border border-gray-200 bg-white shadow-sm"
        style={{ minHeight: `${minHeight}px` }}
      />
    </div>
  );
}
