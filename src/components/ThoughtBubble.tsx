import React from 'react';
import { cn } from '@/lib/utils';

interface ThoughtBubbleProps {
  message: string | null;
  className?: string;
}

const ThoughtBubble: React.FC<ThoughtBubbleProps> = ({ message, className }) => {
  if (!message) return null;

  return (
    <div
      className={cn(
        "absolute -top-16 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-sm px-3 py-1.5 rounded-full shadow-md whitespace-nowrap z-10",
        "transition-opacity duration-300",
        className
      )}
    >
      {message}
      {/* Небольшой треугольник для эффекта "облачка" */}
      <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary"></div>
    </div>
  );
};

export default ThoughtBubble;