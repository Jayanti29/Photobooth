# Photobooth
Gesture-controlled AI Photo Booth built with React, MediaPipe &amp; Web APIs  capture photos using hand gestures, apply filters, and generate aesthetic booth strips in real-time.
# 🎥 Gesture Booth

An interactive **gesture-controlled photo booth web app** that lets users capture photos using **hand gestures** — no clicks, no buttons, just vibes ✋✨

Built with **React, MediaPipe Hands, and modern web APIs**, this project creates a fun, touchless, and aesthetic photo booth experience.

---

## 🚀 Features

* 🤚 **Gesture Detection**

  * Capture photos using hand gestures
  * Real-time hand tracking with MediaPipe

* 📸 **Photo Capture System**

  * Auto countdown before capture
  * Multiple shots per session
  * Smooth camera integration

* 🎨 **Aesthetic Filters**

  * Vintage, Pink, B/W, Y2K styles
  * Real-time filter preview

* 🧵 **Photo Booth Strip Generator**

  * Combines captured images into a strip
  * Download-ready format

* 💾 **Local Storage Support**

  * Saves session data
  * Reload and continue seamlessly

* ⚡ **Modern UI/UX**

  * Clean, Gen-Z inspired interface
  * Smooth transitions and animations

---

## 🛠️ Tech Stack

* **Frontend:** React (Next.js)
* **Gesture Detection:** MediaPipe Hands
* **Camera Handling:** WebRTC
* **State Management:** React Hooks
* **Styling:** CSS / Tailwind (if used)

---

## 📂 Project Structure

```
gesture-booth/
│── app/
│   ├── page.tsx
│   ├── layout.tsx
│
│── components/
│
│── lib/
│   ├── CapturePhoto.ts
│   ├── gestureDetector.ts
│   ├── useGestureDetection.ts
│   ├── filters.ts
│   ├── koreanBooth.ts
│
│── public/
│── package.json
```

---

## ⚙️ Installation

```bash
git clone https://github.com/your-username/gesture-booth.git
cd gesture-booth
npm install
npm run dev
```

---

## 🧠 How It Works

1. Webcam initializes using browser APIs
2. MediaPipe detects hand landmarks in real-time
3. Gestures are interpreted into actions (capture trigger)
4. Images are processed with filters
5. Final photo strip is generated and downloadable

---

## 🎯 Use Cases

* 📸 Virtual photo booths
* 🎉 Event activations
* 🧪 Gesture-based UI experiments
* 🎨 Creative web projects

---

## 🔮 Future Improvements

* Face filters & AR effects
* Gesture customization
* Cloud storage support
* Social media sharing integration

---

## 🤝 Contributing

Pull requests are welcome! Feel free to fork and improve.

---

## ⭐ Show Your Support

If you like this project, drop a ⭐ on the repo — it helps a lot!

---

## 👤 Author

Built with 💻 + ☕ + creativity
