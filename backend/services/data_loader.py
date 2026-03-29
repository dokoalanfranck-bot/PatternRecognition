import pandas as pd
import numpy as np
from pathlib import Path

_cache = {}

DATASETS_DIR = Path(__file__).parent.parent / "datasets"

# Chemin par défaut (rétrocompatibilité)
CSV_PATH = DATASETS_DIR / "C2 elect kw.csv"


def list_datasets():
    """Liste tous les fichiers CSV disponibles dans le dossier datasets."""
    datasets = []
    for f in sorted(DATASETS_DIR.glob("*.csv")):
        name = f.stem
        size_kb = round(f.stat().st_size / 1024, 1)
        # Lire les premières lignes pour obtenir un aperçu
        try:
            preview = pd.read_csv(f, nrows=5)
            rows_estimate = sum(1 for _ in open(f, encoding="utf-8")) - 1
            cols = list(preview.columns)
        except Exception:
            rows_estimate = 0
            cols = []
        datasets.append({
            "filename": f.name,
            "name": name,
            "size_kb": size_kb,
            "rows_estimate": rows_estimate,
            "columns": cols,
        })
    return datasets


def load_dataset(filename=None):
    global _cache

    if filename is None:
        path = CSV_PATH
    else:
        path = DATASETS_DIR / filename

    cache_key = str(path)
    if cache_key in _cache:
        return _cache[cache_key]

    data = pd.read_csv(path)

    # conversion date — format="mixed" gère à la fois les dates sans et avec microsecondes
    data["date"] = pd.to_datetime(data["date"], format="mixed", errors="coerce")

    # conversion valeur
    data["value"] = (
        data["value"]
        .astype(str)
        .str.replace(",", ".")
    )

    data["value"] = pd.to_numeric(data["value"], errors="coerce").astype(np.float64)

    # tri par date
    data = data.sort_values("date")

    # supprimer NaN
    data = data.dropna()

    data = data.set_index("date")

    _cache[cache_key] = data
    return _cache[cache_key]