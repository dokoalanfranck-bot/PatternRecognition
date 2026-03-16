import pandas as pd
import numpy as np
from pathlib import Path

_cache = None

# Chemin absolu vers le CSV, quel que soit le répertoire de lancement
CSV_PATH = Path(__file__).parent.parent / "datasets" / "C2 elect kw.csv"

def load_dataset():
    global _cache
    if _cache is not None:
        return _cache

    data = pd.read_csv(CSV_PATH)

    # conversion date — format="mixed" gère à la fois les dates sans et avec microsecondes
    data["date"] = pd.to_datetime(data["date"], format="mixed", errors="coerce")

    # conversion valeur
    data["value"] = (
        data["value"]
        .astype(str)
        .str.replace(",", ".")
    )

    data["value"] = pd.to_numeric(data["value"], errors="coerce")

    # tri par date
    data = data.sort_values("date")

    # supprimer NaN
    data = data.dropna()


    data = data.set_index("date")

    _cache = data
    return _cache