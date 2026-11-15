import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const c = animate(prev.current, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(v) });
    prev.current = value; return () => c.stop();
  }, [value]);
  return <span className="mono">{shown.toFixed(decimals)}</span>;
}
