from rest_framework import serializers

from .models import Listing


class ListingSerializer(serializers.ModelSerializer):
    primary_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Listing
        fields = [
            'id',
            'category',
            'title',
            'description',
            'primary_image',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'donor', 'status', 'created_at', 'updated_at']

