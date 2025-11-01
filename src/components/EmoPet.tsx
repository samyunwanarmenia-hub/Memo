import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import type { Emotion } from '@/types/emotion';
import { emotionSoundscape } from '@/utils/emotionSounds';

interface EmoPetProps {
  emotion: Emotion;
  isTapped?: boolean;
  eyeColor?: 'default' | 'green' | 'blue' | 'red'; // New prop
}

// Глобальный множитель для размера глаз
const globalEyeScaleFactor = 1.5;

interface EyeConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  filter?: string;
}

interface EmotionConfig {
  leftEye: EyeConfig;
  rightEye: EyeConfig;
  pulseBaseScale?: number;
  pulseAmplitude?: number;
  jitterIntensity?: number;
  headTiltIntensity?: number;
}

const emotionConfigs: Record<Emotion, EmotionConfig> = {
  neutral: {
    leftEye: { x: 50, y: 68, width: 65, height: 65, filter: 'url(#neutralPulseGlow)' },
    rightEye: { x: 185, y: 68, width: 65, height: 65, filter: 'url(#neutralPulseGlow)' },
    pulseBaseScale: 1,
    pulseAmplitude: 0.015,
    jitterIntensity: 0.3,
    headTiltIntensity: 0.4,
  },
  happy: {
    leftEye: { x: 48, y: 64, width: 70, height: 70, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 183, y: 64, width: 70, height: 70, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 1.03,
    pulseAmplitude: 0.045,
    jitterIntensity: 0.6,
    headTiltIntensity: 0.8,
  },
  sad: {
    leftEye: { x: 53, y: 80, width: 60, height: 45, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 188, y: 80, width: 60, height: 45, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 0.96,
    pulseAmplitude: 0.007,
    jitterIntensity: 0.1,
    headTiltIntensity: 0.2,
  },
  sleepy: {
    leftEye: { x: 50, y: 88, width: 65, height: 8, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 185, y: 88, width: 65, height: 8, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 0.97,
    pulseAmplitude: 0.004,
    jitterIntensity: 0.05,
    headTiltIntensity: 0.1,
  },
  angry: {
    leftEye: { x: 45, y: 72, width: 70, height: 25, filter: 'url(#glow)' },
    rightEye: { x: 180, y: 72, width: 70, height: 25, filter: 'url(#glow)' },
    pulseBaseScale: 1.05,
    pulseAmplitude: 0.07,
    jitterIntensity: 1.5,
    headTiltIntensity: 1.5,
  },
  curious: {
    leftEye: { x: 45, y: 60, width: 70, height: 75, filter: 'url(#glow)' },
    rightEye: { x: 180, y: 60, width: 70, height: 75, filter: 'url(#glow)' },
    pulseBaseScale: 1.01,
    pulseAmplitude: 0.03,
    jitterIntensity: 0.8,
    headTiltIntensity: 0.9,
  },
  bored: {
    leftEye: { x: 52, y: 77, width: 60, height: 50, filter: 'url(#neutralPulseGlow)' },
    rightEye: { x: 187, y: 77, width: 60, height: 50, filter: 'url(#neutralPulseGlow)' },
    pulseBaseScale: 0.97,
    pulseAmplitude: 0.008,
    jitterIntensity: 0.18,
    headTiltIntensity: 0.28,
  },
  scared: {
    leftEye: { x: 40, y: 52, width: 85, height: 90, filter: 'url(#glow)' },
    rightEye: { x: 175, y: 52, width: 85, height: 90, filter: 'url(#glow)' },
    pulseBaseScale: 1.08,
    pulseAmplitude: 0.1,
    jitterIntensity: 1.8,
    headTiltIntensity: 1.8,
  },
  calm: {
    leftEye: { x: 48, y: 70, width: 68, height: 55, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 183, y: 70, width: 68, height: 55, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 0.99,
    pulseAmplitude: 0.006,
    jitterIntensity: 0.08,
    headTiltIntensity: 0.18,
  },
  love: {
    leftEye: { x: 45, y: 65, width: 75, height: 65, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 180, y: 65, width: 75, height: 65, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 1.04,
    pulseAmplitude: 0.05,
    jitterIntensity: 0.5,
    headTiltIntensity: 0.7,
  },
  excited: {
    leftEye: { x: 40, y: 50, width: 85, height: 95, filter: 'url(#glow)' },
    rightEye: { x: 175, y: 50, width: 85, height: 95, filter: 'url(#glow)' },
    pulseBaseScale: 1.09,
    pulseAmplitude: 0.12,
    jitterIntensity: 1.3,
    headTiltIntensity: 1.3,
  },
  confused: {
    leftEye: { x: 50, y: 60, width: 65, height: 65, filter: 'url(#neutralPulseGlow)' },
    rightEye: { x: 185, y: 70, width: 65, height: 65, filter: 'url(#neutralPulseGlow)' }, // Right eye lower
    pulseBaseScale: 1.0,
    pulseAmplitude: 0.02,
    jitterIntensity: 0.7,
    headTiltIntensity: 0.8,
  },
  surprised: {
    leftEye: { x: 40, y: 47, width: 90, height: 100, filter: 'url(#glow)' },
    rightEye: { x: 170, y: 47, width: 90, height: 100, filter: 'url(#glow)' },
    pulseBaseScale: 1.06,
    pulseAmplitude: 0.08,
    jitterIntensity: 1.0,
    headTiltIntensity: 1.0,
  },
  annoyed: {
    leftEye: { x: 50, y: 75, width: 65, height: 32, filter: 'url(#neutralPulseGlow)' },
    rightEye: { x: 185, y: 75, width: 65, height: 32, filter: 'url(#neutralPulseGlow)' },
    pulseBaseScale: 1.01,
    pulseAmplitude: 0.025,
    jitterIntensity: 0.6,
    headTiltIntensity: 0.7,
  },
  shy: {
    leftEye: { x: 55, y: 77, width: 50, height: 50, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 190, y: 77, width: 50, height: 50, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 0.98,
    pulseAmplitude: 0.01,
    jitterIntensity: 0.2,
    headTiltIntensity: 0.3,
  },
  proud: {
    leftEye: { x: 50, y: 62, width: 62, height: 60, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 185, y: 62, width: 62, height: 60, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 1.015,
    pulseAmplitude: 0.028,
    jitterIntensity: 0.4,
    headTiltIntensity: 0.55,
  },
  silly: {
    leftEye: { x: 45, y: 65, width: 70, height: 67, filter: 'url(#glow)' },
    rightEye: { x: 180, y: 65, width: 70, height: 67, filter: 'url(#glow)' },
    pulseBaseScale: 1.025,
    pulseAmplitude: 0.035,
    jitterIntensity: 0.9,
    headTiltIntensity: 1.0,
  },
  determined: {
    leftEye: { x: 45, y: 72, width: 70, height: 42, filter: 'url(#glow)' },
    rightEye: { x: 180, y: 72, width: 70, height: 42, filter: 'url(#glow)' },
    pulseBaseScale: 1.01,
    pulseAmplitude: 0.022,
    jitterIntensity: 0.55,
    headTiltIntensity: 0.65,
  },
  worried: {
    leftEye: { x: 48, y: 72, width: 65, height: 53, filter: 'url(#neutralPulseGlow)' },
    rightEye: { x: 183, y: 72, width: 65, height: 53, filter: 'url(#neutralPulseGlow)' },
    pulseBaseScale: 0.985,
    pulseAmplitude: 0.018,
    jitterIntensity: 0.45,
    headTiltIntensity: 0.55,
  },
  playful: {
    leftEye: { x: 50, y: 75, width: 65, height: 22, filter: 'url(#subtlePulseGlow)' },
    rightEye: { x: 185, y: 69, width: 65, height: 63, filter: 'url(#subtlePulseGlow)' },
    pulseBaseScale: 1.025,
    pulseAmplitude: 0.035,
    jitterIntensity: 0.75,
    headTiltIntensity: 0.85,
  },
};

// Вспомогательная функция для масштабирования и центрирования свойств глаза
const scaleAndCenterEye = (originalX: number, originalY: number, originalWidth: number, originalHeight: number) => {
  const newWidth = originalWidth * globalEyeScaleFactor;
  const newHeight = originalHeight * globalEyeScaleFactor;
  const newX = originalX - (newWidth - originalWidth) / 2;
  const newY = originalY - (newHeight - originalHeight) / 2;
  return { x: newX, y: newY, width: newWidth, height: newHeight };
};

const EmoPet: React.FC<EmoPetProps> = ({ emotion, isTapped = false, eyeColor = 'default' }) => {
  const [displayEmotion, setDisplayEmotion] = useState<Emotion>(emotion);
  const [isBlinking, setIsBlinking] = useState(false);
  const [targetGazeOffset, setTargetGazeOffset] = useState({ x: 0, y: 0 });
  const [randomGazeOffset, setRandomGazeOffset] = useState({ x: 0, y: 0 });
  const [currentGazeOffset, setCurrentGazeOffset] = useState({ x: 0, y: 0 });
  const [jitterOffset, setJitterOffset] = useState({ x: 0, y: 0 });
  const [microScale, setMicroScale] = useState(1);
  const [headTilt, setHeadTilt] = useState(0);
  const [eyeFilter, setEyeFilter] = useState<string | undefined>(undefined);
  const [angryFrame, setAngryFrame] = useState(0);
  const angryFrameCount = 20; // можно скорректировать по количеству файлов


  const petRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioReadyRef = useRef(false);
  const [audioReady, setAudioReady] = useState(false);

  const audioLevel = useAudioLevel();
  const audioEyeScale = 1 + audioLevel * 0.1;

  const [emotionPulseAnimationValue, setEmotionPulseAnimationValue] = useState(0);
  const [emotionPulseBaseScale, setEmotionPulseBaseScale] = useState(1);
  const [emotionPulseAmplitude, setEmotionPulseAmplitude] = useState(0);

  // New map for eye colors
  const eyeFillColorMap: Record<typeof eyeColor, string> = {
    default: 'hsl(0, 0%, 10%)', // Default dark color
    green: 'hsl(142.1 76.2% 36.3%)', // Tailwind green-500 equivalent
    blue: 'hsl(217.2 91.2% 59.8%)', // Tailwind blue-500 equivalent
    red: 'hsl(0 84.2% 60.2%)', // Tailwind red-500 equivalent
  };

  useEffect(() => {
    setDisplayEmotion(emotion);
  }, [emotion]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'click',
      'mousedown',
      'touchstart',
      'touchend',
      'keydown',
    ];

    const handleUnlock = () => {
      if (audioReadyRef.current) {
        return;
      }
      emotionSoundscape
        .unlock()
        .then((success) => {
          if (!success) {
            return;
          }
          audioReadyRef.current = true;
          setAudioReady(true);
          events.forEach((event) => {
            window.removeEventListener(event, handleUnlock);
            document.removeEventListener(event, handleUnlock);
          });
        })
        .catch((error) => {
          console.error('Failed to unlock audio context:', error);
        });
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUnlock, { passive: true });
      document.addEventListener(event, handleUnlock, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUnlock);
        document.removeEventListener(event, handleUnlock);
      });
    };
  }, []);

  const animate = useCallback(() => {
    const now = Date.now();
    const config = emotionConfigs[displayEmotion] || emotionConfigs.neutral;

    // Gaze
    const finalTargetX = targetGazeOffset.x || randomGazeOffset.x;
    const finalTargetY = targetGazeOffset.y || randomGazeOffset.y;
    setCurrentGazeOffset((prev) => {
      const smoothing = 0.15 + Math.random() * 0.05; // Smoother gaze
      return {
        x: prev.x + (finalTargetX - prev.x) * smoothing,
        y: prev.y + (finalTargetY - prev.y) * smoothing,
      };
    });

    // Random gaze
    if (Math.random() < 0.02) {
      if (targetGazeOffset.x === 0 && targetGazeOffset.y === 0) {
        const maxRandomOffset = 10;
        setRandomGazeOffset({
          x: (Math.random() * 2 - 1) * maxRandomOffset,
          y: (Math.random() * 2 - 1) * maxRandomOffset,
        });
      }
    }

    // Jitter
    const jitterIntensity = config.jitterIntensity || 0.4;
    setJitterOffset({
      x: (Math.random() - 0.5) * jitterIntensity * (Math.random() > 0.5 ? 1.2 : 0.8),
      y: (Math.random() - 0.5) * jitterIntensity * (Math.random() > 0.5 ? 1.1 : 0.9),
    });

    // Breathing
    setMicroScale(1 + Math.sin(now / 800) * 0.015); // Slower, more natural breathing

    // Head tilt
    const headTiltIntensity = config.headTiltIntensity || 0.5;
    setHeadTilt(Math.sin(now / 2000) * 2 * headTiltIntensity + (Math.random() - 0.5) * 0.5 * headTiltIntensity); // Subtle, random tilt

    // Pulse
    setEmotionPulseAnimationValue(Math.sin(now / 400));

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [displayEmotion, targetGazeOffset, randomGazeOffset, currentGazeOffset]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animate]);

  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      const duration = 80 + Math.random() * 120;
      setTimeout(() => {
        setIsBlinking(false);
        if (Math.random() < 0.2) {
          setTimeout(blink, 200);
        }
      }, duration);
    };

    const interval = setInterval(blink, 2000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isTapped) {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 120);
      setCurrentGazeOffset({ x: (Math.random() - 0.5) * 15, y: -10 });
      setHeadTilt((Math.random() - 0.5) * 5); // Head tilt on tap
    }
  }, [isTapped]);

  useEffect(() => {
    if (displayEmotion === 'angry') {
      const t = setInterval(() => setAngryFrame(f => (f + 1) % angryFrameCount), 80);
      return () => clearInterval(t);
    } else {
      setAngryFrame(0);
    }
  }, [displayEmotion]);

  useEffect(() => {
    if (!audioReady) return;
    emotionSoundscape.play(displayEmotion);
  }, [displayEmotion, audioReady]);

  useEffect(() => {
    return () => {
      emotionSoundscape.stop();
    };
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (petRef.current) {
      const rect = petRef.current.getBoundingClientRect();
      const petCenterX = rect.left + rect.width / 2;
      const petCenterY = rect.top + rect.height / 2;

      const mouseX = event.clientX;
      const mouseY = event.clientY;

      const deltaX = mouseX - petCenterX;
      const deltaY = mouseY - petCenterY;

      const maxOffset = 10;
      const offsetX = Math.max(-maxOffset, Math.min(maxOffset, deltaX * 0.1));
      const offsetY = Math.max(-maxOffset, Math.min(maxOffset, deltaY * 0.1));

      setTargetGazeOffset({ x: offsetX, y: offsetY });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTargetGazeOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const currentPetRef = petRef.current;
    if (currentPetRef) {
      currentPetRef.addEventListener('mousemove', handleMouseMove);
      currentPetRef.addEventListener('mouseleave', handleMouseLeave);
      currentPetRef.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          handleMouseMove(e.touches[0] as any);
        }
      });
      currentPetRef.addEventListener('touchend', handleMouseLeave);
    }

    return () => {
      if (currentPetRef) {
        currentPetRef.removeEventListener('mousemove', handleMouseMove);
        currentPetRef.removeEventListener('mouseleave', handleMouseLeave);
        currentPetRef.removeEventListener('touchmove', (e) => {
          if (e.touches.length > 0) {
            handleMouseMove(e.touches[0] as any);
          }
        });
        currentPetRef.removeEventListener('touchend', handleMouseLeave);
      }
    };
  }, [handleMouseMove, handleMouseLeave]);

  useEffect(() => {
    const config = emotionConfigs[displayEmotion] || emotionConfigs.neutral;
    setEmotionPulseBaseScale(config.pulseBaseScale || 1);
    setEmotionPulseAmplitude(config.pulseAmplitude || 0);
    setEyeFilter(config.leftEye.filter); // Assuming both eyes use the same filter
  }, [displayEmotion]);

  const eyeTransition = "transition-all duration-100 ease-[cubic-bezier(0.4,0,0.2,1)]"; // Faster transition for blinking

  const finalEmotionScale = emotionPulseBaseScale + (emotionPulseAnimationValue * emotionPulseAmplitude);

  const config = emotionConfigs[displayEmotion] || emotionConfigs.neutral;

  // Base eye dimensions and positions from config, scaled globally
  const baseLeftEye = scaleAndCenterEye(config.leftEye.x, config.leftEye.y, config.leftEye.width, config.leftEye.height);
  const baseRightEye = scaleAndCenterEye(config.rightEye.x, config.rightEye.y, config.rightEye.width, config.rightEye.height);

  // Gaze influence factors (normalized)
  const maxGazeOffset = 10; // Max value for currentGazeOffset.x/y
  const horizontalGazeInfluence = currentGazeOffset.x / maxGazeOffset; // -1 to 1
  const verticalGazeInfluence = currentGazeOffset.y / maxGazeOffset; // -1 to 1

  // Constants for gaze effect strength (increased for more impact)
  const gazeScaleStrength = 0.2;
  const gazeHorizontalShiftStrength = 0.15;
  const gazeVerticalShiftStrength = 10;

  // --- Left Eye Calculations ---
  let finalLeftEyeX = baseLeftEye.x + jitterOffset.x;
  let finalLeftEyeY = baseLeftEye.y + jitterOffset.y;
  let finalLeftEyeWidth = baseLeftEye.width * microScale * audioEyeScale * finalEmotionScale;
  let finalLeftEyeHeight = baseLeftEye.height * microScale * audioEyeScale * finalEmotionScale;

  // Apply horizontal gaze scaling and shifting
  if (horizontalGazeInfluence > 0) { // Looking right
      finalLeftEyeWidth *= (1 + horizontalGazeInfluence * gazeScaleStrength);
      finalLeftEyeHeight *= (1 + horizontalGazeInfluence * gazeScaleStrength); // Scale height too for proportion
      finalLeftEyeX -= (baseLeftEye.width * horizontalGazeInfluence * gazeHorizontalShiftStrength); // Shift left eye slightly left
  } else if (horizontalGazeInfluence < 0) { // Looking left
      finalLeftEyeWidth *= (1 - Math.abs(horizontalGazeInfluence) * gazeScaleStrength);
      finalLeftEyeHeight *= (1 - Math.abs(horizontalGazeInfluence) * gazeScaleStrength); // Scale height too
      finalLeftEyeX += (baseLeftEye.width * Math.abs(horizontalGazeInfluence) * gazeHorizontalShiftStrength); // Shift left eye slightly right
  }

  // Apply vertical gaze shifting
  finalLeftEyeY += (verticalGazeInfluence * gazeVerticalShiftStrength);

  // --- Right Eye Calculations ---
  let finalRightEyeX = baseRightEye.x + jitterOffset.x;
  let finalRightEyeY = baseRightEye.y + jitterOffset.y;
  let finalRightEyeWidth = baseRightEye.width * microScale * audioEyeScale * finalEmotionScale;
  let finalRightEyeHeight = baseRightEye.height * microScale * audioEyeScale * finalEmotionScale;

  // Apply horizontal gaze scaling and shifting
  if (horizontalGazeInfluence > 0) { // Looking right
      finalRightEyeWidth *= (1 - horizontalGazeInfluence * gazeScaleStrength);
      finalRightEyeHeight *= (1 - horizontalGazeInfluence * gazeScaleStrength); // Scale height too
      finalRightEyeX += (baseRightEye.width * horizontalGazeInfluence * gazeHorizontalShiftStrength); // Shift right eye slightly right
  } else if (horizontalGazeInfluence < 0) { // Looking left
      finalRightEyeWidth *= (1 + Math.abs(horizontalGazeInfluence) * gazeScaleStrength);
      finalRightEyeHeight *= (1 + Math.abs(horizontalGazeInfluence) * gazeScaleStrength); // Scale height too
      finalRightEyeX -= (baseRightEye.width * Math.abs(horizontalGazeInfluence) * gazeHorizontalShiftStrength); // Shift right eye slightly left
  }

  // Apply vertical gaze shifting
  finalRightEyeY += (verticalGazeInfluence * gazeVerticalShiftStrength);


  return (
    <div
      ref={petRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        "aspect-square w-full max-w-[20rem]",
        "animate-pulse-subtle animate-fidget-subtle",
        isTapped && "animate-tap-feedback"
      )}
      style={{ transform: `rotate(${headTilt}deg)` }} // Применяем наклон головы
    >
      {displayEmotion === 'angry' ? (
        <svg viewBox="0 0 300 300" className="w-full h-full">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.9
                0 0 0 0 0.9
                0 0 0 0 0.9
                0 0 0 1 0
              " result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="subtlePulseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 1 0
              " result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
              <animate attributeType="XML" attributeName="stdDeviation" from="4" to="6" dur="2s" repeatCount="indefinite" begin="0s;blur.end" />
              <animate attributeType="XML" attributeName="stdDeviation" from="6" to="4" dur="2s" repeatCount="indefinite" begin="blur.begin" />
            </filter>
            <filter id="neutralPulseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 1 0
              " result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
              <animate attributeType="XML" attributeName="stdDeviation" from="3" to="4" dur="2.5s" repeatCount="indefinite" begin="0s;blur.end" />
              <animate attributeType="XML" attributeName="stdDeviation" from="4" to="3" dur="2.5s" repeatCount="indefinite" begin="blur.begin" />
            </filter>
          </defs>

          {/* Left Eye Group */}
          <g filter={eyeFilter}>
            <rect
              x={finalLeftEyeX}
              y={finalLeftEyeY}
              width={finalLeftEyeWidth}
              height={finalLeftEyeHeight}
              className={cn(eyeTransition)}
              fill={eyeFillColorMap[eyeColor]}
              style={{ transform: `scaleY(${isBlinking ? 0.01 : 1})`, transformOrigin: 'center center' }}
            />
            <ellipse
              cx={finalLeftEyeX + finalLeftEyeWidth * 0.7 + currentGazeOffset.x * 0.5}
              cy={finalLeftEyeY + finalLeftEyeHeight * 0.3 + currentGazeOffset.y * 0.5}
              rx={finalLeftEyeWidth * 0.15}
              ry={finalLeftEyeHeight * 0.2}
              fill="white"
              className={cn(eyeTransition)}
              style={{ opacity: isBlinking ? 0 : 1 }}
            />
          </g>

          {/* Right Eye Group */}
          <g filter={eyeFilter}>
            <rect
              x={finalRightEyeX}
              y={finalRightEyeY}
              width={finalRightEyeWidth}
              height={finalRightEyeHeight}
              className={cn(eyeTransition)}
              fill={eyeFillColorMap[eyeColor]}
              style={{ transform: `scaleY(${isBlinking ? 0.01 : 1})`, transformOrigin: 'center center' }}
            />
            <ellipse
              cx={finalRightEyeX + finalRightEyeWidth * 0.3 + currentGazeOffset.x * 0.5} // Shifted to the left side of the right eye
              cy={finalRightEyeY + finalRightEyeHeight * 0.3 + currentGazeOffset.y * 0.5}
              rx={finalRightEyeWidth * 0.15}
              ry={finalRightEyeHeight * 0.2}
              fill="white"
              className={cn(eyeTransition)}
              style={{ opacity: isBlinking ? 0 : 1 }}
            />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 300 300" className="w-full h-full">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.9
                0 0 0 0 0.9
                0 0 0 0 0.9
                0 0 0 1 0
              " result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="subtlePulseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 1 0
              " result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
              <animate attributeType="XML" attributeName="stdDeviation" from="4" to="6" dur="2s" repeatCount="indefinite" begin="0s;blur.end" />
              <animate attributeType="XML" attributeName="stdDeviation" from="6" to="4" dur="2s" repeatCount="indefinite" begin="blur.begin" />
            </filter>
            <filter id="neutralPulseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 0 0.8
                0 0 0 1 0
              " result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
              <animate attributeType="XML" attributeName="stdDeviation" from="3" to="4" dur="2.5s" repeatCount="indefinite" begin="0s;blur.end" />
              <animate attributeType="XML" attributeName="stdDeviation" from="4" to="3" dur="2.5s" repeatCount="indefinite" begin="blur.begin" />
            </filter>
          </defs>

          {/* Left Eye Group */}
          <g filter={eyeFilter}>
            <rect
              x={finalLeftEyeX}
              y={finalLeftEyeY}
              width={finalLeftEyeWidth}
              height={finalLeftEyeHeight}
              className={cn(eyeTransition)}
              fill={eyeFillColorMap[eyeColor]}
              style={{ transform: `scaleY(${isBlinking ? 0.01 : 1})`, transformOrigin: 'center center' }}
            />
            <ellipse
              cx={finalLeftEyeX + finalLeftEyeWidth * 0.7 + currentGazeOffset.x * 0.5}
              cy={finalLeftEyeY + finalLeftEyeHeight * 0.3 + currentGazeOffset.y * 0.5}
              rx={finalLeftEyeWidth * 0.15}
              ry={finalLeftEyeHeight * 0.2}
              fill="white"
              className={cn(eyeTransition)}
              style={{ opacity: isBlinking ? 0 : 1 }}
            />
          </g>

          {/* Right Eye Group */}
          <g filter={eyeFilter}>
            <rect
              x={finalRightEyeX}
              y={finalRightEyeY}
              width={finalRightEyeWidth}
              height={finalRightEyeHeight}
              className={cn(eyeTransition)}
              fill={eyeFillColorMap[eyeColor]}
              style={{ transform: `scaleY(${isBlinking ? 0.01 : 1})`, transformOrigin: 'center center' }}
            />
            <ellipse
              cx={finalRightEyeX + finalRightEyeWidth * 0.3 + currentGazeOffset.x * 0.5} // Shifted to the left side of the right eye
              cy={finalRightEyeY + finalRightEyeHeight * 0.3 + currentGazeOffset.y * 0.5}
              rx={finalRightEyeWidth * 0.15}
              ry={finalRightEyeHeight * 0.2}
              fill="white"
              className={cn(eyeTransition)}
              style={{ opacity: isBlinking ? 0 : 1 }}
            />
          </g>
        </svg>
      )}
    </div>
  );
};

export default EmoPet;
