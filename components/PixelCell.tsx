"use client";

import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "aspect-square border border-gray-200",
        {
          "cursor-pointer hover:opacity-90": !disabled && !isPlaced,
          "opacity-100": isPlaced,
        }
      )}
      style={{ 
        backgroundColor: isPlaced ? color : 'transparent',
        transition: 'background-color 0.2s ease'
      }}
      onClick={() => {
        if (!disabled && !isPlaced) {
          onClick(x, y);
        }
      }}
    />
  );
}