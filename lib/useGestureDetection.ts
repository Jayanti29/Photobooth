'use client';
import { useEffect, useRef, useCallback } from 'react';

type GestureCallback = (gesture: string) => void;

export function useGestureDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  onGesture: GestureCallback,
  enabled: boolean = true
) {
  const recognizerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastGesture = useRef<string>('');
  const lastGestureTime = useRef<number>(0);

  const loadModel = useCallback(async () => {
    const { GestureRecognizer, FilesetResolver } =
      await import('@mediapipe/tasks-vision');

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    recognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }, []);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const recognizer = recognizerRef.current;

    if (video && recognizer && video.readyState >= 2) {
      const result = recognizer.recognizeForVideo(video, Date.now());
      const gesture = result?.gestures?.[0]?.[0]?.categoryName;

      if (gesture && gesture !== 'None') {
        const now = Date.now();
        // Debounce: same gesture can only fire every 2 seconds
        if (gesture !== lastGesture.current || now - lastGestureTime.current > 2000) {
          lastGesture.current = gesture;
          lastGestureTime.current = now;
          onGesture(gesture);
        }
      }
    }

    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef, onGesture]);

  useEffect(() => {
    if (!enabled) return;
    loadModel().then(() => {
      rafRef.current = requestAnimationFrame(detect);
    });
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, loadModel, detect]);
}