const { GoogleAuth } = require('google-auth-library');

// La private_key vient de la variable d'environnement Vercel
// Les \n littéraux sont remplacés par de vrais sauts de ligne
const PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "livraison-c8498",
  private_key_id: "f2ceaf58b797f5a52cc229d652f0e9393f0e7fc2",
  private_key: PRIVATE_KEY,
  client_email: "firebase-adminsdk-fbsvc@livraison-c8498.iam.gserviceaccount.com",
  client_id: "114335306450823773837",
  token_uri: "https://oauth2.googleapis.com/token",
};

const PROJECT_ID = "livraison-c8498";
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging']
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

async function sendFCMMessage(token, title, body, url, accessToken) {
  const message = {
    message: {
      token,
      notification: { title, body },
      webpush: {
        notification: {
          title, body,
          icon: '/u.jpg',
          badge: '/u.jpg',
          requireInteraction: false,
          vibrate: [200, 100, 200]
        },
        fcm_options: { link: url || '/' }
      },
      android: {
        notification: { title, body, sound: 'default' }
      },
      apns: {
        payload: { aps: { alert: { title, body }, sound: 'default' } }
      },
      data: {
        title,
        body,
        url: url || '/',
        timestamp: Date.now().toString()
      }
    }
  };

  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });

  const result = await res.json();
  return { ok: res.ok, result };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tokens, title, body, url } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0)
    return res.status(400).json({ error: 'tokens[] requis' });
  if (!title || !body)
    return res.status(400).json({ error: 'title et body requis' });
  if (!PRIVATE_KEY || PRIVATE_KEY.length < 100)
    return res.status(500).json({ error: 'Variable FIREBASE_PRIVATE_KEY manquante sur Vercel' });

  try {
    const accessToken = await getAccessToken();
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    const batchSize = 20;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(t => sendFCMMessage(t, title, body, url, accessToken))
      );
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

    return res.status(200).json({
      success: true,
      successCount,
      failureCount,
      total: tokens.length,
      errors: errors.slice(0, 5)
    });

  } catch (err) {
    console.error('[FCM Error]', err);
    return res.status(500).json({ error: err.message });
  }
};
