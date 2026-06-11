# Holiday Themes

Holiday Themes are cosmetic map variants that load specific prop layers over standard map visuals to celebrate seasonal events.

## Implementation Details

- **Triggering:** Themes are conditionally loaded either via system date checks (e.g., checking if the current month is October or December) or by explicitly setting a `MatchConfig` override for custom matches.
- **Cosmetics:** These overlays do not alter the physical geometry or collision rules of the map. They only add visual flair:
  - Thanksgiving turkeys.
  - Christmas snow particles and festive lights.
  - Halloween pumpkins and spooky lighting.
