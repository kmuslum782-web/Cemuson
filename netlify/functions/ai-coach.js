 exports.handler = async function(event) {
try {
if (event.httpMethod !== "POST") {
return {
statusCode: 405,
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ error: "Only POST allowed" })
};
}

const allowedOrigins = [
  "https://spiffy-truffle-1de736.netlify.app"
];

const origin = event.headers.origin || event.headers.Origin || "";

if (origin && !allowedOrigins.includes(origin)) {
  return {
    statusCode: 403,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Origin not allowed" })
  };
}

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "OPENROUTER_API_KEY missing" })
  };
}

let body = {};
try {
  body = JSON.parse(event.body || "{}");
} catch (e) {
  return {
    statusCode: 400,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Invalid JSON body" })
  };
}

const mode = body.mode || "month";
const question = String(body.question || "").slice(0, 500);
const summary = body.summary || {};

const systemPrompt = `

Sen FinAsist uygulamasının Türkçe para koçusun.
Yatırım tavsiyesi verme.
Kullanıcının gelir, sabit ödeme ve günlük harcama verilerine göre ay sonuna kadar parasını yetirmesine yardım et.
Kısa, net ve uygulanabilir konuş.
Cevapların 5-8 kısa cümleyi geçmesin.
Gereksiz uzun rapor yazma.
Risk varsa açık söyle ama kullanıcıyı korkutma.
`;

let userPrompt = "";

if (mode === "can_i_buy") {
  userPrompt = `

Kullanıcı "Bunu alabilir miyim?" soruyor.

Kullanıcının sorusu:
${question}

Finans özeti:
${JSON.stringify(summary, null, 2)}

Cevap formatı:

- Alabilir / Ertele / Riskli diye net söyle.
- Günlük limit ve ay kalan para açısından yorumla.
- Zorunlu değilse kaç gün ertelemesinin daha güvenli olduğunu söyle.
  "; } else if (mode === "saving_plan") { userPrompt = "
  Kullanıcı tasarruf planı istiyor.

Finans özeti:
${JSON.stringify(summary, null, 2)}

Cevap formatı:

- En riskli 2 alanı söyle.
- Bu hafta yapılabilecek 3 somut tasarruf önerisi ver.
- Günlük hedefi nasıl koruyacağını açıkla.
  "; } else { userPrompt = "
  Kullanıcının bu ayını yorumla.

Finans özeti:
${JSON.stringify(summary, null, 2)}

Cevap formatı:

- Bu ay durum iyi mi riskli mi söyle.

- Günlük hedefi yorumla.

- Ödenmeyen sabit ödemeler varsa uyar.

- Ay sonuna kadar neye dikkat etmeli söyle.
  `;
  }
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
  "Authorization": "Bearer " + apiKey,
  "Content-Type": "application/json",
  "HTTP-Referer": "https://spiffy-truffle-1de736.netlify.app",
  "X-Title": "FinAsist"
  },
  body: JSON.stringify({
  model: "google/gemini-2.5-flash",
  messages: [
  { role: "system", content: systemPrompt },
  { role: "user", content: userPrompt }
  ],
  temperature: 0.4,
  max_tokens: 500
  })
  });
  
  const result = await response.json();
  
  if (!response.ok) {
  return {
  statusCode: response.status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  error: result.error?.message || "AI request failed"
  })
  };
  }
  
  const text =
  result.choices &&
  result.choices[0] &&
  result.choices[0].message &&
  result.choices[0].message.content
  ? result.choices[0].message.content
  : "AI cevap üretemedi.";
  
  return {
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text })
  };
  
  } catch (error) {
  return {
  statusCode: 500,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: error.message || "Server error" })
  };
  }
  };
