import numpy as np
import stumpy


def z_normalize(x):
    """Z-score normalization pour comparaison indépendante de l'amplitude."""
    std = np.std(x)
    if std < 1e-10:
        return x - np.mean(x)
    return (x - np.mean(x)) / std


def _get_non_overlapping(distance_profile, k, exclusion_zone):
    """Extrait les top-k indices sans chevauchement via exclusion zone."""
    profile = distance_profile.copy()
    indices = []
    for _ in range(k):
        idx = int(np.argmin(profile))
        if profile[idx] == np.inf:
            break
        indices.append(idx)
        lo = max(0, idx - exclusion_zone)
        hi = min(len(profile), idx + exclusion_zone)
        profile[lo:hi] = np.inf
    return indices


def search_pattern(series, pattern, top_k=10):
    """
    Recherche les top_k sous-séquences les plus similaires au pattern
    dans la série via MASS (stumpy) en O(n log n).
    Une exclusion zone de pattern_len // 2 garantit des résultats
    non chevauchants.
    """
    pattern_len = len(pattern)
    pattern_amp = float(np.max(pattern) - np.min(pattern))

    diagnostics = {
        "total_positions": 0,
        "passed_amplitude": -1,
        "passed_variance": -1,
        "passed_correlation": -1,
        "final_computed": 0,
        "step": 1,
    }

    if pattern_amp < 0.01:
        return [], diagnostics

    if pattern_len > len(series):
        return [], diagnostics

    # MASS normalise en interne — pas besoin de z_normalize ici
    distance_profile = stumpy.mass(pattern, series)

    # Remplacer les NaN par inf pour éviter les erreurs d'argsort
    distance_profile = np.where(np.isnan(distance_profile), np.inf, distance_profile)

    diagnostics["total_positions"] = len(distance_profile)

    # Extraction non chevauchante
    exclusion_zone = pattern_len // 2
    top_indices = _get_non_overlapping(distance_profile, top_k, exclusion_zone)

    results = [{"index": i, "score": float(distance_profile[i])} for i in top_indices]

    diagnostics["final_computed"] = len(results)

    return results, diagnostics