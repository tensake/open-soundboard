import {
  setSounds,
  setFinishedPlaylistSound,
  setMicMuted,
  setMuted,
  micMuted,
  muted,
  setMicVolumeSignal,
  micVolumeSignal,
  setSoundVolumeSignal,
  soundVolumeSignal,
  paused,
  setPaused,
} from "./state";
import { ControlAction } from "../types";
import { produce } from "solid-js/store";
import { setGeneralVolume, setMicVolume, stopAllSounds, getActiveSounds, pauseSound, resumeSound } from "./cmd";

export const controlActions: Record<ControlAction, () => void | Promise<void>> =
  {
    Mute: () => {
      if (muted() > 0 && soundVolumeSignal() === 0) {
        setSoundVolumeSignal(muted());
        setGeneralVolume(muted() / 100);
        setMuted(0);
      } else {
        setMuted(soundVolumeSignal());
        setSoundVolumeSignal(0);
        setGeneralVolume(0);
      }
    },
    MicMute: () => {
      if (micMuted() > 0 && micVolumeSignal() === 0) {
        setMicVolumeSignal(micMuted());
        setMicVolume(micMuted() / 100);
        setMicMuted(0);
      } else {
        setMicMuted(micVolumeSignal());
        setMicVolumeSignal(0);
        setMicVolume(0);
      }
    },
    StopAll: () => {
      stopAllSounds();
      setFinishedPlaylistSound(null);
      setSounds([]);
    },
    PauseResumeAll: async () => {
      const ids = await getActiveSounds();
      const newPaused = !paused();

      if (newPaused) {
        ids.forEach(pauseSound);
      } else {
        ids.forEach(resumeSound);
      }

      setPaused(newPaused);
      setSounds(
        produce((s) => {
          s.forEach((entry) => {
            entry.paused = newPaused;
          });
        }),
      );
    },
  };
