import React from 'react';
import { Button } from '@/components/ui/button';

interface PetControlsProps {
  onFeed: () => void;
  onPlay: () => void;
  onTalk: () => void;
  onSleep: () => void;
}

const PetControls: React.FC<PetControlsProps> = ({ onFeed, onPlay, onTalk, onSleep }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 p-4">
      <Button onClick={onFeed} className="w-32">Покормить</Button>
      <Button onClick={onPlay} className="w-32">Поиграть</Button>
      <Button onClick={onTalk} className="w-32">Поговорить</Button>
      <Button onClick={onSleep} className="w-32">Спать</Button>
    </div>
  );
};

export default PetControls;