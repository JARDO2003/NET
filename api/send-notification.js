const crypto = require('crypto');

// ─── CONFIG ───────────────────────────────────────────────
const PROJECT_ID   = "livraison-c8498";
const CLIENT_EMAIL = "firebase-adminsdk-fbsvc@livraison-c8498.iam.gserviceaccount.com";
const FCM_URL      = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;
const TOKEN_URL    = "https://oauth2.googleapis.com/token";
const SCOPE        = "https://www.googleapis.com/auth/firebase.messaging";

// ─── RÉCUPÈRE LA CLÉ DEPUIS L'ENV ─────────────────────────
function getPrivateKey() {
  let key = process.env.FIREBASE_PRIVATE_KEY || "";
  // Vercel stocke parfois avec des \n littéraux, parfois avec de vrais retours
  key = key.replace(/\\n/g, "\n");
  // Nettoyage des espaces parasites en début/fin
  key = key.trim();
  return key;
}

// ─── BASE64URL ─────────────────────────────────────────────
function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input));
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// ─── CRÉE UN JWT SIGNÉ ─────────────────────────────────────
function createJWT(privateKey) {
  const now  = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: CLIENT_EMAIL,
    sub: CLIENT_EMAIL,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: SCOPE,
  };

  const headerB64  = base64url(header);
  const payloadB64 = base64url(payload);
  const signing    = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signing);
  sign.end();
  const sig = sign.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signing}.${sig}`;
}

// ─── OBTIENT LE TOKEN OAUTH2 ────────────────────────────────
async function getAccessToken() {
  const privateKey = getPrivateKey();
  if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error(`Clé privée invalide. Valeur reçue: "${privateKey.substring(0,40)}..."`);
  }

  const jwt = createJWT(privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion:  jwt,
  });

  const res  = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth2 échoué: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ─── ENVOIE UN MESSAGE FCM ──────────────────────────────────
async function sendFCMMessage(token, title, body, url, accessToken) {
  const message = {
    message: {
      token,
      notification: { title, body },
      webpush: {
        notification: {
          title, body,
          icon:  '/u.jpg',
          badge: '/u.jpg',
          requireInteraction: false,
          vibrate: [200, 100, 200],
        },
        fcm_options: { link: url || '/' },
      },
      android: {
        notification: { title, body, sound: 'default' },
      },
      apns: {
        payload: { aps: { alert: { title, body }, sound: 'default' } },
      },
      data: {
        title,
        body,
        url: url || '/',
        timestamp: Date.now().toString(),
      },
    },
  };

  const res = await fetch(FCM_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(message),
  });

  const result = await res.json();
  return { ok: res.ok, result };
}

// ─── HANDLER VERCEL ────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { tokens, title, body, url } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0)
    return res.status(400).json({ error: 'tokens[] requis' });
  if (!title || !body)
    return res.status(400).json({ error: 'title et body requis' });

  try {
    const accessToken = await getAccessToken();
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    const batchSize = 20;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch   = tokens.slice(i, i + batchSize);
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
            error: r.value?.result?.error?.message || r.reason?.message || 'unknown',
          });
        }
      });
    }

    return res.status(200).json({
      success: true,
      successCount,
      failureCount,
      total:  tokens.length,
      errors: errors.slice(0, 5),
    });

  } catch (err) {
    console.error('[FCM Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
