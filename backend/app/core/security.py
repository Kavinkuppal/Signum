from cryptography.fernet import Fernet
import base64
from app.core.config import settings


def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY.encode()[:32]
    key = base64.urlsafe_b64encode(key.ljust(32)[:32])
    return Fernet(key)


def encrypt(data: str) -> str:
    return _get_fernet().encrypt(data.encode()).decode()


def decrypt(data: str) -> str:
    return _get_fernet().decrypt(data.encode()).decode()
