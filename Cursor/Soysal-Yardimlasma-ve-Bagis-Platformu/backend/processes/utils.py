import secrets

from processes.models import DonationProcess


def generate_shipping_code() -> str:
    """
    MVP icin kargo kodu stub.
    Gercek entegrasyon task-008'de eklenecek.
    """

    while True:
        # URL-safe ve rakamlara dokunmadan kisa ama unikal kod.
        code = secrets.token_urlsafe(8).replace('-', '').replace('_', '')[:16].upper()
        if not DonationProcess.objects.filter(shipping_code=code).exists():
            return code

