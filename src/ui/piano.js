import { internalChromatic } from '../music/theory.js';
import { getFrequency, playNote } from '../audio/audio.js';

let initialized = false;

export function initPiano(pianoElement) {
  if (!pianoElement || initialized) return;
  initialized = true;

  // Clear any existing keys (safety if called twice with a fresh element)
  pianoElement.innerHTML = '';

  // Build piano (Preserved)
  let keyIndex = 0;
  for (let octave = 1; octave <= 6; octave++) {
    const octaveDiv = document.createElement('div');
    octaveDiv.className = 'octave';

    internalChromatic.forEach(note => {
      if (keyIndex >= 61) return;

      const isBlack = note.includes('#');
      const key = document.createElement('div');
      key.className = `key ${isBlack ? 'black' : ''}`;
      key.dataset.note = note;
      key.dataset.octave = octave;

      key.addEventListener('mousedown', () => {
        playNote(getFrequency(note, octave), 90, 1.2);
        key.classList.add('active');
      });
      key.addEventListener('mouseup', () => key.classList.remove('active'));
      key.addEventListener('mouseleave', () => key.classList.remove('active'));

      if (isBlack && octaveDiv.lastChild) octaveDiv.lastChild.appendChild(key);
      else octaveDiv.appendChild(key);

      keyIndex++;
    });

    pianoElement.appendChild(octaveDiv);
  }

  const keyboardLayout = ['Z','S','X','D','C','V','G','B','H','N','J','M','Q','2','W','3','E','R','5','T','6','Y','7','U','I','9','O','0','P'];
  const pianoKeys = Array.from(pianoElement.querySelectorAll('.key'));
  const keyMap = {};
  keyboardLayout.forEach((char, i) => { if (i < pianoKeys.length) keyMap[char.toLowerCase()] = pianoKeys[i]; });

  document.addEventListener('keydown', e => {
    const key = keyMap[e.key.toLowerCase()];
    if (key && !key.classList.contains('active')) key.dispatchEvent(new MouseEvent('mousedown'));
  });

  document.addEventListener('keyup', e => {
    const key = keyMap[e.key.toLowerCase()];
    if (key) key.classList.remove('active');
  });
}
