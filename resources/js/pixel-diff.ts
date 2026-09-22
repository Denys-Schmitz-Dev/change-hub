export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

// Compare at native coordinates; missing canvas area is a difference, even if white.
export function highlightPixels(before: Pixels, after: Pixels, tolerance = 16) {
    const left = new Uint8ClampedArray(before.data), right = new Uint8ClampedArray(after.data);
    const width = Math.max(before.width, after.width), height = Math.max(before.height, after.height);
    let changed = 0, total = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const inA = x < before.width && y < before.height, inB = x < after.width && y < after.height;
        if (!inA && !inB) continue;
        total++;
        const a = (y * before.width + x) * 4, b = (y * after.width + x) * 4;
        const channel = (pixels: Pixels, offset: number, c: number) => pixels.data[offset + c] * pixels.data[offset + 3] / 255 + 255 - pixels.data[offset + 3];
        const differs = !inA || !inB || [0, 1, 2].some(c => Math.abs(channel(before, a, c) - channel(after, b, c)) > tolerance);
        if (!differs) continue;
        changed++;
        for (const [output, offset, present, color] of [[left, a, inA, [220, 38, 38]], [right, b, inB, [22, 163, 74]]] as const) {
            if (!present) continue;
            for (let c = 0; c < 3; c++) output[offset + c] = Math.round(output[offset + c] * .35 + color[c] * .65);
            output[offset + 3] = 255;
        }
    }
    return { left, right, changed, total };
}
