from rest_framework import serializers


class ApplyToListingSerializer(serializers.Serializer):
    """
    MVP icin basvuru icin ek alan yok.
    (Gelecekte ihtiyaca uygun belge/materyal alanlari eklenecek.)
    """

    # Placeholder alan - bos request da kabul edebilmek icin serializer None.
    pass

