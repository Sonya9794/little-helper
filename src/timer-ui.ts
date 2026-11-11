import {button,el,invoke} from './api';
import {defaultTimerDraft,draftFromTimer,timerConfig,timerText,type TimerDraft,type TimerMode,type TimerView} from './timer-model';
export async function timerUI(root:HTMLElement):Promise<void>{
  document.body.classList.add('timer');
  let view:TimerView|null=null,mode:TimerMode='normal',draft=defaultTimerDraft(),busy=false,error='',polling=false,generation=0;
  const active=()=>view?.status==='running'||view?.status==='paused';
  const phaseKey=(s:TimerView|null)=>s?`${s.mode}:${s.status}:${s.phase}:${s.round}`:'';
  function note():string {
    if(!view||view.status==='idle')return 'Ready';
    if(view.status==='complete')return view.mode==='pomodoro'?'All rounds complete!':'Time is up!';
    const phase=view.mode==='pomodoro'?`${view.phase==='work'?'Work':'Break'} · Round ${view.round} of ${view.rounds}`:view.mode==='stopwatch'?'Stopwatch':'Countdown';
    return `${phase}${view.status==='paused'?' · Paused':''}`;
  }
  function readout():void {
    const clock=root.querySelector('#timer-clock');if(!clock)return;
    let value=0,countdown=mode!=='stopwatch';
    if(view&&view.status!=='idle'){countdown=view.mode!=='stopwatch';value=countdown?view.remaining_ms??0:view.elapsed_ms;}
    else if(mode!=='stopwatch'){try{const c=timerConfig(mode,draft);value=(mode==='normal'?c.normal_seconds:c.work_seconds)*1000;}catch{/* Form explains invalid values on Start. */}}
    clock.textContent=timerText(value,countdown);
    const status=root.querySelector('#timer-status');if(status&&status.textContent!==note())status.textContent=note();
  }
  async function action(command:string,args?:Record<string,unknown>):Promise<void>{
    if(busy)return;const focus=(document.activeElement as HTMLElement|null)?.dataset.focus;generation++;busy=true;error='';render();
    try{view=await invoke<TimerView>(command,args);}catch(cause){error=String(cause);}finally{busy=false;render();
      const target=focus?root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]:not(:disabled)`):null;
      (target??root.querySelector<HTMLElement>('.timer-controls button:not(:disabled)'))?.focus();
    }
  }
  function render():void {
    const focus=(document.activeElement as HTMLElement|null)?.dataset.focus;
    root.replaceChildren();const header=el('header');header.append(el('h1','Timer'),button('← Back to Lock In',()=>{void invoke('close_timer').catch(cause=>{error=String(cause);render();});}));root.append(header);
    if(error){const alert=el('p',error,'error');alert.setAttribute('role','alert');root.append(alert);}
    if(!view){root.append(el('p','Loading timer…'),button('Retry',()=>{void load();}));return;}
    const modes=el('fieldset',undefined,'timer-modes');modes.append(el('legend','Mode'));modes.disabled=busy||active();
    for(const [value,label]of [['normal','Normal'],['pomodoro','Pomodoro'],['stopwatch','Stopwatch']]as const){
      const wrapper=el('label');const input=el('input');input.type='radio';input.name='timer-mode';input.value=value;input.checked=mode===value;input.dataset.focus=`timer-mode-${value}`;
      input.onchange=()=>{mode=value;void action('reset_timer');};wrapper.append(input,document.createTextNode(label));modes.append(wrapper);
    }
    root.append(modes);
    const display=el('section',undefined,'timer-display');const digits=el('div','00:00:00');digits.id='timer-clock';digits.setAttribute('aria-label','Timer time');
    const status=el('p');status.id='timer-status';status.setAttribute('role','status');display.append(digits,status);root.append(display);
    const form=el('form');const fields=el('fieldset',undefined,`timer-fields timer-fields-${mode}`);fields.disabled=busy||active();fields.append(el('legend',mode==='normal'?'Duration':mode==='pomodoro'?'Pomodoro setup':'Stopwatch'));
    function field(key:keyof TimerDraft,label:string,min:number,max:number):void{
      const wrap=el('label',label);const input=el('input');input.type='number';input.min=String(min);input.max=String(max);input.step='1';input.required=true;input.value=active()?draftFromTimer(view!.config)[key]:draft[key];input.dataset.focus=`timer-${key}`;
      input.oninput=()=>{draft={...draft,[key]:input.value};readout();summary();};wrap.append(input);fields.append(wrap);
    }
    if(mode==='normal'){field('hours','Hours',0,24);field('minutes','Minutes',0,59);field('seconds','Seconds',0,59);}
    else if(mode==='pomodoro'){field('work','Starting Work (minutes)',1,1440);field('break','Starting Break (minutes)',1,1440);field('decrease','Work Decrease per Round (minutes)',0,1440);field('rounds','Rounds',1,100);}
    else fields.append(el('p','Counts upward until you pause or reset.'));
    form.append(fields);const info=el('p',undefined,'muted');info.id='timer-plan';form.append(info);
    const controls=el('div',undefined,'timer-controls');
    if(active()){
      const control=button(view.status==='running'?'Pause':'Resume',()=>{void action(view?.status==='running'?'pause_timer':'resume_timer');},'timer-toggle');control.disabled=busy;controls.append(control);
    }else{
      const start=el('button',view.status==='complete'?'Start Again':'Start');start.type='submit';start.disabled=busy;start.dataset.focus='timer-start';controls.append(start);
    }
    const reset=button('Reset',()=>{void action('reset_timer');},'timer-reset');reset.disabled=busy||view.status==='idle';controls.append(reset);form.append(controls);
    form.onsubmit=event=>{event.preventDefault();try{void action('start_timer',{mode,config:timerConfig(mode,draft)});}catch(cause){error=String(cause instanceof Error?cause.message:cause);render();}};
    root.append(form,el('p','Keeps running while this window is closed or the app is in the tray. Phase changes and completion appear here. Quitting the app clears the timer.','muted'));
    root.setAttribute('aria-busy',String(busy));readout();summary();
    if(focus)root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`)?.focus();
  }
  function summary():void {
    const info=root.querySelector('#timer-plan');if(!info)return;
    if(mode!=='pomodoro'){info.textContent=active()?'Reset to edit the mode or duration.':'';return;}
    try{const c=active()&&view?view.config:timerConfig(mode,draft);const last=c.work_seconds-c.decrease_seconds*(c.rounds-1);
      info.textContent=`Work: ${timerText(c.work_seconds*1000)} → ${timerText(last*1000)}. Breaks stay at ${timerText(c.break_seconds*1000)}. Ends after the last work period.`;
    }catch(cause){info.textContent=String(cause instanceof Error?cause.message:cause);}
  }
  async function load():Promise<void>{try{view=await invoke<TimerView>('timer_state');mode=view.mode;if(active())draft=draftFromTimer(view.config);}catch(cause){error=String(cause);}render();}
  async function poll():Promise<void>{
    if(polling||busy)return;polling=true;const version=generation;
    try{const next=await invoke<TimerView>('timer_state');if(version!==generation||busy)return;const changed=phaseKey(next)!==phaseKey(view);view=next;if(active())mode=next.mode;if(changed)render();else readout();}
    catch(cause){if(!error){error=String(cause);render();}}finally{polling=false;}
  }
  window.addEventListener('focus',()=>{void poll();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();void invoke('close_timer');}});
  setInterval(()=>{if(!document.hidden)void poll();},200);await load();
}
