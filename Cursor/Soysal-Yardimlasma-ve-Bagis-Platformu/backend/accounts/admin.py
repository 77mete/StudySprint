from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser, NeedVerification


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('id', 'username', 'email', 'role', 'verification_status', 'is_suspended', 'trust_score')
    list_filter = ('role', 'verification_status', 'is_suspended')
    search_fields = ('username', 'email', 'display_name')
    ordering = ('id',)

    fieldsets = UserAdmin.fieldsets + (
        (
            'Profile',
            {
                'fields': (
                    'display_name',
                    'role',
                    'verification_status',
                    'is_suspended',
                    'trust_score',
                ),
            },
        ),
        (
            'KVKK (Encrypted)',
            {
                'fields': (
                    'tc_identity',
                    'phone',
                    'address',
                ),
            },
        ),
    )


@admin.register(NeedVerification)
class NeedVerificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'submitted_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('user__username', 'user__email')
    raw_id_fields = ('user', 'reviewed_by')
