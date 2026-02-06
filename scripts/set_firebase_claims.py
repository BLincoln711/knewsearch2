#!/usr/bin/env python3
"""Set Firebase custom claims for a user.

Usage:
    # Set superadmin role
    python scripts/set_firebase_claims.py --uid USER_UID --role superadmin

    # Set client member role
    python scripts/set_firebase_claims.py --uid USER_UID --role client_member --client-id CLIENT_ID

    # Set by email instead of UID
    python scripts/set_firebase_claims.py --email user@example.com --role superadmin
"""

import argparse
import sys

import firebase_admin
from firebase_admin import auth, credentials


def main():
    parser = argparse.ArgumentParser(description="Set Firebase custom claims")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--uid", help="Firebase user UID")
    group.add_argument("--email", help="User email (will look up UID)")
    parser.add_argument(
        "--role",
        required=True,
        choices=["superadmin", "client_admin", "client_member"],
        help="Role to assign",
    )
    parser.add_argument("--client-id", help="Client ID (required for client roles)")
    parser.add_argument("--project", default="knewsearch-prod", help="GCP project ID")
    args = parser.parse_args()

    if args.role in ("client_admin", "client_member") and not args.client_id:
        parser.error("--client-id is required for client roles")

    # Initialize Firebase Admin
    if not firebase_admin._apps:
        firebase_admin.initialize_app()

    # Resolve UID
    uid = args.uid
    if args.email:
        try:
            user = auth.get_user_by_email(args.email)
            uid = user.uid
            print(f"Found user: {user.email} (uid={uid})")
        except auth.UserNotFoundError:
            print(f"Error: No user found with email {args.email}", file=sys.stderr)
            sys.exit(1)

    # Build claims
    claims = {"role": args.role}
    if args.client_id:
        claims["client_id"] = args.client_id

    # Set claims
    auth.set_custom_user_claims(uid, claims)
    print(f"Set custom claims for uid={uid}: {claims}")

    # Verify
    user = auth.get_user(uid)
    print(f"Verified claims: {user.custom_claims}")


if __name__ == "__main__":
    main()
