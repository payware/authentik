"""authentik core signals"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.signals import user_logged_in
from django.core.cache import cache
from django.db import transaction
from django.db.models import Model
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import Signal, receiver
from django.http.request import HttpRequest
from structlog.stdlib import get_logger

from authentik.core.models import (
    Application,
    AuthenticatedSession,
    BackchannelProvider,
    ExpiringModel,
    Group,
    Session,
    User,
    default_token_duration,
)
from authentik.flows.apps import RefreshOtherFlowsAfterAuthentication
from authentik.root.ws.consumer import build_device_group

# Arguments: user: User, password: str
password_changed = Signal()
# Arguments: credentials: dict[str, any], request: HttpRequest, stage: Stage
login_failed = Signal()

LOGGER = get_logger()


@receiver(post_save, sender=Application)
def post_save_application(sender: type[Model], instance, created: bool, **_):
    """Clear user's application cache upon application creation"""
    from authentik.core.api.applications import user_app_cache_key

    if not created:  # pragma: no cover
        return

    # Also delete user application cache
    keys = cache.keys(user_app_cache_key("*"))
    cache.delete_many(keys)


@receiver(user_logged_in)
def user_logged_in_session(sender, request: HttpRequest, user: User, **_):
    """Create an AuthenticatedSession from request"""

    session = AuthenticatedSession.from_request(request, user)
    if session:
        session.save()

    if not RefreshOtherFlowsAfterAuthentication().get():
        return
    layer = get_channel_layer()
    device_cookie = request.COOKIES.get("authentik_device")
    if device_cookie:
        async_to_sync(layer.group_send)(
            build_device_group(device_cookie),
            {"type": "event.session.authenticated"},
        )


@receiver(post_delete, sender=AuthenticatedSession)
def authenticated_session_delete(sender: type[Model], instance: "AuthenticatedSession", **_):
    """Delete session when authenticated session is deleted"""
    Session.objects.filter(session_key=instance.pk).delete()


@receiver(pre_save)
def backchannel_provider_pre_save(sender: type[Model], instance: Model, **_):
    """Ensure backchannel providers have is_backchannel set to true"""
    if not isinstance(instance, BackchannelProvider):
        return
    instance.is_backchannel = True


@receiver(pre_save)
def expiring_model_pre_save(sender: type[Model], instance: Model, **_):
    """Ensure expires is set on ExpiringModels that are set to expire"""
    if not issubclass(sender, ExpiringModel):
        return
    if instance.expiring and instance.expires is None:
        instance.expires = default_token_duration()


# payware partner group mapping based on user attributes
PAYWARE_GROUP_MAPPING = {
    "BANK": "payware-partners-payment-institutions",
    "MERCHANT": "payware-partners-merchants",
    "ISV": "payware-partners-isvs",
}


@receiver(post_save, sender=User)
def assign_user_to_partner_group(sender: type[Model], instance: User, created: bool, **_):
    """
    Automatically assign users to partner groups based on their attributes.

    Expected attributes:
        - tenant_type: "BANK" or "MERCHANT"
        - isISV: true/false (only relevant for MERCHANT)

    Group mapping:
        - BANK -> payware-partners-payment-institutions
        - MERCHANT + isISV=false -> payware-partners-merchants
        - MERCHANT + isISV=true -> payware-partners-isvs
    """
    tenant_type = instance.attributes.get("tenant_type")
    if not tenant_type:
        return

    # Determine target group
    if tenant_type == "BANK":
        group_name = PAYWARE_GROUP_MAPPING["BANK"]
    elif tenant_type == "MERCHANT":
        is_isv = instance.attributes.get("isISV", False)
        if is_isv:
            group_name = PAYWARE_GROUP_MAPPING["ISV"]
        else:
            group_name = PAYWARE_GROUP_MAPPING["MERCHANT"]
    else:
        LOGGER.debug("Unknown tenant_type, skipping group assignment", tenant_type=tenant_type)
        return

    try:
        group = Group.objects.filter(name=group_name).first()
        if not group:
            LOGGER.warning(
                "Partner group not found, skipping assignment",
                group_name=group_name,
                user=instance.username,
            )
            return

        # Check if already a member
        if instance.ak_groups.filter(group_uuid=group.group_uuid).exists():
            LOGGER.debug(
                "User already in group",
                user=instance.username,
                group=group_name,
            )
            return

        # Add user to group
        with transaction.atomic():
            instance.ak_groups.add(group)

        LOGGER.info(
            "Assigned user to partner group",
            user=instance.username,
            group=group_name,
            tenant_type=tenant_type,
            is_isv=instance.attributes.get("isISV", False),
        )
    except Exception as exc:
        LOGGER.error(
            "Failed to assign user to partner group",
            user=instance.username,
            group_name=group_name,
            error=str(exc),
        )
