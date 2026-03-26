from fastapi import APIRouter
from backend.services.data_loader import load_dataset

router = APIRouter()

# on charge les données une seule fois
data = load_dataset()


@router.get("/data")
def get_data(page: int = 0, page_size: int = 50000):
    """
    Pagination des données — charge tout sans downsampling.
    page=0 → points 0-50k
    page=1 → points 50k-100k, etc.
    """
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