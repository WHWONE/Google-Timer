import { state } from './state.js';

import { harmonicRhythmPresets } from './harmony/rhythmPresets.js';
import { getHarmonicTriggers } from './harmony/triggers.js';
import { generateProgression } from './harmony/progression.js';
import { internalChromatic, generateScaleDegrees } from './music/theory.js';
import { getRandomRhythm } from './music/rhythm.js';
import { getWeightedInterval } from './music/intervals.js';
import { loadPiano, getAudioCtx, getFrequency, playNote } from './audio/audio.js';
import { initPiano } from './ui/piano.js';
import { initControls } from './ui/controls.js';
import { getPianoEl } from './ui/dom.js';
const audioCtx = getAudioCtx();

window.addEventListener('load', () => {
  loadPiano();
  initControls();
  initPiano(getPianoEl());
});


        // ────────────────────────────────────────────────
        //  HARMONIC RHYTHM PRESET REGISTRY (Phase 1)
        // ────────────────────────────────────────────────
        

        // ────────────────────────────────────────────────
        //  PHASE 2: BEAT-MATCHING HELPER FUNCTIONS
        // ────────────────────────────────────────────────
        
                            });
                }
            } else if (preset.type === 'bar_spanning') {
                // Bar-spanning patterns
                if (preset.pattern === 'slow_cycle') {
                    // 4-bar cycle: Bar1:0, Bar2:3, Bar3:2, Bar4:1
                    for (let bar = 0; bar < totalBars; bar++) {
                        const barInCycle = bar % 4;
                        const offsets = preset.barOffsets[barInCycle] || [0];
                        offsets.forEach(offset => {
                            const triggerBeat = bar * beatsPerBar + offset;
                            if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                        });
                    }
                } else if (preset.pattern === 'bossa_nova') {
                    // 2-bar pattern: [0, 1.5, 3, 4.5]
                    const spanBars = preset.spanBars || 2;
                    const cycleBeats = spanBars * beatsPerBar;
                    for (let bar = 0; bar < totalBars; bar += spanBars) {
                        preset.offsets.forEach(offset => {
                            const triggerBeat = bar * beatsPerBar + offset;
                            if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                        });
                    }
                } else if (preset.pattern === 'pyramid') {
                    // 4-bar pattern: Bar1 [0], Bar2 [0,2], Bar3 [0,1,2,3], Bar4 = 16ths
                    for (let bar = 0; bar < totalBars; bar++) {
                        const barInCycle = bar % 4;
                        const offsets = preset.barOffsets[barInCycle] || [0];
                        offsets.forEach(offset => {
                            const triggerBeat = bar * beatsPerBar + offset;
                            if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                        });
                    }
                }
            } else if (preset.type === 'algorithmic') {
                // Algorithmic patterns
                if (preset.pattern === 'random_walk') {
                    // Random check every quarter-beat (gridSize: 0.25)
                    const gridSize = preset.gridSize || 0.25;
                    for (let beat = 0; beat < totalBeats; beat += gridSize) {
                        if (Math.random() < 0.3) { // 30% chance per grid point
                            triggers.push(beat);
                        }
                    }
                    // Ensure at least one trigger per bar
                    for (let bar = 0; bar < totalBars; bar++) {
                        const barStart = bar * beatsPerBar;
                        const barEnd = barStart + beatsPerBar;
                        const hasBarTrigger = triggers.some(t => t >= barStart && t < barEnd);
                        if (!hasBarTrigger) {
                            triggers.push(barStart);
                        }
                    }
                } else if (preset.pattern === 'five_over_four') {
                    // Trigger every 0.8 beats
                    const interval = preset.interval || 0.8;
                    for (let beat = 0; beat < totalBeats; beat += interval) {
                        triggers.push(beat);
                    }
                } else if (preset.pattern === 'pedal') {
                    // Only trigger at phrase start (beat 0)
                    triggers.push(0);
                } else if (preset.pattern === 'decrescendo') {
                    // Dense early, sparse later
                    const density = [1, 0.75, 0.5, 0.25, 0.1]; // Decreasing density per section
                    const section = totalBeats / 5;
                    for (let i = 0; i < 5; i++) {
                        const sectionStart = i * section;
                        const sectionEnd = Math.min((i + 1) * section, totalBeats);
                        const triggers_in_section = Math.max(1, Math.floor((sectionEnd - sectionStart) * density[i]));
                        for (let j = 0; j < triggers_in_section; j++) {
                            const triggerBeat = sectionStart + (j * (sectionEnd - sectionStart) / triggers_in_section);
                            if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                        }
                    }
                } else if (preset.pattern === 'accelerando') {
                    // Sparse early, dense later
                    const density = [0.1, 0.25, 0.5, 0.75, 1]; // Increasing density per section
                    const section = totalBeats / 5;
                    for (let i = 0; i < 5; i++) {
                        const sectionStart = i * section;
                        const sectionEnd = Math.min((i + 1) * section, totalBeats);
                        const triggers_in_section = Math.max(1, Math.floor((sectionEnd - sectionStart) * density[i]));
                        for (let j = 0; j < triggers_in_section; j++) {
                            const triggerBeat = sectionStart + (j * (sectionEnd - sectionStart) / triggers_in_section);
                            if (triggerBeat < totalBeats) triggers.push(triggerBeat);
                        }
                    }
                }
            }
            
            // Sort and deduplicate triggers
            const uniqueTriggers = [...new Set(triggers.map(t => Math.round(t * 1000) / 1000))].sort((a, b) => a - b);
            return uniqueTriggers;
        }

        // ────────────────────────────────────────────────
        //  PHASE 3: MELODY GRAVITY HELPER FUNCTIONS
        // ────────────────────────────────────────────────
        
        function getCurrentChord(beatPosition, chords) {
            // Find which chord is active at the given beat position
            for (let i = 0; i < chords.length; i++) {
                const chord = chords[i];
                const nextChord = chords[i + 1];
                const chordEnd = nextChord ? nextChord.triggerBeat : Infinity;
                if (beatPosition >= chord.triggerBeat && beatPosition < chordEnd) {
                    return chord;
                }
            }
            return chords[chords.length - 1]; // Return last chord if past all triggers
        }
        
        function getNextHarmonicBoundary(beatPosition, chords) {
            // Find the next chord change beat
            for (let i = 0; i < chords.length; i++) {
                if (chords[i].triggerBeat > beatPosition) {
                    return chords[i].triggerBeat;
                }
            }
            return Infinity; // No more boundaries
        }
        
        function getChordTones(chord, availableNotes) {
            // Extract chord tones (scale degrees 1-3-5) from available notes
            if (!chord || !chord.notes) return [];
            const chordDegrees = chord.notes.map(n => n.scaleDegree);
            return availableNotes.filter(n => chordDegrees.includes(n.scaleDegree));
        }
        }

function generateScaleNotes(root, mode, lowOct = 1, highOct = 6) {
  const degrees = generateScaleDegrees(root, mode, lowOct, highOct);
  return degrees.map(d => ({ note: d.note, octave: d.octave, freq: getFrequency(d.internalNote, d.octave), scaleDegree: d.scaleDegree }));
}
        }

                });

        

                    return scale;
        }

                        });
            }
            return notes;
        }
            }
        });

        // ────────────────────────────────────────────────
        //  UPGRADE: HARMONIC SYSTEM DATA (NEW)
        // ────────────────────────────────────────────────
                    }
            return progression;
        }

        // ────────────────────────────────────────────────
        //  ORIGINAL GENERATOR ENGINE (Preserved)
        // ────────────────────────────────────────────────

                    let rand = Math.random() * totalWeight;
            let cum = 0;
            for (const opt of candidates) {
            cum += getRhythmWeight(opt);
            if (rand <= cum) return opt;
        }
            return candidates[0];
        }

        
                document.getElementById('generateBtn').addEventListener('click', generateComposition);

function generateComposition() {
            loadPiano();
            
            // Phase 1: Store selected harmonic rhythm preset (behavior unchanged)
            const selectedHarmonicRhythmKey = document.getElementById('harmonicRhythm').value;
            const selectedHarmonicRhythmPreset = harmonicRhythmPresets[selectedHarmonicRhythmKey];
            
            const root = document.getElementById('rootNote').value, mode = document.getElementById('mode').value;
            const contour = document.getElementById('contour').value, numBars = parseInt(document.getElementById('numBars').value);
            const timeSig = document.getElementById('timeSig').value, beatsPerBar = parseInt(timeSig.split('/')[0]);
            const totalBeats = numBars * beatsPerBar;
            const lowIdx = parseInt(document.getElementById('lowNote').value), highIdx = parseInt(document.getElementById('highNote').value);
            const motifStartProb = parseFloat(document.getElementById('motifStartProb').value), motifRepeatChance = parseFloat(document.getElementById('motifRepeatChance').value);
            const motifLen = parseInt(document.getElementById('motifLength').value), intervalStyle = document.getElementById('intervalStyle').value;
            const bpm = parseInt(document.getElementById('bpm').value), phraseLenBars = parseInt(document.getElementById('phraseLen').value);
            const phraseLenBeats = phraseLenBars * beatsPerBar;

            if (lowIdx > highIdx || highIdx - lowIdx < 4) { alert("Select a wider range for better musical results."); return; }
            const fullScale = generateScaleNotes(root, mode, 1, 6), available = fullScale.slice(lowIdx, highIdx + 1);
            if (available.length < 5) { alert("Scale range too small."); return; }

            // ────────────────────────────────────────────────
            //  PHASE 2: GENERATE CHORDS (HARMONIC RHYTHM DRIVEN)
            // ────────────────────────────────────────────────
            
            // Get harmonic rhythm triggers based on selected preset
            const harmonicTriggers = getHarmonicTriggers(selectedHarmonicRhythmPreset, totalBeats, beatsPerBar);
            
            // Generate chord progression for the number of triggers
            const chordStrategy = document.getElementById('chordStrategy').value;
            const numChords = harmonicTriggers.length;
            const prog = generateProgression(chordStrategy, Math.ceil(numChords / 4), Math.max(1, Math.ceil(numChords / numBars)));
            const scaleForChords = generateScaleNotes(root, mode, 3, 4);
            
            // Map each trigger to a chord
            state.composition.currentChords = harmonicTriggers.map((triggerBeat, index) => {
                const degree = prog[index % prog.length]; // Cycle through progression if needed
                const triad = [degree, (degree + 2) % 7, (degree + 4) % 7].map(d => {
                    const match = scaleForChords.find(n => n.scaleDegree === d);
                    return match || scaleForChords[0];
                });
                
                // Calculate duration until next trigger (or end of composition)
                const nextTrigger = harmonicTriggers[index + 1] || totalBeats;
                const durationBeats = nextTrigger - triggerBeat;
                const durationSec = durationBeats * (60 / bpm);
                
                const chordName = triad[0].note + (mode.includes('minor') && [0,3,4].includes(degree) ? 'm' : '');
                return { 
                    notes: triad, 
                    durationSec: durationSec, 
                    beats: durationBeats, 
                    name: chordName,
                    triggerBeat: triggerBeat  // Store trigger beat for reference
                };
            });

            // ────────────────────────────────────────────────
            //  PHASE 2: GENERATE MELODY (PRESERVED)
            // ────────────────────────────────────────────────
            state.composition.melody = [];
            let startNote = available.find(n => n.scaleDegree === 0 && n.octave === 4) || available.find(n => n.scaleDegree === 0) || available[Math.floor(available.length * 0.35)];
            let current = startNote, currentIdx = available.indexOf(current);
            let currentTotalBeats = 0, currentBeatInBar = 0, barContents = [[]];

            let rhythm = getRandomRhythm(beatsPerBar);
            let sec = rhythm.baseSec * (120 / bpm), vel = 78 + Math.floor(Math.random() * 22);
            
            // PHASE 3: Apply duration safety to first note
            const firstBoundary = getNextHarmonicBoundary(0, state.composition.currentChords);
            let firstBeats = rhythm.beats;
            let firstSec = sec;
            if (rhythm.beats > firstBoundary && firstBoundary > 0.1) {
                firstBeats = firstBoundary;
                firstSec = firstBeats * (60 / bpm);
            }
            
            let item = {isRest:false, freq:current.freq, durationSec:firstSec, velocity:vel, display:`${current.note}${current.octave} ${rhythm.name}`, beats: firstBeats};
            state.composition.melody.push(item); barContents[0].push(item);
            currentTotalBeats += firstBeats; currentBeatInBar += firstBeats;

            let motifStartIdx = -1, motifLengthInNotes = 0, motifBuffer = [], noteCount = 1;
            const approxPhrase1Len = Math.floor(totalBeats / 2), peakPos = Math.floor(approxPhrase1Len * (0.4 + Math.random() * 0.3));
            let currentPhraseBeats = rhythm.beats;

            while (currentTotalBeats < totalBeats - 2) {
                const remainingInBar = beatsPerBar - currentBeatInBar;
                rhythm = getRandomRhythm(remainingInBar);
                sec = rhythm.baseSec * (120 / bpm);

                if (rhythm.type === 'rest') {
                    item = {isRest:true, durationSec:sec, display:rhythm.name, beats: rhythm.beats};
                    state.composition.melody.push(item); barContents[barContents.length - 1].push(item);
                    currentTotalBeats += rhythm.beats; currentBeatInBar += rhythm.beats; currentPhraseBeats += rhythm.beats;
                    if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }
                    continue;
                }

                let direction = 0;
                if (contour === 'rising') direction = 1;
                else if (contour === 'falling') direction = -1;
                else if (contour === 'arch') direction = (noteCount <= peakPos) ? 1 : -1;
                else if (contour === 'wavy') direction = (Math.random() < 0.5) ? 1 : -1;
                else if (contour === 'descending_arch') direction = (noteCount < approxPhrase1Len * 0.6) ? -1 : (Math.random() < 0.4 ? 1 : -1);
                else if (contour === 'stepwise_with_leaps') direction = (Math.random() < 0.7) ? (Math.random() < 0.5 ? 1 : -1) : (Math.random() < 0.5 ? 3 : -3);
                else if (contour === 'circular') direction = (Math.random() < 0.6) ? (Math.random() < 0.5 ? 1 : -1) : 0;
                else direction = (Math.random() < 0.5) ? 1 : -1;

                let stepSize = getWeightedInterval(intervalStyle), nextIdx = currentIdx + stepSize;
                if (Math.random() < 0.38) nextIdx = currentIdx;
                else if (Math.random() < 0.28) nextIdx = currentIdx + direction;

                if (motifLen > 1 && motifStartIdx < 0 && noteCount >= motifLen && Math.random() < motifStartProb) {
                    motifStartIdx = state.composition.melody.length - motifLen;
                    motifBuffer = state.composition.melody.slice(motifStartIdx).filter(m => !m.isRest);
                    motifLengthInNotes = motifBuffer.length;
                }

                if (Math.random() < 0.18 && rhythm.baseSec <= 0.25) {
                    if (Math.abs(nextIdx - currentIdx) === 2) {
                        const mid = Math.floor((currentIdx + nextIdx)/2);
                        if (mid !== currentIdx && mid !== nextIdx) nextIdx = mid;
                    }
                }

                nextIdx = Math.max(0, Math.min(available.length-1, nextIdx));
                
                // PHASE 3: Apply chord-tone gravity (70% boost)
                const currentChord = getCurrentChord(currentTotalBeats, state.composition.currentChords);
                const chordTones = getChordTones(currentChord, available);
                
                if (chordTones.length > 0 && Math.random() < 0.70) {
                    // 70% chance to prefer chord tones
                    const closestChordTone = chordTones.reduce((closest, ct) => {
                        const ctIdx = available.indexOf(ct);
                        const closestIdx = available.indexOf(closest);
                        return Math.abs(ctIdx - currentIdx) < Math.abs(closestIdx - currentIdx) ? ct : closest;
                    }, chordTones[0]);
                    nextIdx = available.indexOf(closestChordTone);
                }
                
                current = available[nextIdx]; currentIdx = nextIdx;
                vel = 55 + Math.floor(Math.random() * 45);
                
                // PHASE 3: Duration safety - clamp to next harmonic boundary
                const nextBoundary = getNextHarmonicBoundary(currentTotalBeats, state.composition.currentChords);
                const beatsToBoundary = nextBoundary - currentTotalBeats;
                let finalBeats = rhythm.beats;
                let finalSec = sec;
                
                // Check if note would overhang the boundary
                if (rhythm.beats > beatsToBoundary && beatsToBoundary > 0.1) {
                    // Clamp duration to boundary (unless legato mode - not implemented yet)
                    finalBeats = beatsToBoundary;
                    finalSec = finalBeats * (60 / bpm);
                }
                
                item = {isRest:false, freq:current.freq, durationSec:finalSec, velocity:vel, display:`${current.note}${current.octave} ${rhythm.name}`, beats: finalBeats};
                state.composition.melody.push(item); barContents[barContents.length - 1].push(item);
                currentTotalBeats += finalBeats; currentBeatInBar += finalBeats; currentPhraseBeats += finalBeats;
                noteCount++;

                if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }

                if (currentPhraseBeats >= phraseLenBeats - 0.001) {
                    if (Math.random() < 0.7) {
                        let breakRhythm = getRandomRhythm(1);
                        if (breakRhythm.type === 'rest') {
                            let breakSec = breakRhythm.baseSec * (120 / bpm);
                            item = {isRest: true, durationSec: breakSec, display: breakRhythm.name + ' (phrase break)', beats: breakRhythm.beats};
                            state.composition.melody.push(item); barContents[barContents.length - 1].push(item);
                            currentTotalBeats += breakRhythm.beats; currentBeatInBar += breakRhythm.beats; currentPhraseBeats += breakRhythm.beats;
                            if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }
                        }
                    }
                    currentPhraseBeats = 0; if (contour === 'arch' || contour === 'descending_arch') direction = 1;
                }

                if (motifLen > 0 && motifStartIdx >= 0 && Math.random() < motifRepeatChance && currentTotalBeats < totalBeats * 0.85 && state.composition.melody.length > motifLen + 4) {
                    const transposeOptions = [0, 2, -2, 3, -3, 4, -4], transpose = transposeOptions[Math.floor(Math.random() * transposeOptions.length)];
                    let inserted = 0;
                    for (let k = 0; k < motifBuffer.length && currentTotalBeats < totalBeats - 1.5; k++) {
                        const orig = motifBuffer[k];
                        let varIdx = currentIdx + transpose; varIdx = Math.max(0, Math.min(available.length - 1, varIdx));
                        const varNote = available[varIdx];
                        let varRhythm = getRandomRhythm(remainingInBar);
                        if (varRhythm.type !== 'note') continue;
                        sec = varRhythm.baseSec * (120 / bpm);
                        item = {isRest: false, freq: varNote.freq, durationSec: sec, velocity: vel - 8 - inserted * 4, display: `${varNote.note}${varNote.octave} ${varRhythm.name} (motif var)`, beats: varRhythm.beats};
                        if (varRhythm.beats > remainingInBar + 0.001) continue;
                        state.composition.melody.push(item); barContents[barContents.length - 1].push(item);
                        currentTotalBeats += varRhythm.beats; currentBeatInBar += varRhythm.beats; currentPhraseBeats += varRhythm.beats; currentIdx = varIdx; inserted++;
                        if (currentBeatInBar >= beatsPerBar - 0.001) { currentBeatInBar = 0; barContents.push([]); }
                    }
                    if (inserted >= motifLengthInNotes / 2 && Math.random() < 0.4) { motifStartIdx = -1; motifBuffer = []; motifLengthInNotes = 0; }
                }
            }

            // Ending resolution (Preserved)
            const endingChoice = Math.random();
            let endDegree = endingChoice < 0.60 ? 0 : endingChoice < 0.85 ? 4 : 2;
            let endNote = available.filter(n => n.scaleDegree === endDegree).sort((a,b) => b.octave - a.octave)[0] || available[available.length - 1];
            let endRhythm = getRandomRhythm(Infinity);
            let endSec = endRhythm.baseSec * (120 / bpm), endBeats = endRhythm.beats;
            const remaining = totalBeats - currentTotalBeats;
            
            // PHASE 3: Apply duration safety to ending note
            const endBoundary = getNextHarmonicBoundary(currentTotalBeats, state.composition.currentChords);
            const beatsToEndBoundary = Math.min(remaining, endBoundary - currentTotalBeats);
            if (endBeats > beatsToEndBoundary && beatsToEndBoundary > 0.1) {
                endBeats = beatsToEndBoundary;
                endSec = endBeats * (60 / bpm);
            } else if (endBeats > remaining) {
                endBeats = remaining;
                endSec = endBeats * (0.5 * 120 / bpm);
            }
            
            item = {isRest: false, freq: endNote.freq, durationSec: endSec, velocity: 90 + Math.floor(Math.random() * 10), display: `${endNote.note}${endNote.octave} ${endRhythm.name} (res)`, beats: endBeats};
            state.composition.melody.push(item); barContents[barContents.length - 1].push(item);

            if (currentTotalBeats < totalBeats) {
                const fillBeats = totalBeats - currentTotalBeats, fillSec = fillBeats * (0.5 * 120 / bpm);
                item = {isRest: true, durationSec: fillSec, display: `rest (${fillBeats} b)`, beats: fillBeats};
                state.composition.melody.push(item); barContents[barContents.length - 1].push(item);
            }

            // Display Update
            const presetDisplayName = document.getElementById('harmonicRhythm').selectedOptions[0].text;
            let displayText = `<strong>${root} ${mode.replace('_',' ')} – ${numBars} bars – Harmonic Rhythm: ${presetDisplayName} (${currentChords.length} triggers)</strong><br>`;
            displayText += `<strong>Chords: ${currentChords.map(c => c.name).join(' - ')}</strong><br><br>`;
            barContents.forEach((bar, i) => {
                if (bar.length === 0) return;
                displayText += `Bar ${i+1}: `;
                bar.forEach(m => displayText += `${m.display} `);
                displayText += "|\n";
            });
            document.getElementById('melody-display').innerHTML = displayText;
            document.getElementById('playBtn').disabled = false;
        
}


        // ────────────────────────────────────────────────
        //  PLAYBACK ENGINE (UPGRADED FOR SYNC)
        // ────────────────────────────────────────────────
                document.getElementById('playBtn').addEventListener('click', playComposition);

function playComposition() {
            loadPiano();
            if (state.playback.isPlaying || state.composition.melody.length === 0) return;
            state.playback.isPlaying = true;
            const btn = document.getElementById('playBtn');
            btn.textContent = 'Playing Track...'; btn.disabled = true;

            const startTime = audioCtx.currentTime + 0.15;
            const chordVol = document.getElementById('chordVolume').value / 100;

            // Track 1: Melody (Preserved Logic)
            let mTime = startTime;
            state.composition.melody.forEach(item => {
                if (!item.isRest) {
                    setTimeout(() => {
                        playNote(item.freq, item.velocity, item.durationSec);
                    }, (mTime - audioCtx.currentTime) * 1000);
                }
                mTime += item.durationSec;
            });

            // Track 2: Chords (PHASE 4: Polyphonic playback)
            let cTime = startTime;
            state.composition.currentChords.forEach(chord => {
                setTimeout(() => {
                    // Build array of frequencies for polyphonic playback
                    const chordFreqs = chord.notes.map(note => note.freq);
                    playNote(chordFreqs, Math.round(chordVol * 100), chord.durationSec);
                }, (cTime - audioCtx.currentTime) * 1000);
                cTime += chord.durationSec;
            });

            setTimeout(() => {
                state.playback.isPlaying = false; btn.textContent = 'Play Composition'; btn.disabled = false;
            }, (Math.max(mTime, cTime) - audioCtx.currentTime + 0.8) * 1000);
        
}


