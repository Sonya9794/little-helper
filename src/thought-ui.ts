import { listen } from '@tauri-apps/api/event';
import { button, el, invoke } from './api';
import { paintScene, sceneCanvas } from './scene';
import { chooseThought, type ThoughtSettings } from './thought-model';
import { thoughtLayout } from './thought-layout';
interface View { settings: ThoughtSettings; pending: boolean; revealed: boolean }
export async function thoughtUI(root: HTMLElement): Promise<void> {
  document.body.classList.add('thought');
  const canvas=sceneCanvas(root);canvas.setAttribute('aria-hidden','true');
  let text:string|null=null,busy=false,queued=false,lastKey='';
  const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/0x100000000;
  async function update():Promise<void>{
    if(busy){queued=true;return;}busy=true;
    try{
      const view=await invoke<View>('thought_poll');
      const key=JSON.stringify(view),changed=key!==lastKey;lastKey=key;
      if(changed)root.querySelectorAll('button,p').forEach(node=>node.remove());
      if(!view.pending){text=null;return;}
      if(view.revealed&&text===null)text=chooseThought(view.settings,random());
      if(changed){
        if(view.revealed){
          const message=el('p',text??'','thought-message');message.setAttribute('role','status');
          const pop=button('Pop',()=>{void invoke('dismiss_thought').then(update);});pop.className='thought-pop';
          message.style.visibility=pop.style.visibility='hidden';root.append(message,pop);
        }else{
          const reveal=button('…',()=>{void invoke('reveal_thought').then(update);});reveal.className='thought-reveal';
          reveal.setAttribute('aria-label','Read Helper thought');reveal.style.visibility='hidden';root.append(reveal);
        }
      }
      const message=root.querySelector<HTMLElement>('.thought-message'),pop=root.querySelector<HTMLButtonElement>('.thought-pop');
      const layout=view.revealed&&message&&pop?thoughtLayout(message.getBoundingClientRect().width,message.getBoundingClientRect().height,pop.getBoundingClientRect().width,pop.getBoundingClientRect().height):null;
      const width=layout?.width??96,height=layout?.height??96;
      await invoke('size_thought',{width,height});
      await paintScene(canvas,(ctx,metrics)=>{
        ctx.scale(metrics.width/width,metrics.height/height);
        root.classList.toggle('thought-mirrored',metrics.mirror_x);
        if(metrics.mirror_x){ctx.translate(width,0);ctx.scale(-1,1);}
        ctx.fillStyle='#fffdf5';ctx.strokeStyle='#327d68';ctx.lineWidth=2;ctx.beginPath();
        if(layout)ctx.roundRect(8,8,width-16,layout.bodyHeight,22);else ctx.ellipse(48,40,38,28,0,0,Math.PI*2);
        ctx.fill();ctx.stroke();
        const bottom=layout?8+layout.bodyHeight:68;
        for(const [x,y,r]of [[layout?28:23,bottom+8,6],[14,bottom+19,3]]){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();}
        if(layout&&message&&pop){
          Object.assign(message.style,{left:`${layout.textX}px`,top:`${layout.textY}px`});
          Object.assign(pop.style,{left:`${layout.popX}px`,top:`${layout.popY}px`});
        }
        root.querySelectorAll<HTMLElement>('button,p').forEach(node=>{node.style.visibility='visible';});
      });
    }catch(cause){console.error('Helper Thoughts:',cause);}
    finally{busy=false;if(queued){queued=false;void update();}}
  }
  await listen('thoughts-changed',()=>{void update();});
  window.addEventListener('resize',()=>{void update();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();void invoke('dismiss_thought').then(update);}});
  setInterval(()=>{void update();},1000);await update();
}
