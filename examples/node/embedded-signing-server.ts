/**
 * Full embedded signing flow — Express server that:
 * 1. Creates an embed-mode agreement
 * 2. Issues a browser session token
 * 3. Serves a page where the user signs in-place
 *
 * Usage:
 *   PAPRE_API_KEY=papre_test_sk_... npx tsx embedded-signing-server.ts
 */
import express from 'express';
import { PapreClient } from '@papre-app/sdk';

const app = express();
app.use(express.json());

const papre = new PapreClient({
  apiKey: process.env.PAPRE_API_KEY!,
});

// Step 1: Create an embed-mode agreement and return the signing page data
app.post('/api/prepare-signing', async (req, res) => {
  const { signer_email, signer_name } = req.body;

  // Create agreement with embed_mode: true (no email sent)
  const agreement = await papre.agreements.create({
    template_id: 'tmpl_adult_waiver',
    signer_email,
    signer_name,
    merge_fields: {
      participant_name: signer_name,
      event_name: 'Annual Company Retreat',
      event_date: '2026-04-15',
    },
    embed_mode: true,
  });

  // Issue a short-lived browser session token
  const session = await papre.embedded.createBrowserSession({
    scope: 'agreements:sign',
    agreement_id: agreement.agreement_id,
    ttl: 1800, // 30 minutes
  });

  // Send both to the frontend
  res.json({
    agreement_id: agreement.agreement_id,
    browser_session_token: session.browser_session_token,
  });
});

// Step 2: Serve a minimal signing page
app.get('/sign', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Sign Agreement</title></head>
    <body>
      <h1>Sign Your Agreement</h1>
      <div id="document"></div>
      <label>
        <input type="checkbox" id="consent" />
        I have read and agree to the above
      </label>
      <br/>
      <button id="sign-btn" disabled>Sign Agreement</button>
      <div id="result"></div>

      <script>
        let signingIntent = null;
        let browserSessionToken = null;

        // 1. Prepare the signing session
        async function prepare() {
          const res = await fetch('/api/prepare-signing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signer_email: 'alice@example.com',
              signer_name: 'Alice Johnson',
            }),
          });
          const { agreement_id, browser_session_token } = await res.json();
          browserSessionToken = browser_session_token;

          // 2. Get the document to display
          const intentRes = await fetch('https://papre-api.vercel.app/api/v1/embed/signing-intent', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + browser_session_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ agreement_id }),
          });
          signingIntent = await intentRes.json();
          document.getElementById('document').innerText = signingIntent.filled_document;
        }

        // 3. Submit signature on consent
        document.getElementById('consent').addEventListener('change', (e) => {
          document.getElementById('sign-btn').disabled = !e.target.checked;
        });

        document.getElementById('sign-btn').addEventListener('click', async () => {
          const res = await fetch('https://papre-api.vercel.app/api/v1/embed/sign', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + browserSessionToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agreement_id: signingIntent.agreement_id,
              intent_token: signingIntent.intent_token,
              document_hash: signingIntent.document_hash,
              consent_given: true,
              signer_user_agent: navigator.userAgent,
            }),
          });
          const result = await res.json();
          document.getElementById('result').innerText =
            'Signed at ' + result.signed_at + ' — TX: ' + result.blockchain_tx;
        });

        prepare();
      </script>
    </body>
    </html>
  `);
});

app.listen(4000, () => {
  console.log('Embedded signing server at http://localhost:4000/sign');
});
