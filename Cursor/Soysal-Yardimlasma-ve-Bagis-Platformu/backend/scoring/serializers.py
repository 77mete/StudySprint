from rest_framework import serializers


class ProcessRatingSerializer(serializers.Serializer):
    value = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True)

