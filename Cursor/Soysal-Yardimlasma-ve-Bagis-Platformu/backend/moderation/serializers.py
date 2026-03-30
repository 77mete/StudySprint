from rest_framework import serializers


class ModerationTicketCreateSerializer(serializers.Serializer):
    process_id = serializers.IntegerField()
    ticket_type = serializers.CharField(required=False, allow_blank=True, default='appeal')
    reason = serializers.CharField()


class ModerationTicketReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['resolved', 'rejected'])
    admin_notes = serializers.CharField(required=False, allow_blank=True)

