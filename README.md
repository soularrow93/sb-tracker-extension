# SB Tracker — Swagbucks Earnings Manager (v1.0)

A manual tracker for Swagbucks users. It helps you MANAGE your earning:
daily goal + streak, an SB log with your real SB/hour rate, and a survey
queue that ranks opportunities by SB/min so you always do the best one first.

## What it deliberately does NOT do
- No automation: it never clicks, answers, spins, plays or completes anything.
- No site access: the manifest requests ZERO host permissions. It cannot see
  or touch swagbucks.com (or any other site). All data is entered by you and
  stored locally in your browser (chrome.storage.local).

That design is the point: tools that automate GPT sites get accounts banned
and get rejected from the Chrome Web Store. A manual tracker is safe for
accounts and publishable.

## Install (test / personal use)
1. Unzip the folder.
2. In Chrome: open `chrome://extensions`, enable "Developer mode".
3. "Load unpacked" → select this folder.
4. Pin "SB Tracker" and log your SB as you earn.

## Publishing (product path)
- Requires a Chrome Web Store developer account (one-time US$5 fee, paid by
  the account owner) and Google review. The zero-host-permissions design
  makes review straightforward.
- Monetization reality: the Web Store has no built-in payments anymore.
  A freemium model needs an external payment layer (e.g. a license-key
  backend) — a v2 project, not v1. Realistic expectations: this is a niche
  utility; treat any income as a bonus, not a salary.

## Roadmap ideas (all manual/assistive, no automation)
- v1.1: Weekly/monthly charts, per-source breakdown, cashout countdown
  (SB needed to next gift card at current rate).
- v1.2: Multi-site support (Freecash, inboxdollars-style GPT trackers),
  import/export sync.
- v2: Optional freemium: advanced stats + multi-site for a small license fee.
