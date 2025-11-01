import React, { useEffect, useState } from 'react';
import { Utensils, Gamepad, MessageSquare, Moon, Heart, Award, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type FeedbackType = 'feed' | 'play' | 'talk' | 'sleep' | 'tap' | 'levelUp';

interface ActionFeedbackProps {
  type: FeedbackType;
  id: number; // Unique ID to force re-render and re-trigger animation
}

const iconMap: Record<FeedbackType, React.ElementType> = {
  feed: Utensils,
  play: Gamepad,
  talk: MessageSquare,
  sleep: Moon,
  tap: Heart,
  levelUp: Award,
};

const messageMap: Record<FeedbackType, string> = {
  feed: 'Ням!',
  play: 'Ура!',
  talk: 'Мурр!',
  sleep: 'Ззз...',
  tap: '❤️',
  levelUp: '⬆️ Уровень!',
};

const colorMap: Record<FeedbackType, string> = {
  feed: 'text-green-500',
  play: 'text-yellow-500',
  talk: 'text-blue-400',
  sleep: 'text-indigo-400',
  tap: 'text-red-500',
  levelUp: 'text-purple-500',
};

const ActionFeedback: React.FC<ActionFeedbackProps> = ({ type, id }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true); // Ensure it's visible when component mounts/updates
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500); // Matches animation duration

    return () => clearTimeout(timer);
  }, [id]); // Re-run effect when ID changes

  if (!isVisible) return null;

  const IconComponent = iconMap[type] || Sparkles;
  const message = messageMap[type];
  const colorClass = colorMap[type];

  return (
    <div
      key={id} // Important for re-triggering animation
      className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        "flex items-center justify-center gap-1",
        "text-2xl font-bold",
        colorClass,
        "animate-fade-up-and-out pointer-events-none" // Apply animation and prevent interaction
      )}
    >
      <IconComponent size={24} />
      <span className="text-lg">{message}</span>
    </div>
  );
};

export default ActionFeedback;