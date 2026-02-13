const intervalPresets = {
            natural: [{steps: 0, weight: 0.20}, {steps: 1, weight: 0.35}, {steps: -1, weight: 0.35}, {steps: 2, weight: 0.12}, {steps: -2, weight: 0.12}, {steps: 3, weight: 0.08}, {steps: -3, weight: 0.08}, {steps: 4, weight: 0.05}, {steps: -4, weight: 0.05}, {steps: 5, weight: 0.03}, {steps: -5, weight: 0.03}],
            stepwise: [{steps: 0, weight: 0.25}, {steps: 1, weight: 0.40}, {steps: -1, weight: 0.40}, {steps: 2, weight: 0.10}, {steps: -2, weight: 0.10}, {steps: 3, weight: 0.05}, {steps: -3, weight: 0.05}],
            leaps: [{steps: 0, weight: 0.15}, {steps: 1, weight: 0.15}, {steps: -1, weight: 0.15}, {steps: 3, weight: 0.15}, {steps: -3, weight: 0.15}, {steps: 5, weight: 0.10}, {steps: -5, weight: 0.10}, {steps: 4, weight: 0.10}, {steps: -4, weight: 0.10}],
            chromatic: [{steps: 0, weight: 0.20}, {steps: 1, weight: 0.20}, {steps: -1, weight: 0.20}, {steps: 2, weight: 0.10}, {steps: -2, weight: 0.10}]
        };

        export function getWeightedInterval(style) {
            const weights = intervalPresets[style] || intervalPresets.natural;
            let total = weights.reduce((sum, w) => sum + w.weight, 0);
            let r = Math.random() * total, sum = 0;
            for (const w of weights) { sum += w.weight; if (r <= sum) return w.steps; }
            return 1;
        }
