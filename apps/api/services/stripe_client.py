import os
from typing import Dict, Optional

import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Credit package definitions
PACKAGES = {
    "starter": {"name": "Starter Pack", "credits": 500, "price_cents": 500},
    "standard": {"name": "Standard Pack", "credits": 2200, "price_cents": 2000},
    "power": {"name": "Power Pack", "credits": 6000, "price_cents": 5000},
    "pro": {"name": "Pro Pack", "credits": 13000, "price_cents": 10000},
}

# Cached mapping of package_id -> stripe_price_id
_price_cache: Optional[Dict[str, str]] = None


def ensure_stripe_products() -> dict[str, str]:
    """Return a mapping of package_id to Stripe price_id.

    Searches for existing products by metadata; creates them if they don't
    exist. The result is cached for the lifetime of the process.
    """
    global _price_cache
    if _price_cache is not None:
        return _price_cache

    price_map: dict[str, str] = {}

    for package_id, pkg in PACKAGES.items():
        # Search for an existing product with matching metadata
        existing_products = stripe.Product.search(
            query=f"metadata['burnchat_package_id']:'{package_id}'",
        )

        if existing_products.data:
            product = existing_products.data[0]
            # Fetch the active price for this product
            prices = stripe.Price.list(product=product.id, active=True, limit=1)
            if prices.data:
                price_map[package_id] = prices.data[0].id
                continue

        # Product doesn't exist or has no active price -- create both
        product = stripe.Product.create(
            name=f"BurnChat {pkg['name']}",
            description=f"{pkg['credits']} credits for BurnChat",
            metadata={"burnchat_package_id": package_id},
        )

        price = stripe.Price.create(
            product=product.id,
            unit_amount=pkg["price_cents"],
            currency="usd",
            metadata={"burnchat_package_id": package_id},
        )

        price_map[package_id] = price.id

    _price_cache = price_map
    return _price_cache


def create_checkout_session(
    price_id: str,
    user_id: str,
    credits_amount: int,
    package_id: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout session and return its URL."""
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        metadata={
            "user_id": user_id,
            "credits_amount": str(credits_amount),
            "package_id": package_id,
        },
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return session.url


def verify_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify a Stripe webhook signature and return the parsed event."""
    event = stripe.Webhook.construct_event(
        payload,
        sig_header,
        STRIPE_WEBHOOK_SECRET,
    )
    return event
