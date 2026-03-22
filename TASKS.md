# Travian Offline Task List

Last updated: 2026-03-21

## Current tranche

- [done] 1. Add engine-level automated tests for economy, movement, combat, conquest, settlement, and persistence-safe flows.
- [in progress] 2. Improve the command/report system with stricter command legality and clearer visibility.
- [todo] 3. Finish classic conquest rules: administration destruction, capital restrictions, loyalty recovery tuning, and catapult targeting.
- [todo] 4. Add hero and oasis mechanics.
- [todo] 5. Add scouting, hidden information, and fog-of-war.
- [todo] 6. Deepen marketplace logistics with better routing, recurring shipments, and stronger trade UX.
- [todo] 7. Improve village founding flow, CP planning, and AI settlement behavior.
- [todo] 8. Implement real AI personalities and tribe-aware doctrine.
- [todo] 9. Add one constrained local-LLM major ruler with deterministic execution.
- [in progress] 10. Upgrade the presentation layer with richer map, village, and report visuals.

## Notes

- This pass is focused on building a safety net first, then tightening gameplay legality where the new tests expose gaps.
- Command legality tightened in this pass: conquest now requires a valid expansion slot commitment instead of allowing free chiefing from an unexpanded village.
- Command system depth in this pass: outbound troop and shipment commands can now be recalled, with automated coverage and UI controls.
- Presentation pass in progress: replacing list-style field and center grids with spatial village scenes, and promoting the world overview into a larger atlas view.
- Presentation polish in progress: compact illustrated slot tokens, map tile art, and hover cleanup so the new spatial views feel stable instead of card-heavy.
- After the test harness is stable, the next implementation priority is command/report depth plus AI personalities.
