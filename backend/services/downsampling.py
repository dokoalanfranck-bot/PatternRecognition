import numpy as np


def lttb(data, threshold):
    """
    Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm.
    Réduit le nombre de points en préservant au maximum la forme de la courbe.
    
    Args:
        data: numpy array de valeurs (1D)
        threshold: nombre de points cible (> 2)
    
    Returns:
        numpy array d'indices des points sélectionnés (triés)
    """
    if len(data) < 3 or threshold >= len(data):
        return np.arange(len(data))
    
    # Toujours garder le premier et dernier point
    bucket_size = len(data) / (threshold - 2)
    selected_indices = [0]
    
    for i in range(threshold - 2):
        # Bornes du bucket courant
        range_start = int(np.floor((i + 0) * bucket_size)) + 1
        range_end = int(np.floor((i + 1) * bucket_size)) + 1
        range_end = min(range_end, len(data))
        
        # Dernier point du bucket précédent
        prev_idx = selected_indices[-1]
        prev_y = data[prev_idx]
        
        # Premier point du bucket suivant (pour calculer les triangles)
        next_idx = range_end if range_end < len(data) else len(data) - 1
        next_y = data[next_idx]
        
        # Trouver le point du bucket courant qui forme le plus grand triangle
        max_area = -1
        max_area_idx = range_start
        
        for j in range(range_start, range_end):
            # Aire du triangle: (x1, y1), (x2, y2), (x3, y3)
            # Formule: abs((x1(y2-y3) + x2(y3-y1) + x3(y1-y2)) / 2)
            # Avec indices comme x:
            area = abs(
                (prev_idx * (data[j] - next_y) + 
                 j * (next_y - prev_y) + 
                 next_idx * (prev_y - data[j])) / 2.0
            )
            
            if area > max_area:
                max_area = area
                max_area_idx = j
        
        selected_indices.append(max_area_idx)
    
    # Ajouter le dernier point
    selected_indices.append(len(data) - 1)
    
    return np.array(sorted(selected_indices))


def downsample_series(series, target_points=500):
    """
    Downsampler une série temporelle en gardant target_points points max.
    
    Args:
        series: numpy array (la série complète)
        target_points: nombre de points cible
    
    Returns:
        numpy array des indices sélectionnés (triés)
    """
    if len(series) <= target_points:
        return np.arange(len(series))
    
    return lttb(series, target_points)
