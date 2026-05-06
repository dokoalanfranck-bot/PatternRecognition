from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from backend.services import database as db

router = APIRouter(prefix="/auth", tags=["auth"])

# ─── Configuration JWT ─────────────────────────────────────────────────────
_SECRET_KEY = "pfe-pattern-recognition-secret-key-2026"
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 8

_bearer = HTTPBearer()


# ─── Helpers ───────────────────────────────────────────────────────────────

def _create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": username, "exp": expire},
        _SECRET_KEY,
        algorithm=_ALGORITHM,
    )


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    """Dependency: valide le token et retourne le username."""
    try:
        payload = jwt.decode(credentials.credentials, _SECRET_KEY, algorithms=[_ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token invalide.")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré.")


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: dict):
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        raise HTTPException(status_code=400, detail="Identifiants requis.")

    user = db.get_user(username)
    if not user or not db.verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Nom d'utilisateur ou mot de passe incorrect.")

    return {
        "access_token": _create_token(username),
        "token_type": "bearer",
        "username": username,
    }


@router.post("/change-password")
def change_password(body: dict, username: str = Depends(get_current_user)):
    current = body.get("current_password") or ""
    new_pwd = body.get("new_password") or ""
    confirm = body.get("confirm_password") or ""

    if not current or not new_pwd or not confirm:
        raise HTTPException(status_code=400, detail="Tous les champs sont requis.")

    if new_pwd != confirm:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe et la confirmation ne correspondent pas.")

    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères.")

    user = db.get_user(username)
    if not user or not db.verify_password(current, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect.")

    db.set_password(username, new_pwd)
    return {"message": "Mot de passe modifié avec succès."}


@router.get("/me")
def me(username: str = Depends(get_current_user)):
    return {"username": username}
