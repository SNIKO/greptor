import YAML from "yaml";
import { createGreptor } from "../src/index.js";
import { createLlmClient } from "../src/llm/llm-factory.js";
import { chunk } from "../src/processing/chunk.js";
import { extractMetadata } from "../src/processing/extract-metadata.js";
import type { MetadataSchmeaItem } from "../src/types.js";
import type { Metadata } from "../src/types.js";

(async () => {
	const content = `
	Hey everyone and thanks for jumping back into the macroverse. Today we're going to talk about the most recent inflation report. If you guys like the content, make sure you subscribe to the channel, give the video a thumbs up, and check out the sale on into the cryptoverse premium at into the cryptoverse.com. Let's go ahead and jump in. So, we just got the inflation rate yearover-year and it came in at around 2.9%. really you know 2.94 uh it came pretty close to rounding to three which might have had a bigger impact on markets but still 2.9% and consensus was also 2.9%. So, while it has moved up, it it didn't really move up in an unexpected way, right? It it moved up, but not really in an unexpected way. Um, this could be residual effects of of the PPI data we got last month. Uh, hopefully it'll come back down next month. Um, but you can see that it in fact did move up to 2.94%. If you look at it per category, so this is overall headline inflation. we can see like why it's going up and then we'll look at it weighted food and beverages inflation actually went higher from 279 up to 3.12. Uh and guys I I will say right I know a lot of people don't trust the the inflation data. This is not I mean this is more so about looking at things that the Fed will ultimately base future decisions on. Right? Housing inflation actually went up a tiny tiny bit but not a whole lot from 3.94 to 3.98. But remember, housing inflation is a majority. It contributes a majority to the overall headline CPI number. It's like twothirds or something. Uh apparel went from deflationary, now back to being inflationary, but not really that much, just 0.25%. Transportation, also something that's commonly more commonly deflationary than other categories, was deflationary a few months ago, uh but now it's back up to about 1%. uh you have medical care which dropped from the last month and then recreation and education and communication. Now if you look at it uh weighted because again the the categories are not all treated the same. What you'll notice and we're going to zoom in over here. Um what you'll notice this is the overall headline inflation. you'll see that housing inflation makes up a you know a majority of the overall inflation. Okay, so that's having the biggest effect. That did go up a little bit but not a ton. Food and beverage that had a decent effect because last month it was you know41% of the 2.73 and then this month it's 0447. Um so that is you know one of the big reasons for the overall increase. Uh we did obviously see changes in other categories. I mean like you have uh transportation which was deflationary a few months ago back now to actually contributing. Um I think uh there are a few others as well right but overall not a whole lot has changed inflation ticked up a little bit uh but it's not that surprising that was the overall consensus view. core inflation, right? Core inflation um has has remained steady I believe or this is international core inflation USA um you know it was at 3% about 3.1% last month it's at 3.1% this month I mean last month it was 3.05 05. So, it rounded to 31. And then this month is 3.11. So, it still rounds uh to 31. But, you know, a slight move up here. And I have to imagine that it's these increases we've seen with inflation recently. I have to imagine that that is the the reasoning why the Fed is only likely going to do a 25 basis point rate cut, right? because without that inflation, you know, without the PPI data from last month, which was actually mostly taken back down this month, um if you just look at at the labor market, um you you really you really could start to justify a heavier cut than than 25 basis points. And one of the reasons is is not it's not I mean looking at inflation and and you know thinking that it's probably going to to drop back down eventually, but it's more so like looking in at looking at at some of the weakening we've seen. I mean even today with initial claims it's still not that concerning because it's still below 300K. But we did see initial claims actually spike up to 263,000. Um I don't you know this is this is the highest initial claims I believe have been since like 2021. So I with and the reason I I say it is because initial claims are trending up. Uh but you also have you know the unemployment rate uh starting to sort of break out above that 4 4.2% level. It's now 4.3%. We know that hires are down, right? Highireers are down. They're pretty low now. Um, and we also know that job openings are are are pretty low. And and additionally, the number of available jobs per the the number of jobs per available worker is now less than one, which is a metric that that Powell has frequently cited. And then the last thing I'll say about it is that the 2-year I I generally think that the 2-year yield tells the Fed what they need to do. The Fed does not tell the 2-year yield, right? It's this it's the two-year yield telling the Fed. And if you go look at the uh at the 2-year yield, it's currently at at 3.5%. And what you'll notice is if you overlay interest rates here, if you overlay interest rates, um you can see historically, you know, the 2-year yield will will will drop. Like it'll it'll drop and then the Fed will then start to cut rates. When the 2-year yield rises, then the Fed starts to raise rates. So, right now, the 2-year yield is at 4 point or sorry, it's at 3.5%. But the Fed funds rate is at 4.5%. Right? So, there's a 100 basis point delta right there. Um, you could argue that the current that the current bull market that we've been in, you know, for the last few years would probably take a break uh if the 2-year yield durably breaks below 3.5%. So, what I'm hoping for is I I'm hoping that the 2-year yield can bounce here um kind of like it did last year when the Fed cut rates at essentially the same level. If the two-year yield can get one more bounce before the end of the year, then it could, you know, it could set things up for that final move in the Q4. But watch this because if this starts to break down, you know, it might change the outlook. So, we'll see what happens when the Fed cuts rates. What you want to see is you want to see the two-year yield break back up and maybe tag that bull market one more time before then likely going below that level uh in in 2026. Remember, the argument here is that the neutral rate, and again, not everyone agrees with this, but the argument is that the neutral rate could be approximated by the 2-year yield, and the neutral rate, if that's true, the neutral rate is 3.5% and the Fed funds rate is still 4.5%. But again, you could argue that with the weakening we've seen in initial claims and with the weakening we've seen in the unemployment rate heading higher, right, finally breaking above 42, it would stand to reason that the Fed could could justify a 50 basis point rate cut. I I have to imagine the only reason they're not is because they're worried about about this recent trend in inflation. Here we actually have inflation rate internationally. So, here you can see it for the United States, but if you're curious, we also have it for New Zealand. You know, it's been moving up a little bit recently. Not a ton. Um, Germany, I'm just going to go through them. A uh Australia, and here's Japan. Japan, we've actually seen, this is the reason why the Bank of Japan keeps raising rates, and while they'll probably raise rates again, is because that one's more so been trending higher than a lot of other countries. But remember when a lot of countries were cutting rates back in um or sorry when a lot of countries were raising rates back in 2022 and 2023, Japan wasn't right. So now they're doing it now. Uh France, France's inflation is back getting pretty low actually.9%. Um Singapore pretty low, South Korea, South Africa, Mexico, zoom in here to Mexico 3.57. Uh Brazil, Brazil's at 5%. China negative.4. Uh the United Arab Emirates moved up a little. The Euro area is is currently at around 2.1. India 1.55. Let me zoom back out. Um and then of course Canada just below two. And the UK. The UK. you know, inflation in the UK has actually been trending higher. Uh found a low of 1.7 back in September 2024, but it's been moving up more or less ever since then. It's back up to 3.8%. So, I don't really know uh what they're doing over there, but they need to they need to figure it out because inflation's going the wrong direction over there. So, those are my thoughts. Um, I I think the Fed will probably cut 25 based on this, but I mean, honestly, if you didn't if you didn't show me this, I wouldn't be that surprised uh for it to be 50. I I think they could get away with 50. I think they could justify as long as they do they would do like 50 and then maybe 25, right? So, like last year they had cuts at every meeting, September, October, December. Uh it looks like this year the the market's pricing in cuts at every meeting. Um, but then also one in January. What I'm suggesting is why not just do 50 2525 and then by the end of the year, assuming the two-year yield doesn't break down, then at least the Fed funds rate is is back in line with the neutral rate. But those are just my thoughts. Obviously, they're they're they're leaning towards just doing a 25 basis point rate cut. Anyways, if you guys like the content, make sure you subscribe, give the video a thumbs up, and again, check out the sale on into the cryptoverse premium at into the cryptoverse.com. I'll see you guys next time. Bye.
	`;

	const client = createLlmClient("ollama:gemma3:27b");
	const cleanedContent = await chunk(
		content,
		"Australia Realestate and Property Market",
		client,
	);

	console.log(cleanedContent);

	const metadataSchema = `
	  city:
	    type: string[]
	    description: "Canonical city names. ONLY city and nothing else."

	  suburb:
	    type: string[]
	    description: "Canonical suburb names. ONLY suburb and nothing else."

	  developer:
	    type: string[]
	    description: "Canonical developer company names"

		builder:
	    type: string[]
	    description: "Canonical builder company names if different from developers."

		project:
			type: string[]
			description: "Canonical property development project names."

		infrastructure:
			type: string[]
			description: "Infrastructure project names (e.g. metro_west, western_sydney_airport)."

	  property_type:
	    type: enum[]
	    description: "High-level property classification."
	    values:
	      - house
	      - apartment
	      - unit
	      - townhouse
	      - villa
	      - terrace
	      - duplex
	      - land
	      - commercial
	      - studio
	      - penthouse

		market_segment:
			type: enum[]
			description: "Market segment classification, target audience or buyer type."
			values:
				- luxary
				- premium
				- midrange
				- affordable
				- first_home_buyer
				- investor
				- downsizer
				- upsizer

		investment_thesis:
			type: enum[]
			description: "Investment thesis or strategy mentioned in the content."
			values:
				- long_term_growth
				- capital_growth
				- rental_yield
				- renovation_flip
				- development_project
				- holiday_rental

	  sentiment:
	    type: enum
	    description: "Overall sentiment or tone regarding the property market, specific suburbs, projects, developers as expressed in the content."
	    values:
	      - positive
	      - neutral
	      - negative
		`;

	const metadata = await extractMetadata(
		cleanedContent,
		"Australia Realestate and Property Market",
		metadataSchema,
		client,
	);
	console.log(YAML.stringify(metadata));

	// 	let cleanedContent = `
	// 		# Looking ahead to 2025

	// 	## 2024 surprises
	// 	- The intergenerational wealth and the size of deposits we've seen from clients shocked me. Parents are providing much larger amounts now because borrowing capacity is lower, so the deposit gaps can be $600k–$800k rather than just 20%.
	// 	- CoreLogic's latest number: $11.21 trillion in the property market with $2.5 trillion of debt.
	// 	- In Sydney, the stability of the market throughout 2024 was surprising; for most of the year Sydney sat in real balanced market territory. It felt like a normal market for the first time in 12 years.
	// 	- Over the previous four to six weeks (recording end of November), there was a steady and steep increase in listings for auction each weekend: starting at ~1,100 then 1,200, 1,300 and three weeks in a row over 1,400 new listings per week. If properties don't sell, unsold stock swells, but clearance rates held firm, briefly dipping below 60% then bumping back over 60%.
	// 	- There is disparity across capital cities: some have romped ahead, others are suffering. Darwin never quite recovered; Perth has gone from poor to very strong; Brisbane has continued strong performance; Adelaide and Hobart have been in negative territory. We no longer have a single Australian property market.

	// 	## Intergenerational wealth and borrowing constraints
	// 	- The market dynamic has changed because borrowers can only borrow around four and a half to five times income, not seven or eight times. Prices are similar to previous booms, so deposit requirements are much larger and many families are using inherited equity or selling down investment properties to help younger generations enter the market.
	// 	- That transfer of equity is likely propping up parts of the market.

	// 	## Auction listings and clearance behaviour
	// 	- Even with increasing auction listings, clearance rates held up relatively well. When buyers are shallower, the strength of the market is notable.
	// 	- Agents adapt their behaviour: if a property has only a couple of strong bids expected, agents may sell it prior to auction. That affects the apparent listings dynamics and buyer choice.

	// 	## City-by-city dynamics
	// 	- Brisbane: very low listings kept the market strong; Olympic hype possibly contributed.
	// 	- Melbourne: still having a tough time despite sound fundamentals; the rental crisis there isn't as severe, which may have limited price growth.
	// 	- Perth and Adelaide: experienced very strong growth, possibly driven by first-home buyers who are actually first-time investors because they cannot buy a home based on their incomes and borrowing multiples.
	// 	- Hobart: has declined from its recent boom and is less talked about when prices fall.

	// 	## Investors, first-home buyers, and inequality
	// 	- Investor lending has increased over the last 12 months as a percentage and dollar amount, but many long-term investors are still exiting the market. New investors are not entering at the same rate as those leaving.
	// 	- The best-performing quarter has been the most affordable segment. Expensive properties have not driven the market; lower price points have. Higher interest rates constrain borrowing, pushing investment and first-home demand into cheaper segments.
	// 	- This dynamic increases inequality: those with intergenerational support and higher incomes can enter, others cannot.
	// 	- Self-managed super fund (SMSF) lending, which seemed dead, has revived a bit with more non-bank lenders returning. We still see relatively few SMSF loans in practice, but interest and innovation are increasing.

	// 	## Renovations and building activity
	// 	- Many people are choosing to renovate rather than upgrade because the gaps and costs to upgrade are too large. A rise in renovators has been observed over the last three months.
	// 	- The building industry has been hit: high costs and feasibility issues have reduced apartment building activity. Expect more greenfield estates and house-and-land packages, but not a lot of building next year, which is concerning given housing needs.
	// 	- Developers are explaining why building is not profitable: new builds often sell for more than established stock, but buyers may now compare new and established and opt for established where it makes sense.

	// 	## Zoning, urban planning, and rezoning risk
	// 	- Rezoning and densification policies are changing the long-term prospects of areas. Buyers on edges of newly zoned areas must be careful; future rezonings can materially affect value.
	// 	- Some local governments and state planning bodies are being overridden or pressured to increase supply; there is debate about how profitable development will be even under that pressure.
	// 	- Urban planning shifts can create complexity and caution in buying decisions.

	// 	## Interest rates, APRA, and timing
	// 	- Interest rates will be the biggest driver of prices in 2025. If rates fall back toward ~4%, borrowing capacity would increase and could materially affect prices.
	// 	- Watch whether APRA cuts the serviceability buffer and increases borrowing capacity once there is confidence about rates.
	// 	- Avoid trying to time the market; focus on personal readiness and long-term planning. If possible, buying in flat or declining markets is preferable to buying in rising markets, though everyone tends to follow social proof.

	// 	## Listings, human behaviour, and market cycles
	// 	- Listings often remain low in terms of quality: there can be many listings but few high-quality properties. When uncertainty rises, listings often dry up rather than flood the market because sellers hold on.
	// 	- Major shocks (e.g., GFC, start of COVID) primarily impacted the small percentage of transactions actually on the market at the time. After shocks, the market takes a breath and then returns to business.

	// 	## Return to office and location choices
	// 	- There has been a return to work in the office during 2024. Many employees are choosing to be back in the office to protect their jobs or for career progression.
	// 	- Moves to outer locations like Central Coast and Wollongong saw a lot of signboards and re-entries; some of these were U-turns with people returning to cities.
	// 	- Child care shortages in some regional areas force families to return to cities; proximity to family can also be a factor.
	// 	- Hybrid work can support demand in commuter or lifestyle markets, but these are small, tight markets and require local knowledge to buy well.

	// 	## Rental market and vacancy rates
	// 	- Upward pressure on rents has eased in speed of increase but remains strong due to low vacancy rates. Tenants have faced large rent increases since 2020.
	// 	- Vacancy rates are well below pre-COVID five-year averages in many cities (e.g., Perth, Sydney, Darwin, Brisbane), making renting harder and likely keeping rental price growth strong.
	// 	- More investors leaving capital cities and higher migration can tighten rental supply further, potentially making renting unaffordable for many and increasing household crowding or displacement.

	// 	## Immigration and policy
	// 	- Immigration contributes to rental and housing demand. Policy is complex and varies across jurisdictions; state-level tenancy and investment rules are evolving.
	// 	- Victoria has introduced significant tenant-focused and investor-impacting legislation; similar measures could appear in other states. Investment decisions should factor in the risk of policy changes that affect investor costs (e.g., land tax, restrictions on short-term rentals).

	// 	## Election 2025 potential impacts
	// 	- A federal election in 2025 is likely to feature housing and population as central issues. Proposed policies such as super access for housing could stimulate demand instantly by releasing deposits, increasing first-home buyer activity and combined purchases.
	// 	- Markets may slow as people wait for election outcomes. Historically, transactions slow ahead of federal elections.

	// 	## Investor lending trends and drivers
	// 	- Investor lending rose in 2024 even as other investors sold; drivers include first-home buyers buying investment properties, younger generations being more debt-hungry and wealth-building focused, and increased social media content and influencer-driven advice encouraging investment.
	// 	- The proliferation of online content, including poor-quality advice, impacts investor decisions and can increase demand among new investors.

	// 	## Consumer sentiment and macro risks
	// 	- Consumer confidence is low; rate expectations vary. If inflation eases and energy prices stabilize, confidence could improve and lead to more economic activity and housing demand.
	// 	- Global risks (e.g., geopolitical events, policy shifts in large economies) can create unexpected shocks. Expect something unexpected in 2025; uncertainty often reduces listings and can support prices.

	// 	## Climate change and flood maps
	// 	- New flood maps and changing climate risk assessments are being updated across the country. Properties not previously in flood zones may now be classified differently.
	// 	- Climate risk measurement, disclosure, and implications for individual properties are changing and buyers should consider these risks and how they are mapped and assessed.

	// 	## Practical advice and considerations
	// 	- Focus on long-term plans, personal readiness, and individual circumstances rather than trying to time the market.
	// 	- Understand local nuances when buying in unfamiliar areas; engage local specialists or conduct thorough local research (e.g., known local issues like backyard leeches, mosquito-prone suburbs, childcare availability).
	// 	- Be cautious about rezoning impacts, tenancy law changes, and the potential for evolving climate risk assessments.
	// 	- When uncertainty increases, listings and buyer activity often cool more than prices fall immediately; avoid being the seller on market during a shock event if possible.

	// 	## Final notes
	// 	- Expect 2025 to be shaped by interest rate moves, policy changes, immigration, rental market tightness, urban planning decisions, and unforeseen shocks.
	// 	- Buyers and investors should factor in borrowing capacity, deposit size, local planning changes, tenancy law risks, and climate risk when making decisions.
	// 		`;

	// 	cleanedContent = `
	// ## CHUNK c01: "US headline CPI 2.94% year-over-year"
	// So, we just got the inflation rate year-over-year and it came in at around 2.9%, really you know 2.94%. It came pretty close to rounding to 3%, but still 2.9% and consensus was also 2.9%. So, while it has moved up, it didn't really move up in an unexpected way. This could be residual effects of the PPI data we got last month. Hopefully it'll come back down next month. In fact it did move up to 2.94%.

	// ## CHUNK c02: "Inflation changes by major categories"
	// Weighted food and beverages inflation went higher from 2.79 up to 3.12. Housing inflation went up a tiny bit from 3.94 to 3.98. Apparel went from deflationary to inflationary at 0.25%. Transportation was deflationary a few months ago but is now back up to about 1%. Medical care dropped from the last month. Recreation, education and communication also changed.

	// ## CHUNK c03: "Weighted contributions and housing dominance"
	// Housing inflation contributes a majority to the overall headline CPI number. Food and beverage had a decent effect because last month it was 41% of the 2.73 and then this month it's 0.447. Housing is having the biggest effect on headline inflation.

	// ## CHUNK c04: "US core inflation roughly steady ~3.1%"
	// Core inflation was about 3.1% last month (3.05 rounded to 3.1) and this month is 3.11 (rounded to 3.1). A slight move up from 3.05 to 3.11.

	// ## CHUNK c05: "Labor market: initial claims, unemployment, hires"
	// Initial claims spiked up to 263,000. Initial claims are still below 300,000 but 263,000 is the highest initial claims since 2021 and initial claims are trending up. The unemployment rate is now 4.3%, breaking above 4.2%. Hires are down. Job openings are pretty low. The number of available jobs per available worker is now less than one, a metric that Chair Powell has frequently cited.

	// ## CHUNK c06: "Two-year yield vs Fed funds and neutral rate"
	// The two-year yield is currently at 3.5%. The federal funds rate is at 4.5%, a 100 basis point delta. Historically the two-year yield tends to move before the Fed changes rates: when the two-year yield drops the Fed then starts to cut rates; when it rises the Fed starts to raise rates. The neutral rate is being approximated by the two-year yield at about 3.5% (not everyone agrees). If the two-year yield durably breaks below 3.5% it could take a pause out of the current bull market. If the two-year yield can bounce one more time before the end of the year it could set things up for a final move in Q4; if it breaks down that changes the outlook.

	// ## CHUNK c07: "Fed cut scenarios and market pricing"
	// Given recent inflation moves and labor market signs, the Fed is likely to do a 25 basis point rate cut, although a 50 basis point cut could be justified by some indicators. Without the recent PPI data, which was mostly taken back down this month, looking at the labor market alone might justify a heavier cut than 25 basis points. The market is pricing in cuts at every meeting, including one in January. Suggested sequence discussed: 50 then 25 then 25. Last year there were cuts at every meeting in September, October and December.

	// ## CHUNK c08: "International inflation figures by country"
	// United States: (see CHUNK c01). New Zealand: moving up a little recently. Germany: (mentioned). Australia: (mentioned). Japan: trending higher; Bank of Japan has been raising rates and will probably raise rates again. France: 0.9%. Singapore: pretty low. South Korea: (mentioned). South Africa: (mentioned). Mexico: 3.57%. Brazil: 5%. China: -0.4%. United Arab Emirates: moved up a little. Euro area: around 2.1%. India: 1.55%. Canada: just below 2%. United Kingdom: 3.8%, up from a low of 1.7% in September 2024.
	// `;

	// const greptor = await createGreptor({
	// 	baseDir: "./data",
	// 	topic: "Australia/Sydney Realestate and Property Market",
	// 	llmModel: "openai:gpt-5-mini",
	// 	autoGenerateMetadataSchema: true,
	// 	logger: console,
	// });

	// console.log("Greptor created (background workers running)");
	// console.log("Running. Press Ctrl+C to stop.");

	// const keepAlive = setInterval(() => {}, 60_000);
	// let shuttingDown = false;

	// const shutdown = (signal: string) => {
	// 	if (shuttingDown) return;
	// 	shuttingDown = true;
	// 	console.log(`\nReceived ${signal}, shutting down...`);
	// 	clearInterval(keepAlive);
	// 	process.exit(0);
	// };

	// process.once("SIGINT", () => shutdown("SIGINT"));
	// process.once("SIGTERM", () => shutdown("SIGTERM"));

	// const result = await greptor.eat({
	// 	content: content,
	// 	format: "text",
	// 	label: "The Property Market in 2025: What Could Be on the Horizon?",
	// 	creationDate: new Date(),
	// 	metadata: {
	// 		source: "youtube",
	// 		publisher: "@theelephantintheroom-podcast",
	// 	},
	// });

	// console.log(result);

	// 	console.log("✓ Content added:", result);

	// 	console.log("\n🚀 Background processor is running");
	// 	console.log("   Polling for unprocessed content every 10 seconds (demo)");
	// 	console.log("   Press Ctrl+C to stop\n");
})();
