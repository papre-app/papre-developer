"""
Embedded signing flow — server-side preparation.

This script demonstrates the server-side steps:
1. Create an embed-mode agreement (no email sent)
2. Issue a browser session token
3. Print the token for your frontend to use

Usage:
    PAPRE_API_KEY=papre_test_sk_... python embedded_signing.py
"""
import os
import requests

API_KEY = os.environ["PAPRE_API_KEY"]
BASE_URL = "https://papre-api.vercel.app/api"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def main():
    # Step 1: Create agreement with embed_mode (no signing email sent)
    res = requests.post(
        f"{BASE_URL}/v1/agreements",
        headers=HEADERS,
        json={
            "template_id": "tmpl_adult_waiver",
            "signer_email": "alice@example.com",
            "signer_name": "Alice Johnson",
            "merge_fields": {
                "participant_name": "Alice Johnson",
                "event_name": "Annual Company Retreat",
                "event_date": "2026-04-15",
            },
            "embed_mode": True,
        },
    )
    res.raise_for_status()
    agreement = res.json()
    print(f"Agreement created: {agreement['agreement_id']}")
    print(f"embed_mode: {agreement['embed_mode']}")
    print(f"signing_url: {agreement['signing_url']}")  # null for embed mode

    # Step 2: Issue a browser session token (30-minute TTL)
    res = requests.post(
        f"{BASE_URL}/v1/auth/browser-session",
        headers=HEADERS,
        json={
            "scope": "agreements:sign",
            "agreement_id": agreement["agreement_id"],
            "ttl": 1800,
        },
    )
    res.raise_for_status()
    session = res.json()
    print(f"\nBrowser session token: {session['browser_session_token']}")
    print(f"Expires at: {session['expires_at']}")
    print(f"\nPass this token to your frontend JavaScript.")
    print(f"See docs/embedded-signing.md for the frontend steps.")


if __name__ == "__main__":
    main()
