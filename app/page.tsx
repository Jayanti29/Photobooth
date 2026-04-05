'use client';
import {
  captureFrame, buildBoothStrip, downloadImage,
  saveToLocalStorage, loadFromLocalStorage,
  type CapturedPhoto,
} from '../lib/CapturePhoto';
import { useRef, useEffect, useState, useCallback } from 'react';
export default function Home() {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const recognizerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastGestureRef = useRef<string>('');
  const lastGestureTimeRef = useRef<number>(0);
  const flashRef = useRef<HTMLDivElement>(null);
 
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [activeScreen, setActiveScreen] = useState<'welcome' | 'camera' | 'booth'>('welcome');
  const [activeFilter, setActiveFilter] = useState('none');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [currentPose, setCurrentPose] = useState('');
  const [boothRunning, setBoothRunning] = useState(false);
  const [photos, setPhotos] = useState<boolean[]>([false, false, false, false]);
  const [sessionDone, setSessionDone] = useState(false);
  const [gestureLabel, setGestureLabel] = useState('');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
 
  const poses = [
    "Strike your best pose! ✨",
    "Peace sign time! ✌️",
    "Silly face go! 😜",
    "Last one — look stunning 🌸",
  ];
 
  const FILTERS: Record<string, string> = {
    none:    'none',
    vintage: 'sepia(0.6) contrast(1.1) brightness(0.9)',
    pink:    'saturate(1.4) brightness(1.1) hue-rotate(330deg)',
    y2k:     'saturate(1.8) contrast(1.15)',
    bw:      'grayscale(1) contrast(1.2)',
  };
 
  const FILTER_KEYS = Object.keys(FILTERS);
 
  // ── Camera ──────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      });
      setStream(s);
      setHasPermission(true);
      if (webcamRef.current) webcamRef.current.srcObject = s;
    } catch {
      setHasPermission(false);
    }
  }, []);
 
  useEffect(() => {
    if (activeScreen === 'camera' || activeScreen === 'booth') {
      startCamera();
    }
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [activeScreen]);
 
  useEffect(() => {
    if (webcamRef.current && stream) webcamRef.current.srcObject = stream;
  }, [stream]);
 
  // ── Flash helper ─────────────────────────────────────────
  const triggerFlash = useCallback(() => {
    const el = flashRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0.95';
    setTimeout(() => {
      el.style.transition = 'opacity 0.45s ease';
      el.style.opacity = '0';
    }, 80);
  }, []);
 
  // ── Timer countdown ──────────────────────────────────────
  const startTimer = useCallback((seconds: number) => {
    if (timerActive) return;
    setTimerActive(true);
    let t = seconds;
    const tick = () => {
      setCountdown(t);
      if (t === 0) {
        triggerFlash();
        setTimeout(() => { setCountdown(null); setTimerActive(false); }, 400);
        return;
      }
      t--;
      setTimeout(tick, 1000);
    };
    tick();
  }, [timerActive, triggerFlash]);
 
  // ── MediaPipe gesture detection ──────────────────────────
  const loadGestureModel = useCallback(async () => {
    try {
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
      setModelLoaded(true);
    } catch (e) {
      console.warn('Gesture model failed to load:', e);
    }
  }, []);
 
  const handleGesture = useCallback((gesture: string) => {
    const GESTURE_LABELS: Record<string, string> = {
      Victory:    '✌️ Peace — Capture!',
      Thumb_Up:   '👍 Timer started!',
      Open_Palm:  '✋ Filter changed!',
      ILoveYou:   '🤟 Hey there!',
      Pointing_Up:'☝️ Zoom mode!',
      Closed_Fist:'✊ Booth mode!',
    };
    const label = GESTURE_LABELS[gesture];
    if (label) {
      setGestureLabel(label);
      setTimeout(() => setGestureLabel(''), 2000);
    }
 
    if (gesture === 'Victory') {
      triggerFlash();
    }
    if (gesture === 'Thumb_Up') {
      startTimer(5);
    }
    if (gesture === 'Open_Palm') {
      setActiveFilter(prev => {
        const idx = FILTER_KEYS.indexOf(prev);
        return FILTER_KEYS[(idx + 1) % FILTER_KEYS.length];
      });
    }
    if (gesture === 'Closed_Fist' && activeScreen === 'camera') {
      setActiveScreen('booth');
    }
  }, [triggerFlash, startTimer, activeScreen, FILTER_KEYS]);
 
  // Detection loop
  const detectLoop = useCallback(() => {
    const video = webcamRef.current;
    const recognizer = recognizerRef.current;
    if (video && recognizer && video.readyState >= 2) {
      try {
        const result = recognizer.recognizeForVideo(video, Date.now());
        const gesture = result?.gestures?.[0]?.[0]?.categoryName;
        if (gesture && gesture !== 'None') {
          const now = Date.now();
          if (
            gesture !== lastGestureRef.current ||
            now - lastGestureTimeRef.current > 2000
          ) {
            lastGestureRef.current = gesture;
            lastGestureTimeRef.current = now;
            handleGesture(gesture);
          }
        }
      } catch {}
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [handleGesture]);
 
  useEffect(() => {
    if (activeScreen === 'camera') {
      loadGestureModel().then(() => {
        rafRef.current = requestAnimationFrame(detectLoop);
      });
    }
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [activeScreen]);
 
  // ── Korean booth session ─────────────────────────────────
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
 
  const runBooth = async () => {
    if (boothRunning) return;
    setBoothRunning(true);
    setSessionDone(false);
    setShotsTaken(0);
    setPhotos([false, false, false, false]);
 
    for (let i = 0; i < 4; i++) {
      setCurrentPose(poses[i]);
      await sleep(1200);
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await sleep(900);
      }
      setCountdown(0);
      triggerFlash();
      await sleep(350);
      setCountdown(null);
      setPhotos(prev => prev.map((v, idx) => idx === i ? true : v));
      setShotsTaken(i + 1);
      await sleep(1400);
    }
 
    setCurrentPose('');
    setBoothRunning(false);
    setSessionDone(true);
  };
 
  // ────────────────────────────────────────────────────────
  // WELCOME SCREEN
  // ────────────────────────────────────────────────────────
  if (activeScreen === 'welcome') {
    return (
      <main style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #fff5f8 0%, #ffd6e7 40%, #ffb3cc 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: "'Poppins', system-ui, sans-serif",
        padding: '2rem', position: 'relative', overflow: 'hidden',
      }}>
        {/* Floating sparkles */}
        {['12%','78%','45%','88%','20%'].map((left, i) => (
          <div key={i} style={{
            position: 'absolute', left, top: ['20%','38%','10%','60%','72%'][i],
            fontSize: 12, color: 'rgba(255,100,150,0.5)',
            animation: `floatUp ${3 + i * 0.7}s ease-in-out ${i * 0.4}s infinite`,
            pointerEvents: 'none',
          }}>✦</div>
        ))}
        <div style={{
          fontSize: 88, marginBottom: 4,
          animation: 'camFloat 3s ease-in-out infinite',
        }}>📷</div>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: '#c43d6b', margin: 0, letterSpacing: -0.5 }}>
          Gesture Booth
        </h1>
        <p style={{ color: '#e0829e', marginTop: 6, fontSize: 12, letterSpacing: 2.5 }}>
          ✦ SMART AI PHOTOBOOTH ✦
        </p>
        <p style={{ color: '#c06080', marginTop: 18, textAlign: 'center', maxWidth: 280, lineHeight: 1.7, fontSize: 14 }}>
          Strike a pose, flash a sign — let AI do the magic ✨
        </p>
        <button
          onClick={() => setActiveScreen('camera')}
          style={{
            marginTop: 36, padding: '15px 44px', borderRadius: 30,
            background: 'linear-gradient(135deg, #ff6b9d, #ff4d88)',
            color: '#fff', fontSize: 16, fontWeight: 700, border: 'none',
            cursor: 'pointer', boxShadow: '0 8px 28px rgba(255,100,140,0.45)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          ✦ Start Capturing
        </button>
        <button
          onClick={() => setActiveScreen('booth')}
          style={{
            marginTop: 12, padding: '13px 44px', borderRadius: 30,
            background: 'rgba(255,255,255,0.75)', color: '#c43d6b',
            fontSize: 14, fontWeight: 600,
            border: '1.5px solid rgba(255,120,160,0.4)',
            cursor: 'pointer', backdropFilter: 'blur(8px)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🎞️ Korean Photo Booth
        </button>
        <p style={{ marginTop: 28, fontSize: 11, color: '#d090aa' }}>
          Gesture AI · WebRTC · Multi-Shot · Live Filters
        </p>
 
        <style>{`
          @keyframes camFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          @keyframes floatUp  { 0%{opacity:0;transform:translateY(12px)} 40%{opacity:0.8} 100%{opacity:0;transform:translateY(-50px)} }
        `}</style>
      </main>
    );
  }
 
  // ────────────────────────────────────────────────────────
  // CAMERA SCREEN
  // ────────────────────────────────────────────────────────
  if (activeScreen === 'camera') {
    return (
      <main style={{
        minHeight: '100vh', background: '#0d0d14', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Poppins', system-ui, sans-serif", color: '#fff',
        position: 'relative',
      }}>
 
        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 22px',
        }}>
          <button
            onClick={() => { cancelAnimationFrame(rafRef.current); setActiveScreen('welcome'); }}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,200,210,0.3)',
              color: '#ffb3cc', borderRadius: 20, padding: '7px 16px',
              cursor: 'pointer', fontSize: 13, backdropFilter: 'blur(8px)',
            }}>← Back</button>
 
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              background: 'rgba(255,255,255,0.09)', border: '0.5px solid rgba(255,255,255,0.2)',
              borderRadius: 14, padding: '4px 14px', fontSize: 11,
              color: 'rgba(255,205,215,0.92)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: '#ff4d88',
                animation: 'blink 1.2s ease-in-out infinite',
              }} />
              LIVE
            </div>
            {modelLoaded && (
              <div style={{ fontSize: 9, color: 'rgba(255,133,168,0.7)', letterSpacing: 0.8 }}>
                ✦ Gesture AI Ready
              </div>
            )}
          </div>
 
          <button
            onClick={() => { cancelAnimationFrame(rafRef.current); setActiveScreen('booth'); }}
            style={{
              background: 'rgba(255,80,140,0.2)', border: '0.5px solid rgba(255,133,168,0.45)',
              color: '#ff85a8', borderRadius: 20, padding: '7px 16px',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>🎞️ Booth Mode</button>
        </div>
 
        {/* Camera feed area */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {hasPermission === false && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, color: '#ff85a8',
            }}>
              <div style={{ fontSize: 52 }}>🚫</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Camera permission denied.</p>
              <p style={{ fontSize: 13, color: '#d080a0', textAlign: 'center', maxWidth: 280 }}>
                Click the camera icon in your browser address bar and allow access, then refresh.
              </p>
            </div>
          )}
 
          <video
            ref={webcamRef} autoPlay playsInline muted
            style={{
              width: '100%', height: '100vh', objectFit: 'cover',
              transform: 'scaleX(-1)', filter: FILTERS[activeFilter],
            }}
          />
 
          {/* Flash overlay */}
          <div
            ref={flashRef}
            style={{
              position: 'absolute', inset: 0, background: '#fff',
              opacity: 0, pointerEvents: 'none', zIndex: 40,
            }}
          />
 
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(rgba(255,192,203,0.05) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,192,203,0.05) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }} />
 
          {/* Face tracking oval */}
          <div style={{
            position: 'absolute', top: '16%', left: '50%',
            transform: 'translateX(-50%)',
            width: 190, height: 240,
            border: '1.5px solid rgba(255,150,180,0.55)',
            borderRadius: '50% 50% 46% 46%', pointerEvents: 'none',
            boxShadow: '0 0 20px rgba(255,120,160,0.1)',
            animation: 'trackPulse 2.5s ease-in-out infinite',
          }} />
 
          {/* Countdown overlay (camera mode) */}
          {countdown !== null && countdown > 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 30,
              fontSize: 110, fontWeight: 800,
              color: 'rgba(255,210,225,0.95)',
              textShadow: '0 0 40px rgba(255,100,140,0.6)',
              animation: 'countPop 0.35s cubic-bezier(.175,.885,.32,1.275)',
            }}>{countdown}</div>
          )}
 
          {/* Detected gesture label */}
          {gestureLabel && (
            <div style={{
              position: 'absolute', top: 90, left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255,80,130,0.25)',
              border: '0.5px solid rgba(255,133,168,0.5)',
              borderRadius: 20, padding: '7px 18px',
              fontSize: 13, fontWeight: 600,
              color: 'rgba(255,230,240,0.95)',
              backdropFilter: 'blur(10px)', zIndex: 30,
              animation: 'slideIn 0.25s ease',
              whiteSpace: 'nowrap',
            }}>{gestureLabel}</div>
          )}
 
          {/* Gesture hints */}
          <div style={{
            position: 'absolute', bottom: 130, left: 20, right: 20,
            display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
          }}>
            {[
              ['✌️', 'Peace sign → Capture photo'],
              ['👍', 'Thumbs up → 5s timer'],
              ['✋', 'Open hand → Cycle filter'],
              ['✊', 'Fist → Switch to Booth mode'],
            ].map(([em, label]) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(10px)',
                border: '0.5px solid rgba(255,192,203,0.18)',
                borderRadius: 20, padding: '6px 13px', fontSize: 12,
                color: 'rgba(255,212,222,0.82)',
                display: 'flex', alignItems: 'center', gap: 9,
              }}>
                <span style={{ fontSize: 15 }}>{em}</span>{label}
              </div>
            ))}
          </div>
        </div>
 
        {/* Bottom controls */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15,
          padding: '18px 26px 36px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.82) 0%, transparent 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Filter swatches */}
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,180,200,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Filter
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              {FILTER_KEYS.map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  title={f}
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    border: activeFilter === f
                      ? '2px solid #ff85a8'
                      : '1px solid rgba(255,192,203,0.28)',
                    background:
                      f === 'none'    ? 'rgba(255,255,255,0.12)' :
                      f === 'vintage' ? 'linear-gradient(135deg,#c8a882,#8b5e38)' :
                      f === 'pink'    ? 'linear-gradient(135deg,#ffb3cc,#ff4d88)' :
                      f === 'y2k'     ? 'linear-gradient(135deg,#80d0f0,#4040e0)' :
                                        'linear-gradient(135deg,#aaa,#333)',
                    cursor: 'pointer', color: '#fff',
                    fontSize: f === 'none' ? 13 : 0,
                    boxShadow: activeFilter === f ? '0 0 10px rgba(255,133,168,0.5)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                  {f === 'none' ? '⊘' : ''}
                </button>
              ))}
            </div>
          </div>
 
          {/* Shutter button */}
          <div
            onClick={triggerFlash}
            style={{
              width: 76, height: 76, borderRadius: '50%',
              border: '2.5px solid rgba(255,192,203,0.38)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              animation: 'sRing 2.5s ease-in-out infinite',
            }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fff5f8, #ffb3cc)',
              boxShadow: '0 0 18px rgba(255,150,180,0.45)',
            }} />
          </div>
 
          {/* Timer options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,180,200,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Timer
            </div>
            {[3, 5, 10].map(t => (
              <button
                key={t}
                onClick={() => startTimer(t)}
                disabled={timerActive}
                style={{
                  width: 42, height: 22, borderRadius: 11,
                  background: t === 5 ? 'rgba(255,85,140,0.35)' : 'rgba(255,255,255,0.08)',
                  border: t === 5 ? '0.5px solid #ff85a8' : '0.5px solid rgba(255,192,203,0.25)',
                  color: t === 5 ? '#fff' : 'rgba(255,200,210,0.7)',
                  fontSize: 9, fontWeight: 700, cursor: timerActive ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                {t}s
              </button>
            ))}
          </div>
        </div>
 
        <style>{`
          @keyframes blink      { 0%,100%{opacity:1} 50%{opacity:0.2} }
          @keyframes trackPulse { 0%,100%{border-color:rgba(255,150,180,.35)} 50%{border-color:rgba(255,150,180,.85)} }
          @keyframes sRing      { 0%,100%{border-color:rgba(255,192,203,.28)} 50%{border-color:rgba(255,192,203,.65)} }
          @keyframes countPop   { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
          @keyframes slideIn    { from{opacity:0;transform:translate(-50%,8px)} to{opacity:1;transform:translate(-50%,0)} }
        `}</style>
      </main>
    );
  }
 
  // ────────────────────────────────────────────────────────
  // KOREAN BOOTH SCREEN
  // ────────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #fff5f8 0%, #fce8f0 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Poppins', system-ui, sans-serif",
      padding: '1.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', maxWidth: 560, marginBottom: 22,
      }}>
        <button
          onClick={() => setActiveScreen('welcome')}
          style={{
            background: 'rgba(255,255,255,0.75)', border: '1.5px solid rgba(255,130,160,0.3)',
            color: '#c43d6b', borderRadius: 20, padding: '7px 18px',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}>← Back</button>
        <h2 style={{ color: '#c43d6b', fontWeight: 800, fontSize: 20, margin: 0 }}>
          🎞️ Korean Photo Booth
        </h2>
        <div style={{
          background: 'linear-gradient(135deg,#ff85a8,#ff4d88)',
          color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '5px 12px', borderRadius: 10, letterSpacing: 0.5,
        }}>4-SHOT</div>
      </div>
 
      <div style={{ display: 'flex', gap: 20, width: '100%', maxWidth: 560, alignItems: 'flex-start' }}>
 
        {/* Left: camera + controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Viewfinder */}
          <div style={{
            borderRadius: 18, overflow: 'hidden', position: 'relative',
            height: 300, background: '#1a0f24',
            border: '1px solid rgba(255,150,180,0.18)',
          }}>
            <video
              ref={webcamRef} autoPlay playsInline muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: 'scaleX(-1)', filter: FILTERS['vintage'],
              }}
            />
 
            {/* Flash overlay for booth */}
            <div
              ref={flashRef}
              style={{
                position: 'absolute', inset: 0, background: '#fff',
                opacity: 0, pointerEvents: 'none', zIndex: 40, borderRadius: 17,
              }}
            />
 
            {/* Grid */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage:
                'linear-gradient(rgba(255,192,203,0.04) 1px, transparent 1px),' +
                'linear-gradient(90deg, rgba(255,192,203,0.04) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }} />
 
            {/* Face oval */}
            <div style={{
              position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)',
              width: 118, height: 152,
              border: '1.5px solid rgba(255,150,180,0.55)',
              borderRadius: '50% 50% 46% 46%', pointerEvents: 'none',
              animation: 'trackPulse 2.5s ease-in-out infinite',
            }} />
 
            {/* Big countdown number */}
            {countdown !== null && countdown > 0 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 30,
                fontSize: 100, fontWeight: 800,
                color: 'rgba(255,205,220,0.95)',
                textShadow: '0 0 40px rgba(255,100,140,0.5)',
                animation: 'countPop 0.35s cubic-bezier(.175,.885,.32,1.275)',
              }}>{countdown}</div>
            )}
 
            {/* Pose prompt */}
            {currentPose && countdown === null && (
              <div style={{
                position: 'absolute', bottom: 16, left: 12, right: 12,
                textAlign: 'center',
                background: 'rgba(255,80,130,0.22)',
                border: '0.5px solid rgba(255,133,168,0.42)',
                borderRadius: 12, padding: '8px 14px', fontSize: 12,
                color: 'rgba(255,215,230,0.96)', fontWeight: 600,
                animation: 'slideInUp 0.3s ease',
              }}>{currentPose}</div>
            )}
 
            {/* Shot number badge */}
            {boothRunning && (
              <div style={{
                position: 'absolute', top: 12, right: 14,
                background: 'rgba(255,80,130,0.28)',
                border: '0.5px solid rgba(255,133,168,0.45)',
                borderRadius: 10, padding: '3px 9px',
                fontSize: 9, fontWeight: 700, color: '#ff85a8',
              }}>
                Shot {shotsTaken + 1}/4
              </div>
            )}
          </div>
 
          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 13, height: 13, borderRadius: '50%',
                border: `1.5px solid ${photos[i] ? '#ff85a8' : 'rgba(255,133,168,0.42)'}`,
                background: photos[i] ? '#ff85a8' : 'transparent',
                boxShadow: photos[i] ? '0 0 8px rgba(255,133,168,0.5)' : 'none',
                transition: 'all 0.4s ease',
              }} />
            ))}
          </div>
 
          {/* Start / Restart button */}
          <button
            onClick={sessionDone
              ? () => { setSessionDone(false); setShotsTaken(0); setPhotos([false,false,false,false]); runBooth(); }
              : runBooth}
            disabled={boothRunning}
            style={{
              width: '100%', height: 48, borderRadius: 24,
              background: boothRunning
                ? 'rgba(255,133,168,0.35)'
                : 'linear-gradient(135deg, #ff6b9d, #ff3d80)',
              color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
              cursor: boothRunning ? 'not-allowed' : 'pointer',
              boxShadow: boothRunning ? 'none' : '0 6px 20px rgba(255,80,130,0.38)',
              transition: 'all 0.2s',
            }}>
            {boothRunning
              ? `📸 Capturing shot ${shotsTaken + 1} of 4…`
              : sessionDone
              ? '↺ Take Another Set'
              : '✦ Start Booth Session'}
          </button>
 
          {/* Save / Share (after session) */}
          {sessionDone && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button style={{
                flex: 1, height: 40, borderRadius: 20,
                background: 'rgba(255,245,250,0.85)',
                color: '#c43d6b', border: '1.5px solid rgba(255,130,160,0.35)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>↓ Save Strip</button>
              <button style={{
                flex: 1, height: 40, borderRadius: 20,
                background: 'linear-gradient(135deg, #ff85a8, #ff3d80)',
                color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,80,130,0.35)',
              }}>↗ Share to IG</button>
            </div>
          )}
 
          {/* Film strip when done */}
          {sessionDone && (
            <div style={{
              display: 'flex', gap: 0, marginTop: 14, borderRadius: 8,
              overflow: 'hidden', border: '1px solid rgba(255,150,180,0.25)',
            }}>
              {[
                'linear-gradient(135deg,#ffb3cc,#ff3d7f)',
                'linear-gradient(135deg,#c8a882,#7a5030)',
                'linear-gradient(135deg,#d0b4f0,#7030c0)',
                'linear-gradient(135deg,#9cd8f8,#1870d8)',
              ].map((bg, i) => (
                <div key={i} style={{ flex: 1, height: 32, background: bg }} />
              ))}
            </div>
          )}
        </div>
 
        {/* Right: photo strip */}
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: 1.2,
            textTransform: 'uppercase', color: 'rgba(180,100,130,0.65)',
            marginBottom: 10,
          }}>Photo Strip</div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              height: 62, borderRadius: 11, marginBottom: 8,
              border: `1.5px solid ${photos[i] ? 'rgba(255,133,168,0.7)' : 'rgba(255,150,180,0.2)'}`,
              background: photos[i]
                ? [
                    'linear-gradient(135deg,#ffb3cc,#ff3d7f)',
                    'linear-gradient(135deg,#c8a882,#7a5030)',
                    'linear-gradient(135deg,#d0b4f0,#7030c0)',
                    'linear-gradient(135deg,#9cd8f8,#1870d8)',
                  ][i]
                : 'rgba(18,10,26,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'rgba(255,150,178,0.38)',
              transition: 'all 0.5s ease',
              boxShadow: photos[i] ? '0 0 14px rgba(255,100,140,0.22)' : 'none',
              position: 'relative',
            }}>
              {photos[i] ? (
                <div style={{
                  position: 'absolute', bottom: 5, right: 7,
                  fontSize: 7, fontWeight: 700, color: 'rgba(255,240,250,0.85)',
                }}>Shot {i + 1}</div>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>
 
      <style>{`
        @keyframes trackPulse { 0%,100%{border-color:rgba(255,150,180,.35)} 50%{border-color:rgba(255,150,180,.85)} }
        @keyframes countPop   { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes slideInUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </main>
  );
}
 