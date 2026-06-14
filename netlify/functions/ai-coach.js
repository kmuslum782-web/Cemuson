exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Only POST allowed"
        })
      };
    }

    const allowedOrigins = [
      "https://spiffy-truffle-1de736.netlify.app"
    ];

    const origin = event.headers.origin || event.headers.Origin || "";

    if (origin && !allowedOrigins.includes(origin)) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Origin not allowed"
        })
      };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "OPENROUTER_API_KEY missing"
        })
      };
    }

    let body = {};

    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Invalid JSON body"
        })
      };
    }

    const mode = body.mode || "month";
    const question = String(body.question || "").slice(0, 500);
    const summary = body.summary || {};

    const systemPrompt = `
Sen FinAsist uygulamasının Türkçe kişisel para koçusun.

Çok önemli kurallar:
- Sadece sana gönderilen finans verilerine göre konuş.
- Sana gönderilmeyen hiçbir rakamı uydurma.
- Aylık gelir, harcama, kira, fatura, borç, kalan para gibi değerleri yalnızca summary içinde varsa kullan.
- Veri eksikse "Bu veri girilmemiş" de.
- Kullanıcının gerçek verisi yoksa tahmini rakam üretme.
- "Muhtemelen", "yaklaşık" diyerek uydurma hesap yapma.
- Motivasyon yazısı yazma.
- "Merhaba ben FinAsist" gibi tanıtım yapma.
- Cevap kısa, net ve uygulanabilir olsun.
- 4-6 kısa madde halinde cevap ver.
- Mutlaka TL değerlerini kullan ama sadece gelen verilerden kullan.
- Risk varsa açık söyle.
- Kullanıcıyı korkutma ama fazla rahatlatma da.
- Yatırım tavsiyesi verme.
- Cevap Türkçe olsun.
`;

    let userPrompt = "";

    if (mode === "can_i_buy") {
      userPrompt = `
Kullanıcı bir harcama yapmak istiyor.

Kullanıcının sorusu:
${question}

Kullanıcının gerçek finans verileri:
${JSON.stringify(summary, null, 2)}

Görev:
Bu harcamanın kullanıcının mevcut bütçesine göre uygun olup olmadığını yorumla.

Cevap formatı:
1. Karar: Alabilir / Ertele / Riskli.
2. Neden: Günlük güvenli limit, bugün harcama, ay kalan para ve bekleyen sabit ödemelere göre açıkla.
3. Bekleyen ödeme varsa özellikle belirt. Örneğin kira, fatura, borç.
4. Bu harcama sonrası bugün ne kadar güvenli alan kalacağını söyle.
5. Veri eksikse açıkça "bu veri girilmemiş" de.

Kesin yasak:
- Summary içinde olmayan rakamı uydurma.
- Kullanıcının aylık geliri yoksa gelir varmış gibi konuşma.
- Bekleyen fatura yoksa varmış gibi söyleme.
`;
    } else if (mode === "saving_plan") {
      userPrompt = `
Kullanıcı tasarruf planı istiyor.

Kullanıcının gerçek finans verileri:
${JSON.stringify(summary, null, 2)}

Cevap formatı:
1. Bu ayın genel durumu: Rahat / Dikkat / Riskli.
2. En çok dikkat edilmesi gereken 2 alanı söyle.
3. Bekleyen sabit ödeme varsa önce onları belirt.
4. Bu hafta uygulanacak 3 net tasarruf adımı ver.
5. Günlük harcama sınırı ne olmalı, söyle.

Kesin yasak:
- Summary içinde olmayan rakamı uydurma.
- Harcama kategorisi yoksa kategori varmış gibi konuşma.
- Genel finans tavsiyesi verme; sadece bu kullanıcının verisine göre konuş.
`;
    } else {
      userPrompt = `
Kullanıcının bu ayını yorumla.

Kullanıcının gerçek finans verileri:
${JSON.stringify(summary, null, 2)}

Cevap formatı:
1. Bu ayın durumu: Rahat / Dikkat / Riskli.
2. Aylık gelir, birikim hedefi, sabit ödemeler ve kalan bütçeyi yorumla.
3. Bu ay şu ana kadar kaç TL harcadığını söyle.
4. Bekleyen sabit ödeme varsa isim ve tutarla belirt.
5. Bugünkü güvenli limit ile bugünkü harcamayı karşılaştır.
6. Ay sonuna kadar 2 net öneri ver.

Kesin yasak:
- Veri yoksa rakam uydurma.
- Genel motivasyon yazısı yazma.
- "Merhaba ben FinAsist" diye başlama.
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
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 600
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json"
        },
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: error.message || "Server error"
      })
    };
  }
};
