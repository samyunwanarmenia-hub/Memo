import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import type { Emotion } from '@/types/emotion';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface DetectionResult {
  emotion: Emotion;
  confidence: number;
}

interface EmotionDetectionState {
  videoRef: React.RefObject<HTMLVideoElement>;
  permission: PermissionState;
  isCameraAvailable: boolean;
  isLoadingModels: boolean;
  isDetecting: boolean;
  currentEmotion: Emotion | null;
  confidence: number;
  error: string | null;
  requestAccess: () => Promise<void>;
  stop: () => void;
  resetError: () => void;
}

const MODEL_URL = '/models';
const MIN_CONFIDENCE = 0.35;
const HISTORY_LENGTH = 8;

const expressionToEmotion = (expressions: faceapi.FaceExpressions): DetectionResult | null => {
  const entries = Object.entries(expressions) as Array<[keyof faceapi.FaceExpressions, number]>;
  if (!entries.length) {
    return null;
  }

  const [expression, confidence] = entries.sort((a, b) => b[1] - a[1])[0];
  if (confidence < MIN_CONFIDENCE) {
    return null;
  }

  const mapping: Partial<Record<keyof faceapi.FaceExpressions, Emotion>> = {
    neutral: 'neutral',
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    fearful: 'scared',
    disgusted: 'annoyed',
    surprised: 'surprised',
  };

  const emotion = mapping[expression];
  if (!emotion) {
    return null;
  }

  return { emotion, confidence };
};

const ensureModelsLoaded = async () => {
  if (!faceapi.nets.tinyFaceDetector.isLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  }
  if (!faceapi.nets.faceLandmark68Net.isLoaded) {
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  }
  if (!faceapi.nets.faceExpressionNet.isLoaded) {
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
  }
};

export const useEmotionDetection = (): EmotionDetectionState => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionFrame = useRef<number | null>(null);
  const historyRef = useRef<DetectionResult[]>([]);
  const modelsPromiseRef = useRef<Promise<void> | null>(null);

  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [isCameraAvailable, setIsCameraAvailable] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    setIsDetecting(false);
    if (detectionFrame.current) {
      cancelAnimationFrame(detectionFrame.current);
      detectionFrame.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetError = useCallback(() => setError(null), []);

  const updateEmotionFromHistory = useCallback(() => {
    const history = historyRef.current;
    if (!history.length) {
      setCurrentEmotion(null);
      setConfidence(0);
      return;
    }

    const counts = history.reduce<Record<Emotion, { total: number; hits: number }>>((acc, item) => {
      if (!acc[item.emotion]) {
        acc[item.emotion] = { total: 0, hits: 0 };
      }
      acc[item.emotion].total += 1;
      acc[item.emotion].hits += item.confidence;
      return acc;
    }, {} as Record<Emotion, { total: number; hits: number }>);

    const ranked = Object.entries(counts)
      .map(([emotion, stats]) => ({
        emotion: emotion as Emotion,
        score: stats.hits / stats.total,
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    setCurrentEmotion(best.emotion);
    setConfidence(Math.min(1, best.score));
  }, []);

  const detectFrame = useCallback(async () => {
    if (!isDetecting) {
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      detectionFrame.current = requestAnimationFrame(detectFrame);
      return;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.45,
          })
        )
        .withFaceExpressions();

      if (detection?.expressions) {
        const result = expressionToEmotion(detection.expressions);
        if (result) {
          historyRef.current = [...historyRef.current.slice(-(HISTORY_LENGTH - 1)), result];
          updateEmotionFromHistory();
        }
      } else {
        historyRef.current = historyRef.current.slice(-(HISTORY_LENGTH - 1));
        if (!historyRef.current.length) {
          setCurrentEmotion(null);
          setConfidence(0);
        }
      }
    } catch (err) {
      console.error('Emotion detection error:', err);
    }

    detectionFrame.current = requestAnimationFrame(detectFrame);
  }, [isDetecting, updateEmotionFromHistory]);

  const requestAccess = useCallback(async () => {
    resetError();

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      setIsCameraAvailable(false);
      setError('Камера не поддерживается в этом браузере.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some((device) => device.kind === 'videoinput');
      if (!hasVideo) {
        setIsCameraAvailable(false);
        setError('Камера не найдена. Подключите устройство и попробуйте снова.');
        return;
      }
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
    }

    if (!modelsPromiseRef.current) {
      setIsLoadingModels(true);
      modelsPromiseRef.current = ensureModelsLoaded().finally(() => setIsLoadingModels(false));
    }
    await modelsPromiseRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setPermission('granted');
      setIsCameraAvailable(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      historyRef.current = [];
      setIsDetecting(true);
      detectionFrame.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      console.error('Camera access error:', err);
      setPermission('denied');
      setIsCameraAvailable(false);
      setError('Доступ к камере отклонён. Разрешите использование камеры в настройках браузера.');
      stop();
    }
  }, [detectFrame, resetError, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    permission,
    isCameraAvailable,
    isLoadingModels,
    isDetecting,
    currentEmotion,
    confidence,
    error,
    requestAccess,
    stop,
    resetError,
  };
};

