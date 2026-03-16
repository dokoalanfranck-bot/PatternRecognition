from fastapi import APIRouter
from backend.services.data_loader import load_dataset

router = APIRouter()

# on charge les données une seule fois
data = load_dataset()


@router.get("/data")
def get_data():
    return data.reset_index().head(1000).to_dict(orient="records")