import pandas as pd
from fastapi import APIRouter
from backend.services.data_loader import load_dataset, list_datasets

router = APIRouter()


@router.get("/datasets")
def get_datasets():
    """Liste tous les fichiers CSV disponibles."""
    return {"datasets": list_datasets()}


def _period_bounds(data, period, offset):
    """Calcule les bornes temporelles pour un period+offset donné."""
    min_date = data.index.min()
    max_date = data.index.max()

    if period == "day":
        base = pd.Timestamp(min_date.year, min_date.month, min_date.day)
        start = base + pd.DateOffset(days=offset)
        end = start + pd.DateOffset(days=1)
        last = pd.Timestamp(max_date.year, max_date.month, max_date.day)
        total = (last - base).days + 1
    elif period == "week":
        base = pd.Timestamp(min_date.year, min_date.month, min_date.day) - pd.DateOffset(days=min_date.weekday())
        start = base + pd.DateOffset(weeks=offset)
        end = start + pd.DateOffset(weeks=1)
        last = pd.Timestamp(max_date.year, max_date.month, max_date.day) - pd.DateOffset(days=max_date.weekday())
        total = max(1, ((last - base).days // 7) + 1)
    elif period == "month":
        base = pd.Timestamp(min_date.year, min_date.month, 1)
        start = base + pd.DateOffset(months=offset)
        end = start + pd.DateOffset(months=1)
        last = pd.Timestamp(max_date.year, max_date.month, 1)
        total = (last.year - base.year) * 12 + (last.month - base.month) + 1
    elif period == "year":
        base = pd.Timestamp(min_date.year, 1, 1)
        start = base + pd.DateOffset(years=offset)
        end = start + pd.DateOffset(years=1)
        total = max_date.year - min_date.year + 1
    else:
        return _period_bounds(data, "month", offset)

    return start, end, total


@router.get("/data")
def get_data(period: str = "month", offset: int = 0, dataset: str = None,
             start: str = None, end: str = None):
    """
    Pagination temporelle des données.
    period : day | week | month | year | custom
    offset : 0 = première période, 1 = suivante, etc.
    start/end : plage personnalisée (ISO dates), utilisé quand period=custom
    """
    data = load_dataset(dataset)

    if period == "custom" and start and end:
        ts_start = pd.Timestamp(start)
        ts_end = pd.Timestamp(end)
        result = data.loc[(data.index >= ts_start) & (data.index < ts_end)].reset_index().to_dict(orient="records")
        return {
            "points": result,
            "period": "custom",
            "offset": 0,
            "total_periods": 1,
            "current_start": ts_start.isoformat(),
            "current_end": ts_end.isoformat(),
            "total_points": len(data),
            "period_points": len(result),
        }

    ts_start, ts_end, total_periods = _period_bounds(data, period, offset)

    # Clamp offset
    offset = max(0, min(offset, total_periods - 1))
    if offset != max(0, min(offset, total_periods - 1)):
        ts_start, ts_end, total_periods = _period_bounds(data, period, offset)

    result = data.loc[(data.index >= ts_start) & (data.index < ts_end)].reset_index().to_dict(orient="records")

    return {
        "points": result,
        "period": period,
        "offset": offset,
        "total_periods": total_periods,
        "current_start": ts_start.isoformat(),
        "current_end": ts_end.isoformat(),
        "total_points": len(data),
        "period_points": len(result),
    }


@router.get("/data/range")
def get_data_range(dataset: str = None):
    """Retourne la plage de dates min/max du dataset."""
    data = load_dataset(dataset)
    return {
        "min_date": data.index.min().isoformat(),
        "max_date": data.index.max().isoformat(),
    }