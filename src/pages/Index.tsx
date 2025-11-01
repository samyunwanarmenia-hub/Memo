import React, { useState, useEffect, useCallback, useRef } from 'react';
import EmoPet from "@/components/EmoPet";
import ThoughtBubble from "@/components/ThoughtBubble";
import ActionFeedback from "@/components/ActionFeedback";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";
import { showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import type { Emotion } from "@/types/emotion";
import { allEmotions } from "@/types/emotion";

type FeedbackType = 'feed' | 'play' | 'talk' | 'sleep' | 'tap' | 'levelUp';

interface PetState {
  mood: Emotion;
  lastInteractionTime: number; // Timestamp of last interaction
}

const LOCAL_STORAGE_KEY = 'emoPetState';
const BOREDOM_THRESHOLD_MS = 30 * 1000; // 30 секунд бездействия для скуки
const HAPPY_DURATION_MS = 5 * 1000; // 5 секунд счастья после взаимодействия

const getInitialPetState = (): PetState => {
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    return {
      ...parsedState,
      lastInteractionTime: parsedState.lastInteractionTime || Date.now(),
    };
  }

  return {
    mood: 'neutral',
    lastInteractionTime: Date.now(),
  };
};

const getMoodText = (emotion: Emotion) => {
  switch (emotion) {
    case 'happy': return 'Счастлив!';
    case 'sad': return 'Грустит...';
    case 'sleepy': return 'Сонный.';
    case 'angry': return 'Злится!';
    case 'neutral': return 'Спокойный.';
    case 'curious': return 'Любопытный.';
    case 'bored': return 'Скучает.';
    case 'scared': return 'Испуган!';
    case 'calm': return 'Спокойный.';
    case 'love': return 'Любит!';
    case 'excited': return 'Восхищен!';
    case 'confused': return 'Смущен.';
    case 'surprised': return 'Удивлен!';
    case 'annoyed': return 'Раздражен.';
    case 'shy': return 'Стесняется.';
    case 'proud': return 'Гордится!';
    case 'silly': return 'Шалит!';
    case 'determined': return 'Решителен!';
    case 'worried': return 'Беспокоится.';
    case 'playful': return 'Игривый!';
    default: return 'Неизвестно.';
  }
};

const getMoodTextForThought = (emotion: Emotion) => {
  switch (emotion) {
    case 'happy': return 'Я счастлив!';
    case 'sad': return 'Мне грустно...';
    case 'sleepy': return 'Хочу спать...';
    case 'angry': return 'Рррр!';
    case 'neutral': return '...';
    case 'curious': return 'Что это?';
    case 'bored': return 'Скучно...';
    case 'scared': return 'Ой-ой!';
    case 'calm': return 'Хорошо.';
    case 'love': return 'Я тебя люблю!';
    case 'excited': return 'Урааа!';
    case 'confused': return 'Что происходит?';
    case 'surprised': return 'Ого!';
    case 'annoyed': return 'Хмф!';
    case 'shy': return '///';
    case 'proud': return 'Я молодец!';
    case 'silly': return 'Хи-хи!';
    case 'determined': return 'Я смогу!';
    case 'worried': return 'Ох...';
    case 'playful': return 'Поиграем?';
    default: return null;
  }
};

type CycleState = Emotion | 'toggleAutonomous';

const displayableEmotions: Emotion[] = [...allEmotions];

const cycleStates: CycleState[] = [...displayableEmotions, 'toggleAutonomous'];

const Index = () => {
  const { webApp, user, isReady } = useTelegramWebApp();
  const [petState, setPetState] = useState<PetState>(getInitialPetState);
  const [isPetTapped, setIsPetTapped] = useState(false);
  const [thoughtMessage, setThoughtMessage] = useState<string | null>(null);
  const thoughtTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentCycleIndex, setCurrentCycleIndex] = useState(0);
  const [activeFeedback, setActiveFeedback] = useState<{ type: FeedbackType, id: number } | null>(null);
  const [isAutonomousMode, setIsAutonomousMode] = useState(false);
  const autonomousIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [eyeColor, setEyeColor] = useState<'default' | 'green' | 'blue' | 'red'>('default');

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(petState));
  }, [petState]);

  useEffect(() => {
    if (isReady && user) {
      showSuccess(`Привет, ${user.first_name || 'пользователь'}!`);
      webApp?.expand();
    } else if (isReady && !user) {
      showSuccess("Привет!");
      webApp?.expand();
    }
  }, [isReady, user, webApp]);

  const determineMood = useCallback((state: PetState): Emotion => {
    const now = Date.now();
    if (now - state.lastInteractionTime > BOREDOM_THRESHOLD_MS) {
      return 'bored';
    }
    return 'neutral';
  }, []);

  const displayThought = (message: string, duration = 2000) => {
    if (thoughtTimeoutRef.current) {
      clearTimeout(thoughtTimeoutRef.current);
    }
    setThoughtMessage(message);
    thoughtTimeoutRef.current = setTimeout(() => {
      setThoughtMessage(null);
      thoughtTimeoutRef.current = null;
    }, duration);
  };

  const displayActionFeedback = (type: FeedbackType) => {
    setActiveFeedback({ type, id: Date.now() });
  };

  const resetInteractionTime = useCallback(() => {
    setPetState(prevState => ({ ...prevState, lastInteractionTime: Date.now() }));
  }, []);

  // Passive mood changes (e.g., boredom)
  useEffect(() => {
    const interval = setInterval(() => {
      setPetState(prevState => {
        const newMood = determineMood(prevState);
        if (newMood !== prevState.mood) {
          if (newMood === 'bored') {
            displayThought(getMoodTextForThought('bored') || 'Скучно...');
          }
          return { ...prevState, mood: newMood };
        }
        return prevState;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [determineMood]);

  const handleAutonomousEmotionChange = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * displayableEmotions.length);
    const newMood = displayableEmotions[randomIndex];
    setPetState(prevState => ({ ...prevState, mood: newMood, lastInteractionTime: Date.now() }));
    displayThought(getMoodTextForThought(newMood) || '...');
  }, []);

  useEffect(() => {
    if (isAutonomousMode) {
      autonomousIntervalRef.current = setInterval(() => {
        handleAutonomousEmotionChange();
      }, 5000 + Math.random() * 5000);
    } else {
      if (autonomousIntervalRef.current) {
        clearInterval(autonomousIntervalRef.current);
        autonomousIntervalRef.current = null;
      }
    }
    return () => {
      if (autonomousIntervalRef.current) {
        clearInterval(autonomousIntervalRef.current);
      }
    };
  }, [isAutonomousMode, handleAutonomousEmotionChange]);

  const handlePetClick = useCallback(() => {
    setIsPetTapped(true);
    setTimeout(() => setIsPetTapped(false), 200); // Reset tap state after animation

    if (isAutonomousMode) {
      // If in autonomous mode, clicking disables it and sets to neutral
      setIsAutonomousMode(false);
      setCurrentCycleIndex(displayableEmotions.indexOf('neutral')); // Reset to neutral emotion index
      setPetState(prevState => ({ ...prevState, mood: 'neutral', lastInteractionTime: Date.now() }));
      displayThought('Авто-режим выключен.');
    } else {
      // If not in autonomous mode, cycle through states
      setCurrentCycleIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % cycleStates.length;
        const nextState = cycleStates[nextIndex];

        if (nextState === 'toggleAutonomous') {
          setIsAutonomousMode(true);
          displayThought('Авто-режим включен!');
          // The useEffect for autonomous mode will pick this up and start the interval
        } else {
          setPetState(prevState => ({ ...prevState, mood: nextState, lastInteractionTime: Date.now() }));
          displayThought(getMoodTextForThought(nextState) || '...');
        }
        return nextIndex;
      });
    }
    resetInteractionTime();
  }, [isAutonomousMode, resetInteractionTime, handleAutonomousEmotionChange]);


  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>Загрузка Telegram WebApp...</p>
      </div>
    );
  }

  let emotionForEmoPet: Emotion;
  let currentStatusText: string;

  if (isAutonomousMode) {
    emotionForEmoPet = petState.mood;
    currentStatusText = `Авто-режим: ${getMoodText(petState.mood)}`;
  } else if (cycleStates[currentCycleIndex] === 'toggleAutonomous') {
    emotionForEmoPet = 'curious'; // Or neutral, to indicate a special state
    currentStatusText = 'Нажмите, чтобы включить авто-режим';
  } else {
    emotionForEmoPet = cycleStates[currentCycleIndex] as Emotion;
    currentStatusText = getMoodText(emotionForEmoPet);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-md relative">
        <ThoughtBubble message={thoughtMessage} />
        {activeFeedback && <ActionFeedback type={activeFeedback.type} id={activeFeedback.id} />}
        <div onClick={handlePetClick} className="cursor-pointer w-full max-w-[20rem] aspect-square">
          <EmoPet emotion={emotionForEmoPet} isTapped={isPetTapped} eyeColor={eyeColor} />
        </div>
        <p className="text-xl font-semibold text-center">{currentStatusText}</p>

        {/* Eye color selection buttons */}
        <div className="flex gap-1 mt-4">
          <Button size="sm" onClick={() => setEyeColor('default')} className="w-8 h-4 p-0 text-[0.5rem] leading-none">
            Обыч.
          </Button>
          <Button size="sm" onClick={() => setEyeColor('green')} className="w-8 h-4 p-0 text-[0.5rem] leading-none bg-green-500 hover:bg-green-600">
            Зел.
          </Button>
          <Button size="sm" onClick={() => setEyeColor('blue')} className="w-8 h-4 p-0 text-[0.5rem] leading-none bg-blue-500 hover:bg-blue-600">
            Син.
          </Button>
          <Button size="sm" onClick={() => setEyeColor('red')} className="w-8 h-4 p-0 text-[0.5rem] leading-none bg-red-500 hover:bg-red-600">
            Крас.
          </Button>
          <Button size="sm" onClick={() => { setCurrentCycleIndex(displayableEmotions.indexOf('calm')); setPetState(prev=>({ ...prev, mood: 'calm', lastInteractionTime: Date.now() })); }} className="w-16 h-6 p-0 text-xs leading-none bg-[#cbe0c3] hover:bg-[#b0deab]">
            Спокойно
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
