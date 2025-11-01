import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface PetProgressProps {
  level: number;
  experience: number;
  xpForNextLevel: number;
}

const PetProgress: React.FC<PetProgressProps> = ({ level, experience, xpForNextLevel }) => {
  const progressValue = (experience / xpForNextLevel) * 100;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Уровень: {level}</p>
          <p className="text-sm text-muted-foreground">Опыт: {experience} / {xpForNextLevel}</p>
        </div>
        <Progress value={progressValue} className="h-2" />
      </CardContent>
    </Card>
  );
};

export default PetProgress;