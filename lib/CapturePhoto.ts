export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  filter: string;
  timestamp: number;
  mode: 'single' | 'booth';
}

export function captureFrame(
  video: HTMLVideoElement,
  filterCss: string,
  mode: 'single' | 'booth' = 'single'
): CapturedPhoto {
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.filter = filterCss === 'none' ? 'none' : filterCss;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return {
    id: Date.now().toString(),
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    filter: filterCss,
    timestamp: Date.now(),
    mode,
  };
}

export function buildBoothStrip(photos: CapturedPhoto[]): string {
  const W = 600, PAD = 16, GAP = 8;
  const frameH = 160;
  const H = PAD * 2 + frameH * photos.length + GAP * (photos.length - 1) + 30;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff8f9';
  ctx.fillRect(0, 0, W, H);
  photos.forEach((photo, i) => {
    const img = new Image();
    img.src = photo.dataUrl;
    const y = PAD + i * (frameH + GAP);
    ctx.drawImage(img, PAD, y, W - PAD * 2, frameH);
  });
  ctx.fillStyle = 'rgba(180,80,120,0.5)';
  ctx.font = '500 13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('✦ Gesture Booth', W / 2, H - 10);
  return canvas.toDataURL('image/jpeg', 0.95);
}

export function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = filename;
  a.click();
}

export function saveToLocalStorage(photos: CapturedPhoto[]) {
  try {
    // Keep only last 20 photos to avoid storage overflow
    const trimmed = photos.slice(0, 20);
    localStorage.setItem('gestureBooth_photos', JSON.stringify(trimmed));
  } catch {
    console.warn('Storage full, clearing old photos');
    localStorage.removeItem('gestureBooth_photos');
  }
}

export function loadFromLocalStorage(): CapturedPhoto[] {
  try {
    const raw = localStorage.getItem('gestureBooth_photos');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}