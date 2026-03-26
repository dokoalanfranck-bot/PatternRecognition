import numpy as np
import stumpy


def z_normalize(x):
    """Z-score normalization pour comparaison indépendante de l'amplitude."""
    std = np.std(x)
    if std < 1e-10:
        return x - np.mean(x)
    return (x - np.mean(x)) / std


def _get_non_overlapping_fast(distance_profile, k, exclusion_zone):
    """
    Version vectorisée de l'extraction non-chevauchante.

    Stratégie : on trie le profil une seule fois (O(n log n))
    puis on parcourt les candidats triés en ne gardant que ceux
    qui ne chevauchent pas les précédents.

    Si k <= 0, retourne TOUS les motifs non-chevauchants.
    """
    sorted_indices = np.argsort(distance_profile)

    indices = []
    blocked = np.zeros(len(distance_profile), dtype=bool)
    unlimited = (k <= 0)

    for idx in sorted_indices:
        if not unlimited and len(indices) >= k:
            break
        if distance_profile[idx] == np.inf:
            break
        if blocked[idx]:
            continue

        indices.append(int(idx))

        lo = max(0, idx - exclusion_zone)
        hi = min(len(distance_profile), idx + exclusion_zone)
        blocked[lo:hi] = True

    return indices


def search_pattern(series, pattern, top_k=0):
    """
    Recherche les sous-séquences les plus similaires au pattern
    dans la série via MASS (stumpy) en O(n log n).

    top_k=0  → retourne TOUS les motifs non-chevauchants.
    top_k>0  → retourne au plus top_k motifs.
    """
    pattern_len = len(pattern)
    pattern_amp = float(np.max(pattern) - np.min(pattern))

    diagnostics = {"total_positions": 0, "final_computed": 0}

    if pattern_amp < 0.01:
        return [], diagnostics

    if pattern_len > len(series):
        return [], diagnostics

    distance_profile = stumpy.mass(pattern, series)
    distance_profile = np.where(np.isnan(distance_profile), np.inf, distance_profile)

    diagnostics["total_positions"] = len(distance_profile)

    exclusion_zone = pattern_len // 2
    top_indices = _get_non_overlapping_fast(distance_profile, top_k, exclusion_zone)

    results = [{"index": i, "score": float(distance_profile[i])} for i in top_indices]
    diagnostics["final_computed"] = len(results)

    return results, diagnostics
