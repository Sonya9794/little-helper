export interface ThoughtLayout { width: number; height: number; bodyHeight: number; textX: number; textY: number; popX: number; popY: number }
// Measure real font wrapping before drawing or installing the matching alpha.
export function thoughtLayout(textWidth: number, textHeight: number, popWidth: number, popHeight: number): ThoughtLayout {
  if ([textWidth,textHeight,popWidth,popHeight].some(n=>!Number.isFinite(n)||n<0)) throw Error('Invalid thought content measurements.');
  const width=Math.min(280,Math.max(120,Math.ceil(Math.max(textWidth,popWidth)+44)));
  const bodyHeight=Math.max(64,Math.ceil(textHeight+popHeight+26));
  return {width,height:bodyHeight+32,bodyHeight,textX:22,textY:18,popX:width-22-popWidth,popY:8+bodyHeight-10-popHeight};
}
