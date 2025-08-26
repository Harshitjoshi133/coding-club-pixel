"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type PixelCellProps = {
  x: number;
  y: number;
  color: string;
  isPlaced: boolean;
  onClick: (x: number, y: number) => void;
  disabled: boolean;
};

export default function PixelCell({
  x,
  y,
  color,
  isPlaced,
  onClick,
  disabled,
}: PixelCellProps) {
  const [glow, setGlow] = useState(0);
  
  // Add flickering effect for placed pixels
  useEffect(() => {
    if (!isPlaced) return;
    
    const interval = setInterval(() => {
      // Wider range for more dramatic effect
      setGlow(0.6 + Math.random() * 0.8);
    }, 50 + Math.random() * 200); // Faster and more frequent flickering
    
    return () => clearInterval(interval);
  }, [isPlaced]);

  return (
    <div
      className={cn(
        "aspect-square relative overflow-hidden group",
        {
          "cursor-pointer hover:opacity-90": !disabled && !isPlaced,
          "opacity-95 hover:opacity-100": isPlaced,
        }
      )}
      style={{ 
        backgroundColor: isPlaced ? `${color}E6` : 'transparent',
        transition: 'all 0.3s ease',
        boxShadow: isPlaced 
          ? `0 0 20px 4px ${color}${Math.floor(glow * 255).toString(16).padStart(2, '0')}, 0 0 30px 10px ${color}40` 
          : '0 0 0 1px rgba(255, 255, 255, 0.03)',
        position: 'relative',
        zIndex: isPlaced ? 1 : 0,
      }}
    >
      {/* Simple grid line */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      />
      {/* Glow effect on hover */}
      {!isPlaced && (
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, transparent 70%)',
          }}
        />
      )}
      <div 
        className="absolute inset-0"
        onClick={() => {
          if (!disabled && !isPlaced) {
            onClick(x, y);
          }
        }}
      >
      {isPlaced && (
        <>
          <div 
            className="absolute inset-0"
            style={{
              background: color,
              filter: `brightness(${1 + glow * 0.5})`,
              transition: 'filter 0.3s ease',
            }}
          />
          <div 
            className="absolute inset-0 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${color}ff 0%, ${color}00 70%)`,
              opacity: glow * 0.7,
              transition: 'opacity 0.3s ease',
            }}
          />
        </>
      )}
      </div>
    </div>
  );
}