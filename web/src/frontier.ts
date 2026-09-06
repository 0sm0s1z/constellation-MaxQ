/** OpenSecurity research note — published as a first-class MaxQ page. Source: SEFR/ARTICLE.md (2026-08-18). */

const fig = (src: string, alt: string, cap: string, w: number, h: number) => `
  <figure class="shot">
    <img src="${src}" alt="${alt}" width="${w}" height="${h}" />
    <figcaption>${cap}</figcaption>
  </figure>`;

export function renderFrontier(): string {
  return `
    <article class="article">
      <p class="eyebrow">OpenSecurity Research · 18 Aug 2026</p>
      <h1>The best AI subscription isn’t the best AI model.</h1>
      <p class="lede">We reverse-engineered the compute hidden inside the biggest frontier-AI subscriptions. The lowest subscription price per unit of API-list-equivalent compute came from an unexpected place. Then actual developer behavior broke the spreadsheet.</p>
      <p class="byline">Benchmark snapshot, not purchasing advice. FIE = fresh-input-equivalent frontier compute.</p>

      ${fig("/research/frontier-400cap.webp", "Subscription Efficiency Frontier, five vendors, comparable-spend view around $400/month", "Figure 1. Comparable-spend view. Native plans plus one modeled 2× stack of the top tier. Higher and farther left is better on this inverted-x chart. Gold region: Heavy.", 1800, 900)}

      <h2 class="display">The quota is the product — and the quota is mostly hidden</h2>
      <p>I did not set out to build an AI-subscription benchmark. I set out to buy more Cursor. Ultra’s $400 Other Models pool was disappearing faster than the first-party Cursor Models pool. The obvious move was a second Ultra. Then I compared it with SuperGrok Heavy.</p>
      <p>The spreadsheet said Heavy: about <strong>4.622B</strong> monthly FIE tokens at $300, versus about <strong>4.245B</strong> for two $200 Ultras. Heavy was cheaper and, on the central estimate, offered more Grok compute. Two Ultras bought something Heavy did not: another $400 Other Models pool, another first-party Cursor pool, and the ability to spend that capacity inside the environment I was already using.</p>
      <p>The economic winner and the behavioral winner were not automatically the same product. That was the investigation.</p>
      <p>Frontier subscriptions are strange financial instruments. You pay a fixed monthly fee for expensive, variable-cost infrastructure. The vendor usually does not tell you how many tokens you bought. Cursor publishes a dollar-denominated Other Models allowance and calls the first-party pool “generous included usage.” xAI moved paid Grok products to one weekly, compute-weighted percentage pool. Anthropic sells Max as 5× or 20× Pro. Google’s meter depends on prompt complexity. OpenAI says Codex message counts vary with model, context, reasoning, and cache.</p>
      <p>The provocative version is “they don’t want you to know.” The defensible version is more useful: <strong>the observable product is opaque enough that a customer cannot infer capacity from the plan page.</strong> A subscription is perishable. Unused capacity expires. The best allowance is the largest amount of capacity you will actually consume on work you actually want to route to that model.</p>

      <h2 class="display">How we turned incomparable meters into one benchmark</h2>
      <p>We wanted frontier-class, high-reasoning models — not each vendor’s cheapest token generator. The normalized set:</p>
      <table class="cli"><thead><tr><th>family</th><th>model</th><th>fresh / cached / output per 1M</th></tr></thead><tbody>
        <tr><td>xAI / Cursor</td><td>Grok 4.6 · xhigh · Standard</td><td class="dim">$2.00 / $0.50 / $6.00</td></tr>
        <tr><td>Anthropic</td><td>Claude Opus 5 · xhigh · Standard</td><td class="dim">$5.00 / $0.50 / $25.00</td></tr>
        <tr><td>Google</td><td>Gemini 3.1 Pro Preview · High</td><td class="dim">$2.00 / $0.20 / $12.00</td></tr>
        <tr><td>OpenAI</td><td>GPT-5.6 Sol · xhigh · Standard</td><td class="dim">$5.00 / $0.50 / $30.00</td></tr>
        <tr><td>Z.AI</td><td>GLM-5.3 · max · Standard</td><td class="dim">$1.40 / $0.26 / $4.40</td></tr>
      </tbody></table>
      <p>Raw tokens fail because agentic coding reuses enormous contexts. One measured SuperGrok workload was about 95.85% cached input. We convert the mix into retail API-list-equivalent value, then divide by that model’s fresh-input price. The unit is input-token-shaped. It is not a transcript token count, not quality-adjusted, and not serving cost.</p>

      <h2 class="display">The decision that started it: Heavy or a second Ultra?</h2>
      <table class="cli"><thead><tr><th>choice</th><th>$/mo</th><th>monthly FIE</th><th>$ / 1M FIE</th></tr></thead><tbody>
        <tr><td>Cursor Ultra</td><td class="dim">200</td><td class="dim">2.122B</td><td class="dim">0.094</td></tr>
        <tr><td>SuperGrok Heavy</td><td class="dim">300</td><td class="dim">4.622B</td><td><strong>$0.065</strong></td></tr>
        <tr><td>2× Cursor Ultra <em>(modeled)</em></td><td class="dim">400</td><td class="dim">4.245B</td><td class="dim">0.094</td></tr>
      </tbody></table>
      <p>On the central FIE estimate, Heavy supplies about 8.9% more FIE for 25% less money. Current official pages do <em>not</em> support the wording that Heavy includes Cursor Ultra. xAI lists Heavy at $300 and Cursor Ultra at $200 as separate products. Their quotas are not documented as one pool.</p>
      <p>If you would voluntarily choose Opus or Sol for half your serious tasks, Heavy’s unused Grok capacity expires worthless. If you would happily route almost everything to Grok, buying expensive third-party optionality is waste. <strong>The spreadsheet says Grok; the developer may say Opus.</strong></p>

      ${fig("/research/fig-1.svg", "Subscription Efficiency Frontier — comparable spend, log capacity vs tokens per dollar", "Figure 1 (vector). Native plans filled; open points are linear stacks, not sold SKUs. The gold region is an editorial threshold, not a fitted statistical frontier.", 1200, 720)}

      <h2 class="display">What does Heavy-scale capacity cost elsewhere?</h2>
      ${fig("/research/frontier-capacity.webp", "Subscription Efficiency Frontier, capacity-match view against Heavy’s 4.622B FIE", "Figure 2. Capacity-match view. Dotted line: Heavy’s 4.622B central FIE. Open points are modeled 4×/8× stacks.", 1800, 900)}
      <table class="cli"><thead><tr><th>path</th><th>$/mo</th><th>FIE</th></tr></thead><tbody>
        <tr><td>SuperGrok Heavy</td><td class="dim">300</td><td>4.622B</td></tr>
        <tr><td>Z.AI 4× Max <em>(modeled)</em></td><td class="dim">640</td><td class="dim">5.316B</td></tr>
        <tr><td>Google 4× Ultra 20× <em>(modeled)</em></td><td class="dim">800</td><td class="dim">2.860B</td></tr>
        <tr><td>Anthropic 8× Max 20× <em>(modeled)</em></td><td class="dim">1,600</td><td class="dim">4.403B</td></tr>
        <tr><td>OpenAI 8× Pro 20× <em>(modeled)</em></td><td class="dim">1,600</td><td class="dim">4.718B</td></tr>
      </tbody></table>
      <p>“Would cost” matters. Eight consumer accounts are not an elegant purchasing strategy. These points isolate the price curve. They do not promise stacking works operationally.</p>

      <h2 class="display">Z.AI is the real second story</h2>
      <p>Remove the distrusted outlier series and the benchmark stops being “xAI wins, everyone else loses.” Z.AI publishes weekly credits, GLM-5.3 multipliers, a 90.9% coding cache-hit assumption, and a defined peak window. Native Z.AI points receive medium–high confidence rather than the lower confidence applied to unpublished xAI, Cursor, Claude, Google, and OpenAI absolute limits.</p>
      <p>Four Z.AI Max subscriptions enter the gold region at a modeled $640 / 5.316B FIE. That is a compelling second subscription-economics story. It is not Heavy’s unit economics: Z.AI remains near $0.120 per million FIE, about 1.85× Heavy’s $0.065.</p>

      ${fig("/research/fig-3.svg", "Absolute scale map: monthly FIE capacity vs monthly spend", "Figure 3. Absolute scale. A ratio alone is dangerous: Google AI Plus looks efficient at $4.99 and its central capacity is 17.9M FIE.", 1200, 900)}

      <h2 class="display">Developer behavior broke the spreadsheet</h2>
      <p>The benchmark asks a narrow question: how much frontier compute does the subscription appear to contain at retail API-list equivalence? A developer buys a workflow. Realized value is included capacity × probability you choose that model × probability you consume it before reset × workflow fit.</p>
      <p>A plan with 5B estimated FIE can underperform a 500M plan if you avoid the model or cannot use its product surface. The subscription becomes a season pass. A season pass to the wrong mountain is not a bargain.</p>

      <h2 class="display">Is this sustainable? The chart cannot tell us</h2>
      <p>At Grok 4.6’s $2 per million standard fresh-input list price, Heavy’s central estimate converts to about <strong>$9,244 of API-list-equivalent compute</strong> — roughly 30.8× the $300 sticker. That is the defensible dramatic number. It is also easy to misuse. xAI is not necessarily spending $9,244 to serve the subscriber. Cached inference, spare capacity, batching, and internal hardware economics can all make marginal cost radically different from the retail API menu.</p>

      <h2 class="display">Buy the bottleneck, not the benchmark winner</h2>
      <p>On this benchmark’s central estimates, SuperGrok Heavy is the strongest native subscription for high-volume frontier compute. Z.AI is the most compelling second story. Two Cursor Ultras cost $100 more than Heavy and offer slightly less estimated Grok FIE; they also provide a second Other Models pool. That optionality is valuable only if it matches actual routing.</p>
      <ol class="steps">
        <li><span class="step-num">01</span><div><h3>Identify the bottleneck</h3><p>The model and product surface that currently blocks your work.</p></div></li>
        <li><span class="step-num">02</span><div><h3>Estimate consumption</h3><p>How much of each allowance you will actually use before reset.</p></div></li>
        <li><span class="step-num">03</span><div><h3>Compare the margin</h3><p>The next subscription against on-demand overflow.</p></div></li>
        <li><span class="step-num">04</span><div><h3>Re-run after the ground moves</h3><p>Model, quota, speed-tier, or pricing changes invalidate the last chart.</p></div></li>
      </ol>
      <p>The best AI subscription is not necessarily attached to the best AI model. It is attached to the model you will use, inside the workflow you will keep, at a quota you can exhaust, for a price below your next-best source of capacity.</p>
      <p>That is a harder question than “which model is best?” It is also the one that sends the bill.</p>

      <p class="byline">Prices and official-product verification: 2026-08-18. Filled chart points are retail plans. Open points are linear 2×/4×/8× stacks, not SKUs. No claim that FIE equals transcript tokens, quality-adjusted work, serving cost, or vendor subsidy. Vendors can change prices, models, multipliers, and enforcement without preserving historical comparability.</p>
      <p><a class="btn-ghost" href="#router">Constellation Router</a> <a class="btn-ghost" href="#home">Back to MaxQ</a></p>
    </article>`;
}
