export const internalChromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const enharmonicMap = {
            'C':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'C#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'Db':  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
            'D':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'D#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'Eb':  ['C', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
            'E':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'F':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'F#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'Gb':  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
            'G':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'G#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'Ab':  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
            'A':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'A#':  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'Bb':  ['C', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
            'B':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        };

export const modeIntervals = {
            major:           [0,2,4,5,7,9,11],
            natural_minor:   [0,2,3,5,7,8,10],
            harmonic_minor:  [0,2,3,5,7,8,11],
            melodic_minor:   [0,2,3,5,7,9,11],
            dorian:          [0,2,3,5,7,9,10],
            mixolydian:      [0,2,4,5,7,9,10],
            phrygian:        [0,1,3,5,7,8,10],
            lydian:          [0,2,4,6,7,9,11]
        };

export function buildScale(root, mode) {
            const rootLookup = root.replace('b', '#').replace('Db','C#').replace('Eb','D#').replace('Gb','F#').replace('Ab','G#').replace('Bb','A#');
            const rootIdx = internalChromatic.indexOf(rootLookup);
            if (rootIdx === -1) return [];
            const intervals = modeIntervals[mode] || modeIntervals.major;
            const scale = [];
            const displayNames = enharmonicMap[root] || internalChromatic;
            for (let i = 0; i < intervals.length; i++) {
                const semitones = intervals[i];
                const noteIdx = (rootIdx + semitones) % 12;
                const octaveOffset = Math.floor((rootIdx + semitones) / 12);
                scale.push({note: displayNames[noteIdx], internalNote: internalChromatic[noteIdx], octaveOffset});
            }

export function generateScaleDegrees(root, mode, lowOct = 1, highOct = 6) {
  const baseScale = buildScale(root, mode);
  const notes = [];
  for (let o = lowOct; o <= highOct; o++) {
    baseScale.forEach((step, i) => {
      const octave = o + step.octaveOffset;
      if (octave >= 1 && octave <= 6) {
        notes.push({ note: step.note, internalNote: step.internalNote, octave, scaleDegree: i });
      }
    });
  }
  return notes;
}
