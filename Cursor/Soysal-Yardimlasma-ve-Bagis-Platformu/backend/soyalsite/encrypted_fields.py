from __future__ import annotations

from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    key = getattr(settings, "PII_ENCRYPTION_KEY", None)
    if not key:
        raise RuntimeError("PII_ENCRYPTION_KEY ayarlanmadi (settings icinde).")
    if isinstance(key, str):
        key = key.encode("utf-8")
    return Fernet(key)


class EncryptedTextField(models.TextField):
    """
    Sertifikali KVKK gereksinimi icin minimum alan bazli sifreleme.
    Not: Bu alan; arama/filter icin dogrudan kullanilmamalidir.
    """

    def from_db_value(self, value, expression, connection):  # type: ignore[override]
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
            except InvalidToken:
                # Veriler eski bir key ile sifrelendiyse dekrip edilemez;
                # gorunmeme/durum analizi icinham halini dondur.
                return value
        return value

    def get_prep_value(self, value):  # type: ignore[override]
        if value is None:
            return None
        if isinstance(value, str):
            return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
        return _get_fernet().encrypt(str(value).encode("utf-8")).decode("utf-8")

