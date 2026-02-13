export function getHarmonicTriggers(preset, totalBeats, beatsPerBar) {
            const triggers = [];
            const totalBars = Math.ceil(totalBeats / beatsPerBar);
            
            if (preset.type === 'bar_local') {
                // Simple bar-local offsets repeat every bar
                for (let bar = 0; bar < totalBars; bar++) {
                    preset.offsets.forEach(offset => {
                        const triggerBeat = bar * beatsPerBar + offset;
                        if (triggerBeat < totalBeats) {
                            triggers.push(triggerBeat);
                        }
