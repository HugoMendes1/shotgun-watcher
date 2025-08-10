import { chromium } from 'playwright';

// ====== CONFIG ======
const EVENT_URL = process.env.EVENT_URL || 'https://shotgun.live/en/events/summer-beach-party-xl-edition';
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1403894709201535111/BzjWimheAyC9KmG2tX_j0F-AFgGt2tKldEvLghm8098TFEKWPLttoF__EOkM72uUngil'; // obrigatório
const CHECK_EVERY_MS = Number(process.env.CHECK_EVERY_MS || 8000);
const TIERS = (process.env.TIERS || '').split(',').map(s => s.trim()).filter(Boolean);
// ====================

if (!DISCORD_WEBHOOK_URL) {
  console.error('Falta DISCORD_WEBHOOK_URL');
  process.exit(1);
}

function tierMatches(name) {
  if (!TIERS.length) return true;
  return TIERS.some(t => name.toLowerCase().includes(t.toLowerCase()));
}

async function notifyDiscord({ title, state }) {
  const content = `🔔 **${title}** ficou **DISPONÍVEL** ✅\n${EVENT_URL}`;
  // Embed simples (opcional)
  const payload = {
    username: 'Shotgun Watcher',
    embeds: [{
      title: 'Ticket disponível',
      description: `**${title}** está disponível.`,
      url: EVENT_URL,
      timestamp: new Date().toISOString()
    }],
    content
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('Falha no webhook:', res.status, txt);
    }
  } catch (e) {
    console.error('Erro ao enviar para Discord:', e.message);
  }
}

const lastState = new Map(); // title -> 'soldout' | 'available'

async function readTiers(page) {
  return await page.evaluate(() => {
    const results = [];
    const blocks = Array.from(document.querySelectorAll('section,div,article,li'));

    const norm = s => (s || '').replace(/\s+/g, ' ').trim();

    for (const el of blocks) {
      const txt = norm(el.innerText);
      if (!txt) continue;

      const price = /€\s?\d+[.,]?\d*/.test(txt);
      const hasTicketWord = /(release|ticket)/i.test(txt);
      if (!price && !hasTicketWord) continue;

      let title = '';
      const h = el.querySelector('h1,h2,h3,strong,b');
      if (h) title = norm(h.innerText);
      if (!title) title = norm(txt.split('\n').map(s => s.trim()).filter(Boolean)[0] || '');
      if (!title) continue;

      const hasSoldOut = /sold out/i.test(txt);
      const qtySelector = el.querySelector('button[aria-label*="increase"],button[aria-label*="+"]') ||
                          /[-+]\s*\d+\s*[-+]/.test(txt);
      const buyBtn = Array.from(el.querySelectorAll('button,a')).some(b => /buy|add|ticket|checkout/i.test((b.innerText||'')));

      const state = hasSoldOut ? 'soldout' : ((qtySelector || buyBtn) ? 'available' : 'unknown');
      if (state === 'unknown') continue;

      results.push({ title, state });
    }

    const map = new Map();
    for (const r of results) map.set(r.title, r.state);
    return Array.from(map, ([title, state]) => ({ title, state }));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
  });

  await page.goto(EVENT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('A vigiar:', EVENT_URL);

  while (true) {
    try {
      await page.goto(EVENT_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const tiers = await readTiers(page);

      for (const t of tiers) {
        if (!tierMatches(t.title)) continue;

        const prev = lastState.get(t.title) || 'unknown';
        if (prev !== t.state) {
          lastState.set(t.title, t.state);

          if (prev !== 'unknown' && t.state === 'available') {
            await notifyDiscord(t);
          } else {
            console.log(`Estado: ${t.title} = ${t.state}`);
          }
        }
      }
    } catch (e) {
      console.error('Erro no ciclo:', e.message);
    }
console.log(`[${new Date().toLocaleTimeString()}] Check feito, a aguardar ${CHECK_EVERY_MS/1000}s...`);
const jitter = Math.floor(Math.random() * 1500);
await new Promise(r => setTimeout(r, CHECK_EVERY_MS + jitter));
  }
})();
