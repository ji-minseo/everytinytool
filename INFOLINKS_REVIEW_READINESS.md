# Infolinks publisher review — Every Tiny Tool readiness
Last reviewed: 2026-10-12 (Asia/Seoul)
Status: PREPARED, NOT SUBMITTED. No Infolinks code deployed.

## Intended publisher sites

| Site | GitHub repository | Registration approach |
|---|---|---|
| https://everytinytool.com/ | ji-minseo/everytinytool | Apply with main site first |
| https://random.everytinytool.com/ | ji-minseo/random-everything | Add as separate website, subject to Infolinks review |
| https://calculate.everytinytool.com/ | ji-minseo/calculate-everything | Add as separate website, subject to Infolinks review |
| https://image.everytinytool.com/ | ji-minseo/image-everything | Add as separate website, subject to Infolinks review |

Infolinks support says each account-added website gets a unique website script. Do not assume approval for one hostname extends to other hostnames. Verify subdomain treatment with Infolinks in its account workflow.

## Confirmed from GitHub source (not a live-browser audit)

- [x] Main site has functional browser utilities and descriptive landing pages.
- [x] Main site has /about/, /privacy/, /contact/.
- [x] Main site has robots.txt and sitemap.xml indexing the utility pages.
- [x] Main site has an ads.txt entry for the existing Google publisher account.
- [x] Random, Calculate and Image site homepages link to shared main-site About / Privacy / Contact pages.
- [x] Privacy policy mentions third-party advertising and cookies.
- [x] About page now explains independent funding and an ad-placement principle.
- [x] Infolinks publisher eligibility officially states no minimum visitors or pageviews (but review/approval still required).
- [ ] Verify every site and representative utility URL loads on live desktop AND mobile (live site unreachable from the review tool).
- [ ] Test every navigation/footer link and all tool interactions on the deployed site.
- [ ] Review consent handling, especially regions requiring user choices before non-essential ad/analytics technologies load. Current source loads Google's ad-script snippet; source audit alone cannot verify valid consent management.
- [ ] Consider providing a private, working contact channel besides public GitHub Issues, without publishing sensitive account details.
- [ ] Verify policy text matches actual cookies, ad vendors, data practices and consent behavior before any new ad-network integration.
- [ ] Check site performance and accessibility with ads, especially mobile sticky UI and tools used on touch screens.
- [ ] Confirm that advertiser content does not cover, mimic, or interfere with calculator controls, random-result buttons, text inputs, privacy pages, or ruler measurement surfaces.

## Apply

Official application: https://www.infolinks.com/join-us/
Official support:
- https://www.infolinks.com/support/quality/what-are-the-eligibility-criteria-for-my-site-to-qualify-with-infolinks
- https://www.infolinks.com/support/account/how-do-i-sign-up-as-an-infolinks-publisher
- https://www.infolinks.com/support/account/how-can-i-add-more-websites
- https://www.infolinks.com/support/integration/how-do-i-integrate-infolinks-into-my-website
- https://www.infolinks.com/support/products/how-do-i-restrict-intext-ads-from-certain-areas

1. Owner creates an Infolinks publisher account using their real details and submits the site URL. Do not place credentials, tax records, personal details or API keys in the repository.
2. Infolinks says the quality-review team aims to review applications within 48 hours; approval and timing are not guaranteed.
3. Add each additional website through the publisher center and obtain its unique integration script AFTER that site is approved.
4. Only then add the specific provider-supplied snippet to the corresponding website. Avoid committing a placeholder script or pretending that ads are active.
5. Place the approved JavaScript according to Infolinks integration guidance (typically before closing body tag). Verify other scripts are not broken.
6. Configure appropriate ad products and avoid overlays that impair use of interactive utilities. InText ON/OFF section tags may be appropriate around interactive areas, FAQ and footer; verify their integration per page after approval.
7. Review Google AdSense and Infolinks policies, applicable privacy/consent obligations, and disclosures. Do not assume that using both providers automatically satisfies all policies.
8. Check whether Infolinks supplies ads.txt / sellers.json instructions for each approved site. Keep Google's existing ads.txt entry and add only verified provider-supplied records. Do not invent seller IDs.
9. Test user experience, layout shifts, page performance and result accuracy on phone, tablet and desktop. Monitor Search Console data; disable intrusive placements.

## Short application description (English)

Every Tiny Tool is an independent collection of free, browser-based utilities that help visitors complete everyday tasks quickly. The network includes random generators, everyday calculators, image utilities, an actual-size screen ruler and text tools. Pages provide instructions and relevant explanations. Most functions work without registration, and many process inputs locally in the user's browser. We aim to keep advertising distinct from interactive tools and results.

## Important

The main website and its subdomain files were reviewed through the connected GitHub repositories. This checklist does NOT certify live availability, legal compliance, user-consent status, Infolinks approval, ad traffic eligibility, or revenue. Publisher terms and platform rules can change; re-check official terms at signup time.
