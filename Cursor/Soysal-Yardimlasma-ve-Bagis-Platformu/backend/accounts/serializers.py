from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import NeedVerification

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Rol bazli kayit.
    - Bagisci kaydi: sadece rol + temel alanlar.
    - Ihtiyac Sahibi kaydi: belge yukleme + PII alanlarini sifreli saklama.
    """

    password1 = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    student_document = serializers.FileField(required=False, allow_null=True)
    income_document = serializers.FileField(required=False, allow_null=True)

    tc_identity = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    phone = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    address = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'role',
            'display_name',
            'tc_identity',
            'phone',
            'address',
            'password1',
            'password2',
            'student_document',
            'income_document',
        ]
        extra_kwargs = {
            'email': {'required': False},
        }

    def validate(self, attrs):
        if attrs.get('password1') != attrs.get('password2'):
            raise serializers.ValidationError({'password2': 'Parolalar eslesmiyor.'})

        role = attrs.get('role')
        if role == User.ROLE_NEED:
            if not attrs.get('student_document') or not attrs.get('income_document'):
                raise serializers.ValidationError(
                    {'non_field_errors': 'Ihtiyac Sahibi icin belge yuklemek zorunludur.'}
                )
        return attrs

    def create(self, validated_data):
        student_document = validated_data.pop('student_document', None)
        income_document = validated_data.pop('income_document', None)
        password = validated_data.pop('password1')
        validated_data.pop('password2', None)

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            role=validated_data.get('role', User.ROLE_DONOR),
            display_name=validated_data.get('display_name', ''),
            tc_identity=validated_data.get('tc_identity', None),
            phone=validated_data.get('phone', None),
            address=validated_data.get('address', None),
        )

        if user.role == User.ROLE_NEED:
            # Initially pending; admin approves/rejects in a later step.
            user.verification_status = User.VERIFICATION_PENDING
            user.save(update_fields=['verification_status'])
            NeedVerification.objects.create(
                user=user,
                student_document=student_document,
                income_document=income_document,
                status=NeedVerification.STATUS_PENDING,
            )
        else:
            user.verification_status = User.VERIFICATION_APPROVED
            user.save(update_fields=['verification_status'])

        return user


class NeedVerificationReviewSerializer(serializers.Serializer):
    STATUS_APPROVED = NeedVerification.STATUS_APPROVED
    STATUS_REJECTED = NeedVerification.STATUS_REJECTED

    status = serializers.ChoiceField(choices=[STATUS_APPROVED, STATUS_REJECTED])
    admin_notes = serializers.CharField(required=False, allow_blank=True)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class AdminSuspendUserSerializer(serializers.Serializer):
    suspended = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True)

