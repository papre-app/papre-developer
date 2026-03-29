"""
Create an agreement from a template and send it for signing.

Usage:
    PAPRE_API_KEY=papre_test_sk_... python create_agreement.py
"""
import os
import requests

API_KEY = os.environ["PAPRE_API_KEY"]
BASE_URL = "https://papre-api.vercel.app/api"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}


def main():
    # 1. List available templates
    res = requests.get(f"{BASE_URL}/v1/templates", params={"type": "waiver"}, headers=HEADERS)
    res.raise_for_status()
    templates = res.json()["data"]
    print(f"Found {len(templates)} waiver templates")

    template = templates[0]
    print(f"Using: {template['template_name']} ({template['template_id']})")

    # 2. Create an agreement
    res = requests.post(
        f"{BASE_URL}/v1/agreements",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={
            "template_id": template["template_id"],
            "signer_email": "alice@example.com",
            "signer_name": "Alice Johnson",
            "merge_fields": {
                "participant_name": "Alice Johnson",
                "event_name": "Annual Company Retreat",
                "event_date": "2026-04-15",
            },
            "external_reference": "participant_101",
        },
    )
    res.raise_for_status()
    agreement = res.json()

    print(f"Agreement created: {agreement['agreement_id']}")
    print(f"Status: {agreement['status']}")
    print(f"Signing URL: {agreement['signing_url']}")

    # 3. Check status
    res = requests.get(f"{BASE_URL}/v1/agreements/{agreement['agreement_id']}", headers=HEADERS)
    res.raise_for_status()
    print(f"Current status: {res.json()['status']}")


if __name__ == "__main__":
    main()
