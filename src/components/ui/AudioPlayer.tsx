import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  duration?: number; // Total durasi rekaman dalam detik (opsional)
  className?: string;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  duration = 0,
  className = '',
  autoPlay = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration);

  // Perbarui total durasi jika props berubah
  useEffect(() => {
    if (duration > 0) {
      setTotalDuration(duration);
    }
  }, [duration]);

  // Reset player saat sumber audio (src) berganti
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Gagal memutar audio:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
      setTotalDuration(Math.round(audio.duration));
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveTotal = Math.max(totalDuration, 1);
  const progressPercent = Math.min(100, Math.max(0, (currentTime / effectiveTotal) * 100));

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 shadow-2xs text-gray-800 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />

      {/* Tombol Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Jeda Audio' : 'Putar Audio'}
        className="w-7 h-7 rounded-lg bg-[#244BFF] hover:bg-[#183CD8] text-white flex items-center justify-center shrink-0 transition shadow-2xs cursor-pointer"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {/* Progress Track / Slider */}
      <div className="flex flex-col gap-0.5 min-w-[100px] sm:min-w-[130px]">
        <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden flex items-center">
          <div
            className="absolute top-0 bottom-0 left-0 bg-[#244BFF] transition-[width] duration-75"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={effectiveTotal}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Seek bar"
          />
        </div>

        {/* Waktu Putar / Total Durasi */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono leading-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Restart Tombol */}
      <button
        type="button"
        onClick={handleRestart}
        title="Putar dari awal"
        className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  );
};
