"""
Flask webhook handler with HMAC-SHA256 verification.

Usage:
    pip install flask
    PAPRE_WEBHOOK_SECRET=whsec_... python webhook_handler.py
"""
import hashlib
import hmac
import os
import json
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ["PAPRE_WEBHOOK_SECRET"]


def verify_signature(payload: str, signature: str, secret: str) -> bool:
    """Verify the HMAC-SHA256 signature from the X-Papre-Signature header."""
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.route("/webhooks/papre", methods=["POST"])
def handle_webhook():
    payload = request.get_data(as_text=True)
    signature = request.headers.get("X-Papre-Signature", "")

    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    event = json.loads(payload)
    event_type = event["event_type"]

    if event_type == "agreement.signed":
        print(f"Agreement {event['agreement_id']} signed by {event['signer_name']}")
        print(f"Blockchain TX: {event.get('blockchain_tx')}")
    elif event_type == "agreement.viewed":
        print(f"Agreement {event['agreement_id']} viewed")
    elif event_type == "agreement.expired":
        print(f"Agreement {event['agreement_id']} expired")
    elif event_type == "agreement.declined":
        print(f"Agreement {event['agreement_id']} declined")
    elif event_type == "agreement.cancelled":
        print(f"Agreement {event['agreement_id']} cancelled")
    else:
        print(f"Unknown event: {event_type}")

    return jsonify({"received": True}), 200


if __name__ == "__main__":
    app.run(port=3000)
