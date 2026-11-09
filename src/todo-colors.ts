export const PRESET_COLORS = ['#fffdf5','#fff2b3','#ffd9ad','#ffd0db','#e0d5ff','#cce5ff','#c7f0f0','#d5efd0','#e8edb9','#e3e7eb','#cdd7ef','#e8d6c8'] as const;
export function hsvToHex(hue: number, saturation: number, value: number): string {
  const h = ((hue % 360) + 360) % 360 / 60, s = Math.max(0,Math.min(1,saturation)), v = Math.max(0,Math.min(1,value));
  const c = v*s, x = c*(1-Math.abs(h%2-1)), m = v-c;
  const rgb = h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return '#'+rgb.map(channel=>Math.round((channel+m)*255).toString(16).padStart(2,'0')).join('');
}
export function hexToHsv(hex: string): { hue: number; saturation: number; value: number } {
  const rgb = [1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255);
  const [r,g,b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb), delta = max-min;
  const raw = !delta ? 0 : max===r ? (g-b)/delta : max===g ? (b-r)/delta+2 : (r-g)/delta+4;
  return { hue: (raw*60+360)%360, saturation: max ? delta/max : 0, value: max };
}
export function wheelColor(x: number, y: number, radius: number, value: number): string {
  return hsvToHex(Math.atan2(y,x)*180/Math.PI,Math.min(1,Math.hypot(x,y)/radius),value);
}
export function rowInk(hex: string): '#000000' | '#ffffff' {
  const rgb = [1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  const light = rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  return (light+0.05)/0.05 >= 1.05/(light+0.05) ? '#000000' : '#ffffff';
}
export function durationMinutes(hours: string, minutes: string): number | null {
  const h = hours === '' ? 0 : Number(hours), m = minutes === '' ? 0 : Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h<0 || m<0 || m>59 || h*60+m>4294967295) throw new Error('Enter nonnegative whole hours and minutes from 0 to 59.');
  return h*60+m || null;
}
