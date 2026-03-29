from fastapi import APIRouter
from backend.services.data_loader import load_dataset, list_datasets

router = APIRouter()


@router.get("/datasets")
def get_datasets():
    """Liste tous les fichiers CSV disponibles."""
    return {"datasets": list_datasets()}


@router.get("/data")
def get_data(page: int = 0, page_size: int = 50000, dataset: str = None):
    """
    Pagination des données — charge tout sans downsampling.
    page=0 → points 0-50k
    page=1 → points 50k-100k, etc.
    """
    data = load_dataset(dataset)

    start_idx = page * page_size
    end_idx = start_idx + page_size
    
    result = data.iloc[start_idx:end_idx].reset_index().to_dict(orient="records")
    
    total_points = len(data)
    total_pages = (total_points + page_size - 1) // page_size
    
    return {
        "points": result,
        "page": page,
        "page_size": page_size,
        "total_points": total_points,
        "total_pages": total_pages
    }