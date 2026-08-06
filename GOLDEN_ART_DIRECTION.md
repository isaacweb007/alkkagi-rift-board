# ALKKAGI Golden Art Direction

This file is the visual source of truth for the playable HTML5 build. New work must extend these rules instead of introducing a parallel style.

## Approved sources

- Character shape, face, equipment, material and palette: `character-roster-3d-v2.png`
- Arena composition and camera mood: `arena-*-danger-v2.png`
- Board geometry, bronze trim and center emblem: `board-topdown.png`
- Battle HUD placement: `ui-battle-core-v2.png`
- Lobby composition: `ui-lobby.png`

## Runtime rules

- The circular board fills roughly 72–78% of a desktop 16:9 viewport and remains fully readable behind the HUD.
- The board surface always uses the approved dark engraved stone and bronze floral emblem. Arena selection changes the world beneath it, not the board identity.
- Character faces remain oriented toward the gameplay camera while moving. Full tumbling is reserved for ring-out falls.
- Team assignment changes the main stone shell only: warm ivory-white or charcoal-black. Equipment, face and elemental accent colors never change.
- Character silhouettes must remain recognizable at roster-icon size. Accessories are never replaced with generic elemental particles.
- Blue and red are combat-side signals. Bronze-gold is the persistent UI frame color. Cyan, violet, orange and aurora colors belong to character skills and arena hazards.

## Golden camera and lighting

- Perspective camera: 39 degree field of view.
- Gameplay camera: elevated three-quarter view with the near board rim below center and the far rim below the score rail.
- Warm key light from upper-left, cool rim light from rear-right, danger light below the board.
- ACES filmic tone mapping with controlled exposure; black stones must stay black and white stones must not clip.

## Character production order

1. 몽돌 — body, face and material baseline.
2. 브릭 경 — hard-surface helmet baseline.
3. 비트캣 — emissive accessory and audio personality baseline.
4. Remaining seven characters, reusing the validated body and face rig.

Every new character requires black-team and white-team screenshots, a roster-size readability check, collision-scale validation and a ring-out silhouette check.
