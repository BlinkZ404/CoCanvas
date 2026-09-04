/** Shared look for agent drawing. A table of type is a failed board. */
export const DESIGN_SPEC = `This is a canvas. A typeset table of labels is a failed board. You must draw a diagram: nodes plus connectors, and score bars if there are numbers.

Paper: call set_background with #0a0a0a first so the void paper is visible (except a login or screen mock). Do not leave the default Night grey.

Copy: ASCII only. Never use an em dash or en dash. Never use curly quotes. Use a hyphen or a period.

Diagram (required):
- One title as kind text (fontSize 28, fill #f4f4f5)
- At least six nodes (rectangle or ellipse). Heading on line one (WHO GETS IT). Facts on the next line (Plus. Pro. Business. Enterprise.). Use a newline. Do not run the heading into the facts.
- On a product map, connect them as a tree. Hub at the top as a compact ellipse (about 320 by 100). Do not stretch the hub across the four children just to keep arrows vertical. The page bends those arrows. One arrow from the hub to Who, one to API, one to Capabilities, one to Rollout. Do not connect those four to each other. A side arrow into a sibling looks like it is going through the box
- Scores as charcoal bars: rectangle height 28, width scaled from the number (max 640), fill #2c2f36, stroke #2c2f36, number as text to the right. Same fill on every bar. Never call connect_elements on a bar, a score label, or a number. Cited scores are a list, not a flow
- Hairlines are optional section breaks, never the whole design

Space: 32px gap between every node. Never place kind text on a connector. Connector labels are one or two words. If two items would overlap, move them. The board can go to x 40-1400 and y 24-1600. The page zooms; do not cram the map into 800x560.

Palette: paper #0a0a0a, ink #f4f4f5, mute #8a8f98, node #16181d, stroke #3a3d44, bar #2c2f36. One accent only if needed: #9bb6ff. No rainbow cards. No stickies.

Always pass fill and stroke. Never omit them or you get the default candy blue.
For text, fill is the ink color.

If this is a login or screen mock, ignore the black paper. One column, white or dark fields, one ink button, match the live site.

If this is a flow, nodes plus arrows. Two fills plus one accent at most. Still no rainbow.`;

export function rectangleRole(el: { kind: string; width: number; height: number }): "rule" | "bar" | "row" | null {
  if (el.kind !== "rectangle") return null;
  if (el.height <= 4) return "rule";
  if (el.height >= el.width * 1.15) return "bar";
  if (el.width >= el.height * 2.5 && el.height <= 64) return "row";
  return null;
}

export function isDecorShape(el: { kind: string; width: number; height: number }): boolean {
  return rectangleRole(el) !== null;
}
