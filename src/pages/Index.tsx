import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import EmoPet from "@/components/EmoPet";
import ThoughtBubble from "@/components/ThoughtBubble";
import ActionFeedback from "@/components/ActionFeedback";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";
import { showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import type { Emotion } from "@/types/emotion";
import { allEmotions } from "@/types/emotion";
import { useEmotionDetection } from "@/hooks/useEmotionDetection";

type FeedbackType = 'feed' | 'play' | 'talk' | 'sleep' | 'tap' | 'levelUp';

interface PetState {
  mood: Emotion;
  lastInteractionTime: number;
}

const LOCAL_STORAGE_KEY = 'emoPetState';
const BOREDOM_THRESHOLD_MS = 30_000;
const DETECTION_CONFIDENCE_THRESHOLD = 0.45;

const getInitialPetState = (): PetState => {
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState) as PetState;
      return {
        mood: parsedState.mood ?? 'neutral',
        lastInteractionTime: parsedState.lastInteractionTime ?? Date.now(),
      };
    } catch (error) {
      console.warn('Не удалось прочитать состояние питомца из localStorage:', error);
    }
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
    case 'sleepy': return 'Хочет спать.';
    case 'angry': return 'Злится!';
    case 'neutral': return 'Спокоен.';
    case 'curious': return 'Любопытен.';
    case 'bored': return 'Скучает.';
    case 'scared': return 'Испуган!';
    case 'calm': return 'Расслаблен.';
    case 'love': return 'Полон любви!';
    case 'excited': return 'В восторге!';
    case 'confused': return 'Растерян.';
    case 'surprised': return 'Удивлён!';
    case 'annoyed': return 'Раздражён.';
    case 'shy': return 'Стесняется.';
    case 'proud': return 'Гордится!';
    case 'silly': return 'Шалит!';
    case 'determined': return 'Решителен!';
    case 'worried': return 'Волнуется.';
    case 'playful': return 'Игривый!';
    default: return 'Не знаю, что чувствую...';
  }
};

const getThoughtText = (emotion: Emotion) => {
  switch (emotion) {
    case 'happy': return 'Мне так хорошо!';
    case 'sad': return 'Немного грустно...';
    case 'sleepy': return 'Пожалуй, вздремну.';
    case 'angry': return 'Ррр!';
    case 'neutral': return '...';
    case 'curious': return 'Интересно, что это?';
    case 'bored': return 'Скучно...';
    case 'scared': return 'Ай-ай-ай!';
    case 'calm': return 'Ммм, хорошо.';
    case 'love': return 'Я тебя люблю!';
    case 'excited': return 'Ура!';
    case 'confused': return 'Что происходит?';
    case 'surprised': return 'Ого!';
    case 'annoyed': return 'Эх...';
    case 'shy': return '///';
    case 'proud': return 'Я большой молодец!';
    case 'silly': return 'Хи-хи!';
    case 'determined': return 'Я справлюсь!';
    case 'worried': return 'Немного переживаю...';
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
  const [currentCycleIndex, setCurrentCycleIndex] = useState(() => {
    const initialIndex = displayableEmotions.indexOf(petState.mood);
    return initialIndex === -1 ? 0 : initialIndex;
  });
  const [activeFeedback, setActiveFeedback] = useState<{ type: FeedbackType; id: number } | null>(null);
  const [isAutonomousMode, setIsAutonomousMode] = useState(false);
  const autonomousIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [eyeColor, setEyeColor] = useState<'default' | 'green' | 'blue' | 'red'>('default');
  const {
    videoRef: mirrorVideoRef,
    permission: cameraPermission,
    isCameraAvailable,
    isLoadingModels,
    isDetecting,
    currentEmotion: detectedEmotion,
    confidence: detectedConfidence,
    error: detectionError,
    requestAccess: requestEmotionDetection,
    stop: stopEmotionDetection,
    resetError: resetDetectionError,
  } = useEmotionDetection();
  const [isMirrorMode, setIsMirrorMode] = useState(false);
  const [showMirrorPreview, setShowMirrorPreview] = useState(true);
  const lastMirroredEmotionRef = useRef<Emotion | null>(null);
  const noFaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(petState));
  }, [petState]);

  useEffect(() => {
    if (isReady && user) {
      showSuccess(`Привет, ${user.first_name || 'друг'}!`);
      webApp?.expand();
    } else if (isReady && !user) {
      showSuccess('Готов начать!');
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

  const displayThought = useCallback((message: string | null, duration = 2000) => {
    if (!message) {
      setThoughtMessage(null);
      return;
    }
    if (thoughtTimeoutRef.current) {
      clearTimeout(thoughtTimeoutRef.current);
    }
    setThoughtMessage(message);
    thoughtTimeoutRef.current = setTimeout(() => {
      setThoughtMessage(null);
      thoughtTimeoutRef.current = null;
    }, duration);
  }, []);

  const displayActionFeedback = useCallback((type: FeedbackType) => {
    setActiveFeedback({ type, id: Date.now() });
  }, []);

  const resetInteractionTime = useCallback(() => {
    setPetState(prevState => ({ ...prevState, lastInteractionTime: Date.now() }));
  }, []);

  useEffect(() => {
    if (isMirrorMode) {
      return undefined;
    }

    const interval = setInterval(() => {
      setPetState(prevState => {
        const newMood = determineMood(prevState);
        if (newMood !== prevState.mood) {
          if (newMood === 'bored') {
            displayThought(getThoughtText('bored') || 'Мне скучно...', 2400);
          }
          return { ...prevState, mood: newMood };
        }
        return prevState;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [determineMood, displayThought, isMirrorMode]);

  const handleAutonomousEmotionChange = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * displayableEmotions.length);
    const newMood = displayableEmotions[randomIndex];
    setPetState(prevState => ({ ...prevState, mood: newMood, lastInteractionTime: Date.now() }));
    displayThought(getThoughtText(newMood) || '...');
  }, [displayThought]);

  useEffect(() => {
    if (isMirrorMode) {
      if (autonomousIntervalRef.current) {
        clearInterval(autonomousIntervalRef.current);
        autonomousIntervalRef.current = null;
      }
      return;
    }

    if (isAutonomousMode) {
      autonomousIntervalRef.current = setInterval(() => {
        handleAutonomousEmotionChange();
      }, 5000 + Math.random() * 5000);
    } else if (autonomousIntervalRef.current) {
      clearInterval(autonomousIntervalRef.current);
      autonomousIntervalRef.current = null;
    }

    return () => {
      if (autonomousIntervalRef.current) {
        clearInterval(autonomousIntervalRef.current);
      }
    };
  }, [isAutonomousMode, handleAutonomousEmotionChange, isMirrorMode]);

  useEffect(() => {
    if (isDetecting && cameraPermission === 'granted') {
      setIsMirrorMode(true);
      if (isAutonomousMode) {
        setIsAutonomousMode(false);
      }
    }
  }, [isDetecting, cameraPermission, isAutonomousMode]);

  useEffect(() => {
    if (cameraPermission === 'denied' || cameraPermission === 'unsupported') {
      setIsMirrorMode(false);
      stopEmotionDetection();
    }
  }, [cameraPermission, stopEmotionDetection]);

  useEffect(() => {
    if (!isMirrorMode) {
      if (noFaceTimeoutRef.current) {
        clearTimeout(noFaceTimeoutRef.current);
        noFaceTimeoutRef.current = null;
      }
      return;
    }

    if (detectedEmotion) {
      if (noFaceTimeoutRef.current) {
        clearTimeout(noFaceTimeoutRef.current);
        noFaceTimeoutRef.current = null;
      }
      if (detectedConfidence < DETECTION_CONFIDENCE_THRESHOLD) {
        return;
      }
      const isNewEmotion = lastMirroredEmotionRef.current !== detectedEmotion;
      lastMirroredEmotionRef.current = detectedEmotion;
      setPetState(prevState => {
        if (prevState.mood === detectedEmotion) {
          return { ...prevState, lastInteractionTime: Date.now() };
        }
        return { ...prevState, mood: detectedEmotion, lastInteractionTime: Date.now() };
      });
      if (isNewEmotion) {
        displayThought(getThoughtText(detectedEmotion) || 'Посмотри на меня!', 2000);
      }
      return;
    }

    if (!noFaceTimeoutRef.current) {
      noFaceTimeoutRef.current = setTimeout(() => {
        lastMirroredEmotionRef.current = null;
        setPetState(prevState => {
          if (prevState.mood === 'curious') {
            return prevState;
          }
          return { ...prevState, mood: 'curious', lastInteractionTime: Date.now() };
        });
      }, 3500);
    }
  }, [isMirrorMode, detectedEmotion, detectedConfidence, displayThought]);

  useEffect(() => {
    const targetIndex = displayableEmotions.indexOf(petState.mood);
    if (targetIndex !== -1 && targetIndex !== currentCycleIndex) {
      setCurrentCycleIndex(targetIndex);
    }
  }, [petState.mood, currentCycleIndex]);

  const handleMirrorModeToggle = useCallback(async () => {
    if (isMirrorMode) {
      setIsMirrorMode(false);
      stopEmotionDetection();
      lastMirroredEmotionRef.current = null;
      if (noFaceTimeoutRef.current) {
        clearTimeout(noFaceTimeoutRef.current);
        noFaceTimeoutRef.current = null;
      }
      return;
    }
    resetDetectionError();
    await requestEmotionDetection();
  }, [isMirrorMode, stopEmotionDetection, resetDetectionError, requestEmotionDetection]);

  const handlePetClick = useCallback(() => {
    setIsPetTapped(true);
    setTimeout(() => setIsPetTapped(false), 200);
    displayActionFeedback('tap');

    if (isMirrorMode) {
      displayThought('Я наблюдаю за тобой!', 1600);
      resetInteractionTime();
      return;
    }

    if (isAutonomousMode) {
      setIsAutonomousMode(false);
      setCurrentCycleIndex(displayableEmotions.indexOf('neutral'));
      setPetState(prevState => ({ ...prevState, mood: 'neutral', lastInteractionTime: Date.now() }));
      displayThought('Вернусь в нейтральное состояние.', 1800);
    } else {
      setCurrentCycleIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % cycleStates.length;
        const nextState = cycleStates[nextIndex];

        if (nextState === 'toggleAutonomous') {
          setIsAutonomousMode(true);
          displayThought('Включаю авто-режим!', 2000);
        } else {
          setPetState(prevState => ({ ...prevState, mood: nextState, lastInteractionTime: Date.now() }));
          displayThought(getThoughtText(nextState) || '...');
        }
        return nextIndex;
      });
    }
    resetInteractionTime();
  }, [isAutonomousMode, isMirrorMode, resetInteractionTime, handleAutonomousEmotionChange, displayThought, displayActionFeedback]);

  const mirrorStatusText = useMemo(() => {
    if (isMirrorMode) {
      if (detectionError) return detectionError;
      if (!isCameraAvailable) return 'Камера не найдена.';
      if (isLoadingModels) return 'Загружаю модели эмоций...';
      if (!detectedEmotion || detectedConfidence < DETECTION_CONFIDENCE_THRESHOLD) {
        return 'Ищу твоё выражение лица...';
      }
      return `Улавливаю: ${getMoodText(petState.mood)} (${Math.round(detectedConfidence * 100)}%)`;
    }
    if (cameraPermission === 'granted') {
      return 'Я готов повторять — нажми «Повторять меня».';
    }
    return 'Разреши доступ к камере, чтобы я смог подражать тебе.';
  }, [isMirrorMode, detectionError, isCameraAvailable, isLoadingModels, detectedEmotion, detectedConfidence, cameraPermission, petState.mood]);

  let emotionForEmoPet: Emotion = petState.mood;
  let currentStatusText: string;

  if (isMirrorMode) {
    currentStatusText = mirrorStatusText;
  } else if (isAutonomousMode) {
    currentStatusText = `Автономный режим: ${getMoodText(petState.mood)}`;
  } else if (cycleStates[currentCycleIndex] === 'toggleAutonomous') {
    emotionForEmoPet = 'curious';
    currentStatusText = 'Ещё один тап — и включу авто-режим!';
  } else {
    emotionForEmoPet = displayableEmotions[currentCycleIndex];
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
        <p className="text-xl font-semibold text-center text-foreground/90">{currentStatusText}</p>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Button size="sm" onClick={() => setEyeColor('default')} className="px-3 py-1 text-xs">По умолчанию</Button>
          <Button size="sm" onClick={() => setEyeColor('green')} className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600">Зелёные</Button>
          <Button size="sm" onClick={() => setEyeColor('blue')} className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600">Синие</Button>
          <Button size="sm" onClick={() => setEyeColor('red')} className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600">Красные</Button>
          <Button size="sm" onClick={() => {
            setCurrentCycleIndex(displayableEmotions.indexOf('calm'));
            setPetState(prev => ({ ...prev, mood: 'calm', lastInteractionTime: Date.now() }));
            displayThought(getThoughtText('calm') || '...');
          }} className="px-3 py-1 text-xs bg-[#cbe0c3] hover:bg-[#b0deab]">Спокойствие</Button>
        </div>

        <div className="w-full mt-6 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground/90">Зеркальный режим</p>
              <p className="text-xs text-muted-foreground">{mirrorStatusText}</p>
            </div>
            <Button
              size="sm"
              variant={isMirrorMode ? "default" : "outline"}
              onClick={handleMirrorModeToggle}
              disabled={isLoadingModels && !isMirrorMode}
            >
              {isMirrorMode ? 'Остановить' : 'Повторять меня'}
            </Button>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/60 aspect-video">
            <video
              ref={mirrorVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transition-opacity duration-300"
              style={{ opacity: showMirrorPreview ? 1 : 0, pointerEvents: showMirrorPreview ? 'auto' : 'none' }}
            />
            {!showMirrorPreview && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                <span>Предпросмотр скрыт</span>
              </div>
            )}
            {isMirrorMode && detectedEmotion && detectedConfidence >= DETECTION_CONFIDENCE_THRESHOLD && (
              <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                {getMoodText(detectedEmotion)} · {(detectedConfidence * 100).toFixed(0)}%
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={showMirrorPreview}
              onChange={(event) => setShowMirrorPreview(event.target.checked)}
            />
            Показывать мини-просмотр
          </label>
        </div>
      </div>
    </div>
  );
};

export default Index;
