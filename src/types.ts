export enum Tab {
  Dashboard = "dashboard",
  Settings = "settings",
}

export interface Progress {
  current: number;
  total: number;
}

export type SoundTab = {
  id: string;
  name: string;
  path: string;
}

export const SOUNDS = [
  {
    label: "Sound 1",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound1.mp3",
  },
  {
    label: "Sound 2",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound2.mp3",
  },
  {
    label: "Sound 3",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound3.wav",
  },
  {
    label: "Sound 4",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound4.flac",
  },
];
