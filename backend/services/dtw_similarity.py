import numpy as np
from tslearn.metrics import dtw
from scipy.stats import pearsonr


def search_pattern(series, pattern, top_k=10):

    pattern_len = len(pattern)

    pattern_amp = np.max(pattern) - np.min(pattern)

    # Pattern plat (amplitude nulle) : pas de forme à chercher
    if pattern_amp < 0.01:
        return []

    results = []

    step = max(1, int(pattern_len * 0.2))

    for i in range(0, len(series) - pattern_len, step):

        window = series[i:i+pattern_len]

        amp = np.max(window) - np.min(window)

        # filtre amplitude
        if amp < 0.5 * pattern_amp or amp > 1.5 * pattern_amp:
            continue

        # filtre variance
        if np.std(window) < 0.1:
            continue

        # filtre corrélation rapide
        corr, _ = pearsonr(pattern, window)

        if corr < 0.5:
            continue

        # comparaison finale DTW
        score = dtw(pattern, window)

        results.append({
            "index": i,
            "score": score
        })

    results = sorted(results, key=lambda x: x["score"])

    return results[:top_k]