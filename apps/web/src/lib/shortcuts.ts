export interface Shortcut {
  chords: string[][];
  action: string;
}

export interface ShortcutGroup {
  title: string;
  scope: string;
  shortcuts: Shortcut[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    scope: 'Anywhere except a text field',
    shortcuts: [
      { chords: [['⌘', 'K']], action: 'Command palette' },
      { chords: [['/']], action: 'Focus search' },
      { chords: [['?']], action: 'This reference' },
      { chords: [['Esc']], action: 'Close overlay, clear focus' },
    ],
  },
  {
    title: 'Issue list',
    scope: 'While a row has focus',
    shortcuts: [
      { chords: [['↓'], ['J']], action: 'Next row' },
      { chords: [['↑'], ['K']], action: 'Previous row' },
      { chords: [['Home'], ['End']], action: 'First / last row' },
      { chords: [['Enter']], action: 'Open focused issue' },
      { chords: [['E']], action: 'Resolve focused issue' },
      { chords: [['I']], action: 'Ignore focused issue' },
    ],
  },
  {
    title: 'Replay player',
    scope: 'While focus is inside the player',
    shortcuts: [
      { chords: [['Space']], action: 'Play / pause' },
      { chords: [['←'], ['→']], action: 'Step one event' },
      {
        chords: [
          ['⇧', '←'],
          ['⇧', '→'],
        ],
        action: 'Skip five events',
      },
      { chords: [['1'], ['2'], ['4']], action: 'Playback speed' },
    ],
  },
];
