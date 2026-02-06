#!/usr/bin/env python3
"""Seed Firestore with initial client and user mapping.

Usage:
    python scripts/seed_firestore_client.py --client-name "Demo Client" --brand "Hendricks.AI" --admin-email admin@example.com
"""

import argparse
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import auth, firestore


def main():
    parser = argparse.ArgumentParser(description="Seed Firestore client data")
    parser.add_argument("--client-name", required=True, help="Client organization name")
    parser.add_argument("--brand", required=True, action="append", help="Brand(s) to map (repeatable)")
    parser.add_argument("--admin-email", help="Email of the admin user to link")
    parser.add_argument("--client-id", help="Custom client ID (auto-generated if omitted)")
    args = parser.parse_args()

    # Initialize Firebase
    if not firebase_admin._apps:
        firebase_admin.initialize_app()

    db = firestore.client()
    now = datetime.now(timezone.utc)

    # Create client document
    if args.client_id:
        client_ref = db.collection("clients").document(args.client_id)
    else:
        client_ref = db.collection("clients").document()

    client_id = client_ref.id
    client_ref.set({
        "name": args.client_name,
        "status": "active",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "subscription_status": None,
        "brands": args.brand,
        "created_at": now,
    })
    print(f"Created client: {args.client_name} (id={client_id})")

    # Link admin user if specified
    if args.admin_email:
        try:
            user = auth.get_user_by_email(args.admin_email)
            uid = user.uid

            # Create user doc
            db.collection("users").document(uid).set({
                "email": args.admin_email,
                "display_name": user.display_name or "",
                "client_id": client_id,
                "role": "client_admin",
                "created_at": now,
            })

            # Add as client member
            client_ref.collection("members").document(uid).set({
                "email": args.admin_email,
                "role": "admin",
                "added_at": now,
            })

            # Set Firebase custom claims
            auth.set_custom_user_claims(uid, {
                "client_id": client_id,
                "role": "client_admin",
            })

            print(f"Linked user {args.admin_email} (uid={uid}) as admin of {args.client_name}")
        except auth.UserNotFoundError:
            print(f"Warning: No Firebase user found with email {args.admin_email}")
            print("Create the user first, then re-run this script.")

    print(f"\nClient ID: {client_id}")
    print(f"Brands: {args.brand}")
    print("\nNext steps:")
    print(f"  1. Insert into BigQuery client_brands table:")
    print(f"     INSERT INTO knewsearch_aeo.client_brands (client_id, brand, is_active, added_at)")
    for b in args.brand:
        print(f"     VALUES ('{client_id}', '{b}', TRUE, CURRENT_TIMESTAMP());")


if __name__ == "__main__":
    main()
