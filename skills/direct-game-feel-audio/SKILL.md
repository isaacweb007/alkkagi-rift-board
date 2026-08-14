---
name: direct-game-feel-audio
description: Direct responsive game feel for physics games through layered SFX, adaptive music, VFX, camera motion, hit-stop, UI feedback, mix priorities, and implementation event schemas. Use when creating or reviewing collision, flick, ricochet, ring-out, victory, arena ambience, or character audio and impact specifications for a 3D PC-web game.
---

# Direct Game Feel Audio

Design impact as a synchronized stack. Audio leads readability; camera and VFX reinforce it without hiding the board or delaying input.

## Workflow

1. Inventory gameplay events and their parameters before naming individual sounds.
2. Group contacts by material pair, relative velocity, impulse, glancing angle, combo count, danger state, and local/remote ownership.
3. Build each important event from a short transient, material body, low-end weight, character accent, and optional environmental tail.
4. Map continuous parameters to pitch, volume, filter, transient choice, particle count, camera impulse, and time scale.
5. Define music states and transition rules. Do not restart tracks on routine shots.
6. Establish voice, impact, UI, music, and ambience priorities plus concurrency limits.
7. Test at gameplay camera distance, on laptop speakers and headphones, with music both on and off.

## Impact Tiers

- `T0 touch`: quiet tick; no camera response.
- `T1 light`: clear material click; tiny particle response.
- `T2 solid`: transient plus body; 15–30 ms visual compression; subtle camera impulse.
- `T3 heavy`: added sub layer, directional debris, 35–55 ms hit-stop for local decisive contact only.
- `T4 ring-out`: contact release, falling whoosh, delayed off-board confirmation, crowd/character punctuation; reserve the strongest mix ducking and camera beat.

Use impulse thresholds as tunable hypotheses. Smooth between adjacent tiers to prevent audio chatter near thresholds.

## Readability Rules

- Sound must distinguish stone-on-stone, stone-on-board, rim scrape, charge, release, near-edge danger, ring-out, invalid action, turn change, and victory without looking at UI.
- Preserve stereo direction for contacts, but keep critical ring-out confirmation intelligible near the center.
- Never use long camera shake, blur, or hit-stop that alters the competitive simulation.
- Apply hit-stop to presentation only; the authoritative physics clock must remain consistent.
- Cap repeated ricochet voices and rotate samples to prevent machine-gun repetition.
- Give every character one short signature layer, not a completely different collision language.
- Provide independent sliders for master, music, effects, ambience, UI, and voice; include reduced-flash and reduced-camera-motion options.

## Adaptive Music

Use vertically layered stems with shared tempo:

- exploration/menu identity
- calm turn bed
- danger layer when two or more pieces are near elimination
- match-point layer
- result sting

Quantize transitions to musical bars, duck only the frequency range needed for critical impacts, and preserve era instrumentation while sharing a recognizable melodic motif.

## Event Data Contract

Every implementation row must contain:

`event_id`, trigger, required parameters, spatial mode, layers, variations, concurrency group, cooldown, priority, bus, music duck, VFX, camera response, accessibility alternative, and QA note.

Use `references/impact-qa.md` for the final review.

## Acceptance Tests

- A blind listener identifies at least the shot, heavy collision, danger scrape, ring-out, and turn handoff.
- Ten rapid ricochets remain legible without clipping or obvious sample repetition.
- The decisive hit feels stronger than routine hits while keeping the aim view readable.
- Remote multiplayer presentation can lag-correct gracefully without duplicating a ring-out sting.
- Disabling camera motion or music does not remove essential gameplay information.
