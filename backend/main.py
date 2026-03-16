from fastapi import FastAPI
from backend.api.pattern import router as pattern_router
from fastapi.middleware.cors import CORSMiddleware
from backend.api.data import router as data_router

app = FastAPI()

app.include_router(data_router)
app.include_router(pattern_router)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

