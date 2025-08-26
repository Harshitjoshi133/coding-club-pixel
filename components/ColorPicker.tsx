import React from "react";

type ColorPickerProps = {
  selectedColor: string;
  onSelectColor: (color: string) => void;
};

const colors = ["#ef4444", "#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899"];

export default function ColorPicker({ selectedColor, onSelectColor }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2 p-2 rounded-md bg-gray-100">
      {colors.map((color) => (
        <div
          key={color}
          className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform duration-100 ease-in-out ${
            selectedColor === color ? "scale-110 border-blue-500" : "border-transparent"
          }`}
          style={{ backgroundColor: color }}
          onClick={() => onSelectColor(color)}
        ></div>
      ))}
    </div>
  );
}
