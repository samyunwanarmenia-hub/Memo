import { useState, useEffect, useRef } from 'react';

const SMOOTHING_FACTOR = 0.8; // Фактор сглаживания для более плавных изменений громкости
const MAX_VOLUME = 128; // Максимальное значение громкости для нормализации

export function useAudioLevel() {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const processAudio = () => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedVolume = Math.min(1, average / MAX_VOLUME); // Нормализация до 0-1

      setAudioLevel(prevLevel => prevLevel * SMOOTHING_FACTOR + normalizedVolume * (1 - SMOOTHING_FACTOR));
    }
    animationFrameRef.current = requestAnimationFrame(processAudio);
  };

  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256; // Размер FFT для анализа частот

        source.connect(analyserRef.current);

        animationFrameRef.current = requestAnimationFrame(processAudio);
      } catch (err) {
        console.error("Ошибка доступа к микрофону:", err);
        // Можно добавить toast уведомление об ошибке
      }
    };

    initAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return audioLevel;
}