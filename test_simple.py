#!/usr/bin/env python3
import pandas as pd
import numpy as np
from backend.services.dtw_similarity import search_pattern

# Charger les données
data = pd.read_csv('backend/datasets/C2 elect kw.csv')
data['date'] = pd.to_datetime(data['date'], format='mixed', errors='coerce')
data['value'] = data['value'].astype(str).str.replace(',', '.').astype(float)
data = data.sort_values('date').dropna()

series = data['value'].values

# Prendre un pattern au milieu
idx = len(series) // 2
pattern_len = 100
pattern = series[idx:idx+pattern_len]

print(f"Pattern length: {pattern_len} points")
print(f"Pattern amplitude: {pattern.max() - pattern.min():.2f}")
print(f"Series length: {len(series)} points")

# Tester l'algorithme
results = search_pattern(series, pattern, top_k=10)

print(f"\n✅ Patterns trouvés: {len(results)}")
if results:
    for i, r in enumerate(results[:5]):
        print(f"  {i+1}. Score: {r['score']:.4f} at index {r['index']}")
else:
    print("  ❌ AUCUN pattern trouvé!")
