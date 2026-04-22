import pandas as pd
import numpy as np
from pathlib import Path

_cache = {}


def clear_cache():
    """Vide le cache pour forcer un rechargement des datasets."""
    global _cache
    _cache = {}

DATASETS_DIR = Path(__file__).parent.parent / "datasets"

# Chemin par défaut (rétrocompatibilité)
CSV_PATH = DATASETS_DIR / "C2 elect kw.csv"

# Paramètres de détection d'anomalies
OUTLIER_IQR_FACTOR = 3.0  # Facteur IQR — 1.5 est trop agressif sur des données industrielles


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

    # Détection des outliers extrêmes (erreurs capteurs / pics anormaux)
    Q1 = data["value"].quantile(0.25)
    Q3 = data["value"].quantile(0.75)
    IQR = Q3 - Q1

    # Bornes asymétriques : on tolère plus les basses valeurs (arrêt machine légitime)
    lower_bound = max(0.0, Q1 - OUTLIER_IQR_FACTOR * IQR)
    upper_bound = Q3 + OUTLIER_IQR_FACTOR * IQR

    is_outlier = (data["value"] < lower_bound) | (data["value"] > upper_bound)

    if is_outlier.any():
        # Mettre les outliers à NaN puis interpoler linéairement entre les bons voisins
        # (beaucoup plus propre que la moyenne mobile qui est elle-même polluée par les spikes)
        data.loc[is_outlier, "value"] = np.nan
        data["value"] = data["value"].interpolate(method="linear", limit_direction="both")
        # Fallback pour les bords éventuels encore NaN
        if data["value"].isna().any():
            data["value"] = data["value"].fillna(
                data["value"].rolling(window=30, center=True, min_periods=1).median()
            )

    _cache[cache_key] = data
    return _cache[cache_key]
