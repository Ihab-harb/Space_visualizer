---
title: ui
tags: [architecture]
---

# ui (`src/ui`)

Back to [[Home]] · [[Overview]]

- **TopBar:** Orbit/Follow view switcher (keys `1`, `2`; `Esc` returns to Orbit; keys are ignored while typing), "Rotate with body" toggle (Follow only), Readable/True-scale switch, controls hint.
- **TimeBar:** UTC date; Reverse, Play/Pause, speed, Now; "Go to date" accepts `YYYY-MM-DD[ HH:MM[:SS]]` for years −4712 to 9999 and rejects impossible dates (including the missing days of October 1582). Shows an amber note outside 1800–2050 and an extrapolation warning outside 3000 BC–AD 3000.
- **InfoPanel:** name, kind, NASA description, physical and orbital facts, each with a numbered citation that links to the source list. Also live distances (from the Sun and Earth, light time) and accuracy lines (JPL nominal plus the error measured against Horizons). Values a source lists as unknown are omitted.
- **Status screens:** loading, data error with "Try again", and "3D graphics are not available" when WebGL is missing.
- **Look:** dark observatory style; Inter for text, JetBrains Mono for numbers; accent `#7cc4ff`, amber `#ffb454` for warnings; panels become bottom sheets below 720 px.
