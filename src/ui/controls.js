import { generateScaleDegrees } from '../music/theory.js';
import { getFrequency } from '../audio/audio.js';

function generateScaleNotes(root, mode, lowOct = 1, highOct = 6) {
  const degrees = generateScaleDegrees(root, mode, lowOct, highOct);
  return degrees.map(d => ({
    note: d.note,
    octave: d.octave,
    freq: getFrequency(d.internalNote, d.octave),
    scaleDegree: d.scaleDegree
  }));
}

export function initControls() {
  const lowSelect = document.getElementById('lowNote');
  const highSelect = document.getElementById('highNote');

  function updateRangeDropdowns() {
    const scaleNotes = generateScaleNotes(
      document.getElementById('rootNote').value,
      document.getElementById('mode').value,
      1, 6
    );

    lowSelect.innerHTML = '';
    highSelect.innerHTML = '';

    scaleNotes.forEach((n, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.text = n.note + n.octave;
      lowSelect.appendChild(opt.cloneNode(true));
      highSelect.appendChild(opt);
    });

    const tonicIdx = scaleNotes.findIndex(n => n.scaleDegree === 0 && n.octave === 3);
    lowSelect.value = tonicIdx >= 0 ? tonicIdx : 0;
    highSelect.value = scaleNotes.length - 1;
  }

  document.getElementById('rootNote').addEventListener('change', updateRangeDropdowns);
  document.getElementById('mode').addEventListener('change', updateRangeDropdowns);
  updateRangeDropdowns();

  const bpmSlider = document.getElementById('bpm');
  const bpmValue = document.getElementById('bpmValue');
  bpmSlider.addEventListener('input', () => bpmValue.textContent = `${bpmSlider.value} BPM`);

  const chordVolumeSlider = document.getElementById('chordVolume');
  const chordVolumeValue = document.getElementById('chordVolumeValue');
  chordVolumeSlider.addEventListener('input', () => chordVolumeValue.textContent = chordVolumeSlider.value);

  document.querySelectorAll('input[type="range"][id^="weight-"]').forEach(slider => {
    const valSpan = slider.nextElementSibling;
    if (valSpan && valSpan.classList.contains('weight-val')) {
      slider.addEventListener('input', () => valSpan.textContent = slider.value);
    }
  });
}
