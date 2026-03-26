import requests
import json
from datetime import datetime, timedelta

# Charger les données pour calculer les dates
import pandas as pd
data = pd.read_csv('backend/datasets/C2 elect kw.csv')
data['date'] = pd.to_datetime(data['date'], format='mixed', errors='coerce')
data['value'] = data['value'].astype(str).str.replace(',', '.').astype(float)
data = data.sort_values('date').dropna()

# Prendre une sous-séquence aléatoire au milieu pour pattern
idx_start = len(data) // 2
idx_end = idx_start + 100

pattern_start = str(data.iloc[idx_start]['date'])
pattern_end = str(data.iloc[idx_end]['date'])

print(f"Test 1: Pattern selection")
print(f"  Start: {pattern_start}")
print(f"  End: {pattern_end}")

# Test l'endpoint
response = requests.post(
    "http://127.0.0.1:8000/pattern",
    json={
        "start": pattern_start,
        "end": pattern_end,
        "top_k": 10
    }
)

result = response.json()
print(f"\nRésultats: {len(result.get('matches', []))} patterns trouvés")

if result.get('matches'):
    for i, m in enumerate(result['matches'][:3]):
        print(f"  {i+1}. Score: {m['score']:.4f}, Start: {m['start']}")
else:
    print("  ❌ Aucun pattern trouvé!")
    print(f"  Erreur: {result.get('error', 'unknown')}")

# Test les scores pour voir la distribution
print(f"\nTest 2: Score distribution")
response2 = requests.post(
    "http://127.0.0.1:8000/scores",
    json={
        "start": pattern_start,
        "end": pattern_end,
        "n_subseq": 100
    }
)

result2 = response2.json()
scores = result2.get('scores', [])
print(f"Scores calculés: {len(scores)}")
if scores:
    scores_vals = [s['score'] for s in scores]
    print(f"  Min: {min(scores_vals):.2f}")
    print(f"  Max: {max(scores_vals):.2f}")
    print(f"  Mean: {sum(scores_vals)/len(scores_vals):.2f}")
