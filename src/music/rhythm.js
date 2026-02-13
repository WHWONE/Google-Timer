const rhythmOptions = [
            {type: 'note', name: 'whole', baseSec: 2.0, prob: 0.01, beats: 4.0},
            {type: 'note', name: 'half', baseSec: 1.0, prob: 0.05, beats: 2.0},
            {type: 'note', name: 'dotted quarter', baseSec: 0.75, prob: 0.10, beats: 1.5},
            {type: 'note', name: 'quarter', baseSec: 0.5, prob: 0.22, beats: 1.0},
            {type: 'note', name: 'dotted eighth', baseSec: 0.375, prob: 0.18, beats: 0.75},
            {type: 'note', name: 'eighth', baseSec: 0.25, prob: 0.26, beats: 0.5},
            {type: 'note', name: 'dotted 16th', baseSec: 0.1875, prob: 0.08, beats: 0.375},
            {type: 'note', name: '16th', baseSec: 0.125, prob: 0.14, beats: 0.25},
            {type: 'rest', name: 'whole rest', baseSec: 2.0, prob: 0.01, beats: 4.0},
            {type: 'rest', name: 'half rest', baseSec: 1.0, prob: 0.02, beats: 2.0},
            {type: 'rest', name: 'dotted quarter rest', baseSec: 0.75, prob: 0.03, beats: 1.5},
            {type: 'rest', name: 'quarter rest', baseSec: 0.5, prob: 0.05, beats: 1.0},
            {type: 'rest', name: 'dotted eighth rest', baseSec: 0.375, prob: 0.04, beats: 0.75},
            {type: 'rest', name: 'eighth rest', baseSec: 0.25, prob: 0.06, beats: 0.5},
            {type: 'rest', name: 'dotted 16th rest', baseSec: 0.1875, prob: 0.02, beats: 0.375},
            {type: 'rest', name: '16th rest', baseSec: 0.125, prob: 0.04, beats: 0.25}
        ];

        function getRhythmWeight(r) {
            const key = `weight-${r.type}-${r.name.replace(/ /g, '-').toLowerCase()}`;
            const slider = document.getElementById(key);
            return slider ? parseInt(slider.value) : Math.round(r.prob * 100);
        }

        export function getRandomRhythm(remainingBeatsInBar = Infinity) {
            let candidates = rhythmOptions.filter(r => r.beats <= remainingBeatsInBar + 0.001);
            if (candidates.length === 0) candidates = rhythmOptions.filter(r => r.beats <= 0.5);
            let totalWeight = candidates.reduce((sum, r) => sum + getRhythmWeight(r), 0);
            if (totalWeight === 0) {
            console.warn('All rhythm weights are zero! Defaulting to quarter note.');
            return candidates.find(r => r.type === 'note' && r.name === 'quarter') || candidates[0];
        }
