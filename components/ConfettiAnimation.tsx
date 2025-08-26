"use client";

import { useEffect, useRef } from "react";
import confetti from "confetti-js";

export default function ConfettiAnimation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const confettiSettings = {
        target: canvasRef.current,
        max: 80,
        size: 1.5,
      };
      
      const confettiInstance = confetti(confettiSettings);

      return () => {
        if (confettiInstance) {
          confettiInstance.clear();
        }
      };
    }
  }, []);

  return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full pointer-events-none" />;
}
