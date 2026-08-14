---
name: design-alkkagi-game
description: Design production-ready 3D Alkkagi game concepts, rules, narratives, modes, arenas, characters, progression, balance, Web3 boundaries, and MVP roadmaps. Use when defining or revising an Alkkagi GDD, story bible, character roster, physics-first combat loop, PC-web launch scope, live-content plan, or token-linked economy.
---

# Design Alkkagi Game

Create an Alkkagi design in which readable physics and player skill remain the source of victory. Treat narrative, characters, progression, and economy as reinforcement for that core.

## Workflow

1. State the one-sentence fantasy, audience, match length, camera, input, and target platform.
2. Lock design pillars and explicit non-goals before adding content.
3. Specify the turn loop, legal shot, aiming information, collision resolution, elimination, victory, timeout, disconnect, and draw rules.
4. Define the five shared character attributes with visible gameplay meaning and bounded numerical ranges. Separate personality from competitive power.
5. Build modes, arenas, story structure, tutorial, progression, roster, store, and updates around the locked rules.
6. Partition all economy layers into off-chain play points, cosmetic/progression ownership, and any withdrawable asset. Never imply profit or guaranteed value.
7. Cut an MVP that proves aiming, collisions, netcode, fairness, and replayability before token withdrawal or a large content set.
8. Finish with production risks, acceptance tests, open decisions, and a dependency-ordered roadmap.

## Required Design Constraints

- Give every player the same eight neutral starter pieces.
- Preserve one clear input: select, drag opposite the shot direction, tune power, release.
- Make prediction approximate, not perfect; reveal direction and power while preserving mastery of spin, contact point, and board state.
- Use server-authoritative results for competitive multiplayer and retain shot inputs plus deterministic replay data for disputes.
- Keep ranked loadouts horizontally balanced. Upgrades may unlock expression, sidegrades, or PvE strength, but must not create paid ranked advantage.
- Make the first ten matches a protected, free learning journey. Do not place a deposit or withdrawal prompt inside this onboarding.
- Label unvalidated numbers as starting hypotheses.
- Treat Web3 as an optional account/economy layer. A guest must reach the fun before creating a wallet.

## Character Schema

Define exactly five attributes for every piece:

1. `추진력`: initial shot speed at a given charge.
2. `중량`: momentum transfer and resistance to displacement.
3. `내구`: post-contact energy retention and stability; high values carry energy through ricochets but may overshoot. It may also resist temporary PvE effects, but never grants extra ring-out lives.
4. `정밀`: aim-line stability and fine power-control window.
5. `회전`: curve/spin authority and post-contact control.

For each character include silhouette, era/faction, personality, role, stat vector, signature passive, counterplay, upgrade expression, VFX/SFX cue, and readability at the gameplay camera distance. Use a fixed point budget for competitive variants.

## Narrative Pattern

Connect eras through one repeatable premise: the board is a dimensional arena that selects champions through ritualized flick combat. Give each era its own conflict, ruler/rival, arena hazard language, and musical identity while keeping the match rules recognizable.

Use a three-act launch arc:

- Act I teaches the ritual and establishes the player's eight neutral pieces.
- Act II reveals competing factions and introduces controlled sidegrades.
- Act III links all launch eras in a tournament whose final choice creates a live-season hook.

Story beats must teach or remix a mechanic. Avoid cutscenes that do not change player understanding.

## Economy Gate

Before specifying withdrawal, record jurisdiction, age gate, KYC/AML provider, sanctions screening, custody model, tax reporting, consumer disclosures, geofencing, dispute handling, responsible-spend controls, and legal review. If these are unknown, design only a non-withdrawable closed-loop points MVP and mark cash-out as a gated later phase.

## Deliverables

Produce compact linked documents rather than one unmaintainable file:

- product vision and design pillars
- world/story bible and launch campaign
- core rules and modes
- initial roster and balance assumptions
- arenas, art direction, audio/game-feel direction
- economy and safety boundaries
- MVP roadmap, risks, tests, and open decisions

Use `references/review-checklist.md` before finalizing a design.
