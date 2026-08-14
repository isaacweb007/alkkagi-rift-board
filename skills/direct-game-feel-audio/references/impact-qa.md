# Impact and Audio QA

## Synchronization

- Keep transient onset within one rendered frame of visible contact.
- Trigger ring-out confirmation once from the authoritative event.
- Apply presentation slow-down after contact recognition, never before physics resolution.

## Mix

- Reserve headroom for decisive hits and result stings.
- Limit simultaneous voices per collision group and per character.
- Verify mono compatibility and small-speaker audibility.
- Avoid low-frequency buildup during ricochet chains.

## Variation

- Provide at least four variations for common impacts and use no-immediate-repeat selection.
- Modulate pitch and gain within narrow ranges tied to impulse.
- Keep signature character accents rarer than core material feedback.

## Competitive clarity

- Do not obscure the next legal input with long tails or UI stingers.
- Do not reveal hidden information through sound.
- Keep essential cues available when music, voice, camera shake, or flashes are disabled.

## Web performance

- Preload critical one-shot assets; stream longer music and ambience.
- Prefer compressed web formats with tested browser fallbacks.
- Reuse pooled particles and avoid layout work during impacts.
- Log missed or late critical events during development builds.
