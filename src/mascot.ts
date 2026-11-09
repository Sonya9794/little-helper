import { listen } from '@tauri-apps/api/event';
import { invoke, el } from './api';
import { paintScene } from './scene';
import { MascotHover } from './mascot-hover';
import { MascotReaction } from './mascot-reaction';
import { ChessMascot } from './chess-mascot';
import type { ReactionKind } from './chess-api';

// Rendering contract: draw the replaceable artwork, then send precisely its rendered
// physical-pixel alpha values to the native input-shape adapter on every animation frame.
export async function mascot(root: HTMLElement): Promise<void> {
  document.body.classList.add('mascot');
  const canvas = el('canvas'); canvas.setAttribute('aria-label', 'Little Helper: click for menu, drag to move, right-click for tray options');
  canvas.setAttribute('role', 'button'); canvas.tabIndex = 0;
  root.append(canvas);
  const image = new Image(); image.src = '/mascot.svg'; await image.decode();
  const excitedImage = new Image(); excitedImage.src = '/mascot-excited.svg'; await excitedImage.decode();
  const staringImage = new Image(); staringImage.src = '/mascot-staring.svg'; await staringImage.decode();
  const angryImage = new Image(); angryImage.src = '/mascot-angry.svg'; await angryImage.decode();
  const hover = new MascotHover();
  const reaction = new MascotReaction();
  const chessReaction = new ChessMascot();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animationFrame = 0;
  let reactionTimer: ReturnType<typeof setTimeout> | undefined;
  let rendering = false; let queued = false;
  async function draw(): Promise<void> {
    if (rendering) { queued = true; return; }
    rendering = true;
    clearTimeout(reactionTimer);
    let moving = false;
    let nextChange = 0;
    try {
      await paintScene(canvas, (ctx, metrics) => {
        const now = performance.now();
        const frame = hover.frame(now);
        const response = reaction.frame(now, reducedMotion.matches);
        const reacting = response.pose !== 'idle';
        const chess = chessReaction.frame(now, reducedMotion.matches);
        moving = chess.active ? chess.moving : response.pose === 'shaking' || (!reacting && frame.moving);
        nextChange = chess.active ? chess.until : response.pose === 'staring' ? response.until : 0;
        const artwork = chess.active ? ({ excited: excitedImage, staring: staringImage, angry: angryImage }[chess.art])
          : response.pose === 'staring' ? (response.angry ? angryImage : staringImage) : response.pose === 'shaking' || frame.excited ? excitedImage : image;
        ctx.save();
        ctx.translate(metrics.width / 2 + (chess.active ? 0 : response.x) * metrics.width / 128,
          metrics.height / 2 + (chess.active ? chess.y : reacting ? response.y : frame.offset) * metrics.height / 128);
        ctx.rotate(chess.active ? 0 : response.rotation); ctx.scale(chess.active ? chess.scale : response.scale, chess.active ? chess.scale : response.scale);
        ctx.drawImage(artwork, -metrics.width / 2, -metrics.height / 2, metrics.width, metrics.height);
        ctx.restore();
      });
    } catch (error) {
      await invoke('ui_error', { message: String(error) });
    } finally {
      rendering = false;
      if (queued || moving) {
        queued = false;
        if (!animationFrame) animationFrame = requestAnimationFrame(() => { animationFrame = 0; void draw(); });
      } else if (nextChange) {
        reactionTimer = setTimeout(() => { void draw(); }, Math.max(1, nextChange - performance.now()));
      }
    }
  }
  await listen('mask-refresh', () => { void draw(); });
  await listen<{ kind: ReactionKind; energy: number }>('chess-reaction', event => {
    hover.reset(); reaction.reset(); chessReaction.start(event.payload.kind, event.payload.energy, performance.now()); void draw();
  });
  await listen('chess-reaction-reset', () => { chessReaction.reset(); void draw(); });
  window.addEventListener('resize', () => { void draw(); });
  let press: { x: number; y: number; dragged: boolean } | null = null;
  const setHovered = (hovered: boolean) => {
    void invoke('motion_hover', { hovered }).catch(error => invoke('ui_error', { message: String(error) }));
  };
  canvas.onpointerenter = event => {
    setHovered(true);
    if (event.buttons || press) return;
    const now = performance.now();
    if (reaction.frame(now, reducedMotion.matches).pose === 'idle') hover.enter(now, reducedMotion.matches);
    void draw();
  };
  canvas.onpointerleave = () => { setHovered(false); hover.leave(); void draw(); };
  window.addEventListener('blur', () => { hover.leave(); void draw(); });
  let suppressClick = false;
  const openChoices = () => { reaction.reset(); hover.activate(); void draw(); void invoke('show_menu').catch(error => invoke('ui_error', { message: String(error) })); };
  canvas.onpointerdown = event => {
    if (event.button !== 0) return;
    reaction.reset();
    chessReaction.reset();
    hover.activate(); void draw();
    suppressClick = false;
    press = { x: event.screenX, y: event.screenY, dragged: false };
    canvas.setPointerCapture(event.pointerId);
  };
  canvas.onpointermove = event => {
    if (!event.buttons && !press) {
      const now = performance.now();
      reaction.move(event.screenX, event.screenY, now);
      if (reaction.frame(now, reducedMotion.matches).pose !== 'idle') void draw();
      return;
    }
    if (!press || press.dragged || !(event.buttons & 1)) return;
    if (Math.hypot(event.screenX - press.x, event.screenY - press.y) >= 4) {
      press.dragged = true;
      suppressClick = true;
      // Native window dragging takes over the mouse and may consume pointerup.
      // Release our press state now so the next hover is not blocked forever.
      press = null;
      hover.reset(); void draw();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      void invoke('start_drag').catch(error => invoke('ui_error', { message: String(error) }));
    }
  };
  canvas.onpointerup = event => {
    if (event.button !== 0) return;
    press = null;
  };
  canvas.onclick = event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false; openChoices();
  };
  canvas.onkeydown = event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); suppressClick = false; openChoices(); }
  };
  canvas.onpointercancel = () => { press = null; };
  canvas.oncontextmenu = event => {
    event.preventDefault(); press = null;
    reaction.reset();
    hover.activate(); void draw();
    void invoke('context_menu').catch(error => invoke('ui_error', { message: String(error) }));
  };
  await draw();
}
