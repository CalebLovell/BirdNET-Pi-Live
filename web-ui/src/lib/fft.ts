// A minimal in-place radix-2 Cooley-Tukey FFT, enough to turn a windowed frame
// of PCM samples into a magnitude spectrum for the spectrogram. Kept dependency
// -free on purpose: the whole point of rendering spectrograms in the browser is
// to avoid pulling in an audio toolchain (see best-recording-card.tsx). `size`
// must be a power of two.
export function fftMagnitudes(real: Float32Array, imag: Float32Array): void {
	const n = real.length;
	if (n <= 1) return;

	// Bit-reversal permutation.
	for (let i = 1, j = 0; i < n; i += 1) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) {
			j ^= bit;
		}
		j ^= bit;
		if (i < j) {
			const tr = real[i];
			real[i] = real[j];
			real[j] = tr;
			const ti = imag[i];
			imag[i] = imag[j];
			imag[j] = ti;
		}
	}

	// Butterflies.
	for (let len = 2; len <= n; len <<= 1) {
		const ang = (-2 * Math.PI) / len;
		const wReal = Math.cos(ang);
		const wImag = Math.sin(ang);
		for (let i = 0; i < n; i += len) {
			let curReal = 1;
			let curImag = 0;
			for (let k = 0; k < len >> 1; k += 1) {
				const aIndex = i + k;
				const bIndex = i + k + (len >> 1);
				const bReal = real[bIndex] * curReal - imag[bIndex] * curImag;
				const bImag = real[bIndex] * curImag + imag[bIndex] * curReal;
				real[bIndex] = real[aIndex] - bReal;
				imag[bIndex] = imag[aIndex] - bImag;
				real[aIndex] += bReal;
				imag[aIndex] += bImag;
				const nextReal = curReal * wReal - curImag * wImag;
				curImag = curReal * wImag + curImag * wReal;
				curReal = nextReal;
			}
		}
	}
}
