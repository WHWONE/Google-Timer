const chordPresets = {
            tonic: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [5, 3, 0, 4], [5, 4, 3, 4]],
            subdominant: [[3, 4, 0, 3], [3, 0, 4, 5], [1, 4, 0, 5], [1, 4, 0, 3]],
            dominant: [[4, 5, 3, 0], [4, 0, 3, 4]],
            mediant: [[2, 5, 1, 4], [2, 3, 0, 4]]
        };

        const chordRules = {
            0: [{d:3, w:30}, {d:4, w:30}, {d:5, w:20}, {d:1, w:10}, {d:2, w:10}], 
            1: [{d:4, w:80}, {d:5, w:20}], 
            2: [{d:5, w:70}, {d:3, w:30}], 
            3: [{d:4, w:45}, {d:0, w:35}, {d:1, w:20}],
            4: [{d:0, w:75}, {d:5, w:20}, {d:3, w:5}], // V->IV is weak (5%)
            5: [{d:3, w:50}, {d:4, w:30}, {d:1, w:20}],
            6: [{d:0, w:90}, {d:5, w:10}]
        };

        export function generateProgression(strategy, numBars, rate) {
            const totalChords = numBars * rate;
            let progression = [];
            const strategyBase = strategy.split('_')[0];

            if (chordPresets[strategyBase]) {
                const pool = chordPresets[strategyBase];
                const selected = pool[Math.floor(Math.random() * pool.length)];
                for(let i = 0; i < totalChords; i++) progression.push(selected[i % selected.length]);
            } else {
                // Rule-based Hybrid
                let current = 0; // Always start on Tonic
                for(let i = 0; i < totalChords; i++) {
                    progression.push(current);
                    const rules = chordRules[current] || chordRules[0];
                    let totalW = rules.reduce((s, o) => s + o.w, 0);
                    let r = Math.random() * totalW;
                    for(let opt of rules) { if(r < opt.w) { current = opt.d; break; } r -= opt.w; }
                }
