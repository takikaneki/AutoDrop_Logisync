import { getPrefs } from "../store/prefs.js";

const TONE_MAP = {
  parcel: { freq: 880, endFreq: 1174.66, dur: 0.24 },
  messages: { freq: 740, endFreq: 987.77, dur: 0.22 },
  announcements: { freq: 880, endFreq: 880, dur: 0.35 },
  scan: { freq: 1046.5, endFreq: 1318.5, dur: 0.16 },
};

export function previewTone(kind = "announcements", volumeOverride) {
  try {
    const prefs = getPrefs();
    const vol = Math.max(0, Math.min(100, volumeOverride ?? prefs.soundVolume ?? 80)) / 100;
    if (vol <= 0) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const { freq, endFreq, dur } = TONE_MAP[kind] || TONE_MAP.announcements;
    const audio = new Ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, audio.currentTime + Math.min(0.1, dur));
    }
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18 * vol, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  } catch {
    console.log("Notification sound unavailable.");
  }
}

// Maikling alert tone para sa announcement (galing sa dating Messages.jsx)
export function playAlertSound() {
  const prefs = getPrefs();
  if (prefs.sound === false || prefs.soundAnnouncements === false) return;
  previewTone("announcements");
}
