import { el, button } from './api';
import { PRESET_COLORS, hexToHsv, hsvToHex, wheelColor, rowInk } from './todo-colors';
export function colorPicker(initial: string, save: (color: string) => Promise<void>, closed: () => void): HTMLDialogElement {
  const dialog = el('dialog'); dialog.className = 'todo-color-picker'; dialog.setAttribute('aria-labelledby','row-color-title');
  const title = el('h2','Row Color'); title.id = 'row-color-title'; dialog.append(title);
  let selected = initial.toLowerCase(); let hsv = hexToHsv(selected);
  const palette = el('div',undefined,'todo-palette'); palette.setAttribute('role','group'); palette.setAttribute('aria-label','Preset row colors');
  const colorNames = ['Cream','Yellow','Peach','Rose','Lavender','Sky Blue','Teal','Mint','Lime','Gray','Blue','Sand'];
  const swatches: HTMLButtonElement[] = [];
  for (const [index,color] of PRESET_COLORS.entries()) {
    const swatch = button('',()=>setColor(color)); swatch.style.backgroundColor=color; swatch.title=`${colorNames[index]} (${color})`;
    swatch.setAttribute('aria-label',swatch.title); palette.append(swatch); swatches.push(swatch);
  }
  const custom=el('details');custom.append(el('summary','Custom Color Wheel'));dialog.append(palette,custom);
  const wheelArea = el('div',undefined,'todo-wheel-area');
  const canvas = el('canvas'); canvas.width = 180; canvas.height = 180; canvas.className = 'todo-color-wheel';
  canvas.setAttribute('role','img'); canvas.setAttribute('aria-label','Color wheel: drag to choose hue and saturation, or use the sliders below.');
  const marker = el('span',undefined,'todo-wheel-marker'); marker.setAttribute('aria-hidden','true'); wheelArea.append(canvas,marker); custom.append(wheelArea);
  const context = canvas.getContext('2d')!; const pixels = context.createImageData(180,180);
  for (let y=0;y<180;y++) for(let x=0;x<180;x++) {
    const dx=x-89.5,dy=y-89.5; if(Math.hypot(dx,dy)>89)continue;
    const color=wheelColor(dx,dy,89,1);const offset=(y*180+x)*4;
    pixels.data[offset]=parseInt(color.slice(1,3),16);pixels.data[offset+1]=parseInt(color.slice(3,5),16);pixels.data[offset+2]=parseInt(color.slice(5,7),16);pixels.data[offset+3]=255;
  }
  context.putImageData(pixels,0,0);
  const range = (label: string, max: number, change: (value: number)=>void) => {
    const wrapper=el('label',label); const input=el('input'); input.type='range';input.min='0';input.max=String(max);input.step='1';input.setAttribute('aria-label',label);
    input.oninput=()=>change(Number(input.value));wrapper.append(input);custom.append(wrapper);return input;
  };
  const hue=range('Hue',360,value=>{hsv.hue=value;setFromHsv();});
  const saturation=range('Saturation',100,value=>{hsv.saturation=value/100;setFromHsv();});
  const brightness=range('Brightness',100,value=>{hsv.value=value/100;setFromHsv();});
  const form=el('form');const hexLabel=el('label','Hex Color');const hex=el('input');hex.type='text';hex.pattern='#[0-9a-fA-F]{6}';hex.required=true;hex.maxLength=7;hex.setAttribute('aria-label','Hex Color');hexLabel.append(hex);
  const preview=el('div','Preview','todo-color-preview');const message=el('p','','error');message.setAttribute('role','alert');
  function update(): void {
    hex.value=selected;hue.value=String(Math.round(hsv.hue));saturation.value=String(Math.round(hsv.saturation*100));brightness.value=String(Math.round(hsv.value*100));
    canvas.style.filter=`brightness(${hsv.value})`;preview.style.backgroundColor=selected;preview.style.color=rowInk(selected);
    marker.style.left=`${90+Math.cos(hsv.hue*Math.PI/180)*89*hsv.saturation}px`;marker.style.top=`${90+Math.sin(hsv.hue*Math.PI/180)*89*hsv.saturation}px`;
    swatches.forEach((swatch,index)=>swatch.setAttribute('aria-pressed',String(PRESET_COLORS[index]===selected)));
  }
  function setColor(color: string): void { selected=color.toLowerCase();hsv=hexToHsv(selected);update(); }
  function setFromHsv(): void { selected=hsvToHex(hsv.hue,hsv.saturation,hsv.value);update(); }
  hex.oninput=()=>{if(/^#[0-9a-fA-F]{6}$/.test(hex.value))setColor(hex.value);};
  const pick=(event:PointerEvent)=>{const bounds=canvas.getBoundingClientRect();const x=(event.clientX-bounds.left)*180/bounds.width-90,y=(event.clientY-bounds.top)*180/bounds.height-90;setColor(wheelColor(x,y,89,hsv.value));};
  canvas.onpointerdown=event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);pick(event);};
  canvas.onpointermove=event=>{if(event.buttons&1)pick(event);};
  const close=()=>{dialog.close();dialog.remove();closed();};
  const apply=el('button','Apply Color');apply.type='submit';
  form.onsubmit=event=>{event.preventDefault();apply.disabled=true;message.textContent='';void save(selected).then(close).catch(error=>{message.textContent=String(error);apply.disabled=false;});};
  form.append(hexLabel,preview,message,apply,button('Cancel',close));dialog.append(form);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});update();return dialog;
}
