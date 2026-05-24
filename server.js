/**
 * Express Notify - Serveur Node.js
 * Sert les fichiers statiques ET gère l'envoi FCM via service account
 * 
 * Usage:
 *   npm install express google-auth-library node-fetch
 *   node server.js
 */

const express = require('express');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ============================================================
// Service Account Firebase
// ============================================================
const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "livraison-c8498",
  "private_key_id": "f2ceaf58b797f5a52cc229d652f0e9393f0e7fc2",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDRD26i7sj62cLx\nyRsz7aZQ5PQYSXy0uln8xA2h10BLW6gauLJpWy+lQXMMigk2AKMprSB9z5zWvY/J\nv5rGQZqjT2vDsLBHzyFLzE7Wycjbplnok7ArM8TMy8CSRnjuP5/GOeShkAGvXrjT\nPunp9Twoh34ByLcXKj+DpFuvd826FTsYyXXzzuEv8MTmQjpx4XcoLJK25VxJ6PFg\naACWKrAQWAf/cbK4AGM962Ij5sq8qOc2gviAxjQMXYVnh1tGSVSXC5ILGM3oZ+l7\n8EJosmvkqt1cgX3KZI8tYzfqawwH9HcbjMn06/yCfsy8wft50JBgiII277zRQbrM\nBacNEo1LAgMBAAECggEAD7ZOtN0oar4CCkT4j+sNBGhotgiT4EtfJwGfGqpAUUmW\ntUdrVUK+rndgS7F2JsJegOvblMkNOxBtJZcKbVsR4bM+4Kq/XO5CzN0Skc8BkwyK\nFlI/O8f8wv2PQA8e2J0ch3vjZIcbsU/3qRzB3M0LE+q2/DBXHl0U//JS17mz0wfR\nqPSh/6GMl3F3UF2AQdWy8xKeyCY4iZZjFHqMtpq5JE9/s3oBO93LXbBjii/BcM5i\nvJ3YmlEw2AEnUHb2J1hhk2NSKsoUDXfCFGvNNrky2Fb6WHSB7c+pEMVSCFCKTMMi\nwD1AEaOpXXhQB8cs6IXWn3aWCqwdQTizWjSs92aYwQKBgQDvr5RCyzOrgET1heUI\noE1cytdrwmNyx8vfLPvMnvQnAEx0UbV19q0NpvKPJGaV7Ml/q01IxngYoy0r3E3F\nGf5DnPJNO7ve6+hZHjqY0tONnSPRGO/l/niiyM5d3EdVz2p8Si9HDpA7RClBEg+a\nUc4RdstvtdB+XW9DLLxpUoa3iwKBgQDfSjdBVXvU4l6Cv7iB3iia6MAY2yTQ9dap\nvUCI1PcWe7qZoYlekjw4OZzX9Sskv6pqEH5pyaX2IpTuAKw8bFmSP9Pn87TUm14x\noiPeABW5RYkkq16Iu8C9NCWwUBC1jjI4Y1Xa5fTlsluZv0SZkHCEnVNHMWlCYpGm\nvexujgA5QQKBgQClSySn25LKly73U1tb05EGiSx+uBP1OCw0wMT1nDksHFydaywF\nKhS18YgdhzDn++AKF4y4v4ZbF00zjj5jy0U6Q6Yl9Sfe2DnoG5y1f889Pj1RGi13\nI0L2oB0RRbQ8TUpWZKKuEjENbjg1E8uG1RuTl6U8aNpcCvuMC/HzgGI/eQKBgQCq\nLUoHhTsneI9HXw8kC0kvJwyg5QQeLf84xoAUyRq4C/yfcjnb1eAHigE7piMHkvwy\ncfemcIUIHjsbWW/rbTim+fZq5ZaAIxmbAlQLskzcM17ej60w0MeIa+H9ikfx1zn3\nN94LQw9usIyXlOqXjznyGGWL8OCkM7OGPWGgsKEDAQKBgQCadaZ3ATmVoZ7kRU0D\n7i9hPVgq4AM7GGjFPizo97omKTOH9GIpsP6cj9Ax6oL2HcmQNpBYr0HiBnC/YPLG\n+CbjRTop3P8r/zR249VdEwg0DuMS74LWNw3ObZ+0wQetHyAOm/ysSbEfis/pvfUD\nUuZdxunrjlmY15CIRo9127UqvA==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@livraison-c8498.iam.gserviceaccount.com",
  "client_id": "114335306450823773837",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40livraison-c8498.iam.gserviceaccount.com"
};

const PROJECT_ID = SERVICE_ACCOUNT.project_id;
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

// ============================================================
// Get OAuth2 Token from Service Account
// ============================================================
async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging']
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

// ============================================================
// Send a single FCM notification
// ============================================================
async function sendFCMMessage(token, title, body, url, accessToken) {
  const message = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body
      },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: '/u.jpg',
          badge: '/u.jpg',
          requireInteraction: false,
          vibrate: [200, 100, 200]
        },
        fcm_options: {
          link: url || '/'
        }
      },
      android: {
        notification: {
          title: title,
          body: body,
          icon: 'ic_launcher',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default'
          }
        }
      },
      data: {
        title: title,
        body: body,
        url: url || '/',
        timestamp: Date.now().toString()
      }
    }
  };

  const response = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });

  const result = await response.json();
  return { ok: response.ok, result };
}

// ============================================================
// POST /send-notification
// ============================================================
app.post('/send-notification', async (req, res) => {
  const { tokens, title, body, url } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: 'tokens array requis' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'title et body requis' });
  }

  try {
    const accessToken = await getAccessToken();
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    // Send to all tokens (in parallel, with batching for large lists)
    const batchSize = 20;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const promises = batch.map(token => sendFCMMessage(token, title, body, url, accessToken));
      const results = await Promise.allSettled(promises);

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value.ok) {
          successCount++;
        } else {
          failureCount++;
          errors.push({
            token: batch[idx].substring(0, 20) + '...',
            error: r.value?.result?.error?.message || r.reason?.message || 'unknown'
          });
        }
      });
    }

    console.log(`[FCM] Sent: ${successCount} success, ${failureCount} failed`);

    res.json({
      success: true,
      successCount,
      failureCount,
      total: tokens.length,
      errors: errors.slice(0, 5) // return first 5 errors max
    });

  } catch (err) {
    console.error('[FCM Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🔔 Express Notify Server démarré`);
  console.log(`   ✅ http://localhost:${PORT}          → Page d'inscription`);
  console.log(`   ✅ http://localhost:${PORT}/notify.html → Tableau de bord\n`);
});