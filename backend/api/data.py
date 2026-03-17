from fastapi import APIRouter
from backend.services.data_loader import load_dataset
from backend.services.downsampling import downsample_series
import numpy as np

router = APIRouter()

# on charge les données une seule fois
data = load_dataset()


@router.get("/data")
def get_data(points: int = 500):
    """
    Retourne les données downsamplées avec le nombre de points demandé.
    Utilise l'algorithme LTTB pour préserver au maximum la forme de la courbe.
    
    Args:
        points: nombre de points cible (par défaut 500)
    """
    # Limiter le nombre de points entre 50 et 5000
    target_points = max(50, min(5000, points))
    
    # Obtenir les indices à garder
    series_values = data["value"].values
    selected_indices = downsample_series(series_values, target_points)
    
    # Retourner les données downsamplées
    downsampled = data.iloc[selected_indices].reset_index()
    return downsampled.to_dict(orient="records")