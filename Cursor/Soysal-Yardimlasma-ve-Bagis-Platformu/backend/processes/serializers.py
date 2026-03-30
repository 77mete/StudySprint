from rest_framework import serializers


class ProcessStatusUpdateSerializer(serializers.Serializer):
    """
    MVP icin sadece status gecisi tetikleyen serializer.
    """

    # placeholder fields yok; request body bos/opsiyonel olabilir.
    pass


class RatingCreateSerializer(serializers.Serializer):
    value = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True)

