"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

interface AudioPlayerProps {
  text: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [utteranceRef, setUtteranceRef] = useState<SpeechSynthesisUtterance | null>(null);
  const [audioChunks, setAudioChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  // Split text into smaller chunks
  const splitText = (input: string, chunkSize = 180): string[] => {
    const regex = new RegExp(`(.{1,${chunkSize}})(?:\\s|$)`, "g");
    return input.match(regex) || [];
  };

  // Play button
  const playAudio = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel(); // reset
      const chunks = splitText(text);
      setAudioChunks(chunks);
      setIsPlaying(true);
      setCurrentChunkIndex(0);
      playChunk(0, chunks);
    }
  };

  // Play one chunk, then go to next
  const playChunk = (chunkIndex: number, chunks: string[]) => {
    if (chunkIndex >= chunks.length) {
      setIsPlaying(false);
      setUtteranceRef(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    setUtteranceRef(utterance);

    utterance.onend = () => {
      const nextIndex = chunkIndex + 1;
      setCurrentChunkIndex(nextIndex);

      if (nextIndex < chunks.length) {
        setTimeout(() => playChunk(nextIndex, chunks), 300); // small delay for natural flow
      } else {
        setIsPlaying(false);
        setUtteranceRef(null);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setUtteranceRef(null);
    };

    speechSynthesis.speak(utterance);
  };

  // Pause button
  const pauseAudio = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.pause();
      setIsPlaying(false);
    }
  };

  // Resume button
  const resumeAudio = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.resume();
      setIsPlaying(true);
    }
  };

  // Stop button
  const stopAudio = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setUtteranceRef(null);
      setCurrentChunkIndex(0);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      {!isPlaying ? (
        <Button onClick={playAudio} size="icon">
          <Play className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={pauseAudio} size="icon">
          <Pause className="h-4 w-4" />
        </Button>
      )}
      <Button onClick={resumeAudio} size="icon">
        ▶️
      </Button>
      <Button onClick={stopAudio} size="icon">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default AudioPlayer;
