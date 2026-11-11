import {el} from './api';
import {rangeMinute,rangeHandle,moveThoughtHandle,type ThoughtHandle} from './thought-range-model';
export function thoughtRange(minimum:number,maximum:number,save:(min:number,max:number)=>void):HTMLElement {
  const group=el('div',undefined,'thought-interval');group.setAttribute('role','group');group.setAttribute('aria-label','Time between Helper Thoughts');
  const heading=el('p','Time Between Thoughts');const values=el('output');values.setAttribute('aria-live','polite');
  const slider=el('div',undefined,'thought-dual-slider');const track=el('div',undefined,'thought-range-track'),fill=el('div',undefined,'thought-range-fill');track.append(fill);slider.append(track);
  const low=el('input'),high=el('input');let min=minimum,max=maximum,keyboardDirty=false;
  for(const [input,key,label]of [[low,'min','Minimum minutes between thoughts'],[high,'max','Maximum minutes between thoughts']]as const){
    input.type='range';input.min='1';input.max='30';input.step='1';input.className='thought-dual-input';input.dataset.focus=`thought-${key}`;input.setAttribute('aria-label',label);
    input.oninput=()=>{keyboardDirty=true;[min,max]=moveThoughtHandle(min,max,key,Number(input.value));draw();};
    // Programmatic pointer updates can emit a deferred change when a handle
    // blurs. Only keyboard input saves here; pointer gestures save on release.
    input.onchange=()=>{if(keyboardDirty){keyboardDirty=false;save(min,max);}};slider.append(input);
  }
  function draw():void {
    low.value=String(min);high.value=String(max);low.setAttribute('aria-valuetext',`${min} minute${min===1?'':'s'}`);high.setAttribute('aria-valuetext',`${max} minute${max===1?'':'s'}`);
    fill.style.left=`${(min-1)/29*100}%`;fill.style.width=`${(max-min)/29*100}%`;
    values.textContent=min===max?`Every ${min} minute${min===1?'':'s'}`:`Randomly every ${min}–${max} minutes`;
  }
  let drag:{pointer:number;startX:number;handle:ThoughtHandle|null;min:number;max:number}|null=null;
  const valueAt=(x:number)=>{const r=slider.getBoundingClientRect();return rangeMinute(x,r.left+10,r.width-20);};
  function move(x:number):void {
    if(!drag)return;
    if(drag.handle===null){if(Math.abs(x-drag.startX)<1)return;drag.handle=rangeHandle(valueAt(x),drag.min,drag.max,x-drag.startX);}
    if(drag.handle){[min,max]=moveThoughtHandle(min,max,drag.handle,valueAt(x));(drag.handle==='min'?low:high).focus();draw();}
  }
  slider.onpointerdown=event=>{
    if(event.button!==0||low.matches(':disabled'))return;event.preventDefault();
    const value=valueAt(event.clientX);drag={pointer:event.pointerId,startX:event.clientX,handle:rangeHandle(value,min,max),min,max};slider.setPointerCapture(event.pointerId);move(event.clientX);
  };
  slider.onpointermove=event=>{if(drag?.pointer===event.pointerId)move(event.clientX);};
  slider.onpointerup=event=>{
    if(drag?.pointer!==event.pointerId)return;move(event.clientX);const before=drag;drag=null;slider.releasePointerCapture(event.pointerId);
    if(min!==before.min||max!==before.max)save(min,max);else (before.handle==='min'?low:high).focus();
  };
  const cancel=()=>{if(drag){min=drag.min;max=drag.max;drag=null;draw();}};slider.onpointercancel=cancel;slider.onlostpointercapture=cancel;
  group.append(heading,values,slider,el('p','1–30 minutes · Drag either handle or use Tab and arrow keys. Equal handles use a fixed interval.','muted'));draw();return group;
}
