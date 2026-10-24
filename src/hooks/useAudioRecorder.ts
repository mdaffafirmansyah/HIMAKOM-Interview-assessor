import { useState, useRef, useEffect, useCallback } from 'react';
import fixWebmDuration from 'fix-webm-duration';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // Dalam detik
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioLevel: number; // 0 - 100 untuk visualisasi meter volume
  frequencyBars: number[]; // Array 8 band frekuensi untuk visualisasi gelombang naik-turun
  error: string | null;
  hasPermission: boolean | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [frequencyBars, setFrequencyBars] = useState<number[]>([10, 10, 10, 10, 10, 10, 10, 10]);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const selectedMimeTypeRef = useRef<string>('audio/webm');

  // Tracking waktu untuk kalkulasi durasi riil & injeksi metadata WebM
  const startTimeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Gunakan ref untuk state recording agar loop visualizer tidak terkena stale closure
  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Pilih MIME type terbaik yang didukung browser
  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];

    if (typeof MediaRecorder === 'undefined') return 'audio/webm';

    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  // Bersihkan audio stream & visualizer
  const cleanupStream = useCallback(() => {
    isRecordingRef.current = false;
    isPausedRef.current = false;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setAudioLevel(0);
    setFrequencyBars([10, 10, 10, 10, 10, 10, 10, 10]);
  }, []);

  // Loop visualizer audio real-time
  const startVisualizerLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const tick = () => {
      if (!isRecordingRef.current || isPausedRef.current || !analyserRef.current) {
        setAudioLevel(0);
        setFrequencyBars([10, 10, 10, 10, 10, 10, 10, 10]);
        return;
      }

      const analyser = analyserRef.current;
      const fftSize = analyser.fftSize;

      // 1. Ambil time-domain data untuk kalkulasi RMS volume instan
      const timeData = new Uint8Array(fftSize);
      analyser.getByteTimeDomainData(timeData);

      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        const norm = (timeData[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      // Sensitivitas diperkuat: suara bicara normal (RMS 0.04 - 0.25) terpetakan ke rentang 25 - 85%
      const calculatedLevel = Math.min(100, Math.round(Math.pow(rms, 0.5) * 140));
      setAudioLevel(calculatedLevel);

      // 2. Ambil frequency data untuk 8 bar visualizer equalizer
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      // Ambil 8 sample frekuensi di rentang vokal manusia (300Hz - 3500Hz)
      const sampleIndices = [1, 2, 3, 5, 7, 9, 12, 16];
      const bars = sampleIndices.map((idx) => {
        const raw = freqData[idx] || 0;
        // Jika ada input suara, hitung ketinggian bar (12% - 100%)
        if (calculatedLevel > 5) {
          const rawPercent = Math.round((raw / 255) * 100);
          return Math.min(100, Math.max(12, Math.round(rawPercent * 0.8 + calculatedLevel * 0.3)));
        }
        return 10;
      });
      setFrequencyBars(bars);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // Memulai rekaman
  const startRecording = async () => {
    setError(null);
    cleanupStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Konfigurasi Web Audio API untuk visualisasi
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        // Pastikan AudioContext di-resume jika dalam keadaan suspended
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128; // 64 bin frekuensi
        analyser.smoothingTimeConstant = 0.5; // Responsif terhadap perubahan suara
        source.connect(analyser);
        analyserRef.current = analyser;
      }

      // Konfigurasi MediaRecorder
      const mimeType = getSupportedMimeType();
      selectedMimeTypeRef.current = mimeType || 'audio/webm';
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mime = selectedMimeTypeRef.current || 'audio/webm';
        let blob = new Blob(chunksRef.current, { type: mime });
        
        // Hitung durasi tepat dalam milidetik
        const totalDurationMs = Math.max(
          1000,
          Date.now() - startTimeRef.current - pausedDurationRef.current
        );

        // Perbaiki header metadata container WebM agar audio player browser membaca durasi secara instan & dapat di-seek
        if (mime.includes('webm')) {
          try {
            blob = await fixWebmDuration(blob, totalDurationMs, { logger: false });
          } catch (e) {
            console.warn('fixWebmDuration fallback ke blob asli:', e);
          }
        }

        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        cleanupStream();
      };

      mediaRecorder.start(1000); // Kumpulkan data tiap 1 detik

      startTimeRef.current = Date.now();
      pauseStartTimeRef.current = 0;
      pausedDurationRef.current = 0;

      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Mulai timer durasi rekaman
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Mulai visualizer loop real-time
      startVisualizerLoop();
    } catch (err: unknown) {
      setHasPermission(false);
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mengakses mikrofon. Pastikan Anda telah memberikan izin akses mikrofon di browser.';
      setError(msg);
      cleanupStream();
    }
  };

  // Menjeda rekaman
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      isPausedRef.current = true;
      pauseStartTimeRef.current = Date.now();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setAudioLevel(0);
      setFrequencyBars([10, 10, 10, 10, 10, 10, 10, 10]);
    }
  };

  // Melanjutkan rekaman
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      isPausedRef.current = false;
      if (pauseStartTimeRef.current > 0) {
        pausedDurationRef.current += Date.now() - pauseStartTimeRef.current;
        pauseStartTimeRef.current = 0;
      }
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      startVisualizerLoop();
    }
  };

  // Menghentikan rekaman
  const stopRecording = () => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Mereset rekaman hook tanpa merusak referensi URL audio yang sudah disimpan ke luar
  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    cleanupStream();
  };

  useEffect(() => {
    return () => {
      cleanupStream();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [cleanupStream, audioUrl]);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    audioLevel,
    frequencyBars,
    error,
    hasPermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}
