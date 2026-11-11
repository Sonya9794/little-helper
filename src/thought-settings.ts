import {el} from './api';
import type {ThoughtSettings} from './thought-model';
import {thoughtRange} from './thought-range';
export function thoughtSettingsUI(settings:ThoughtSettings|null,error:string,save:(settings:ThoughtSettings)=>Promise<void>):HTMLElement {
  const section=el('section');
  section.append(el('p','Click a mini … bubble to read a thought. Ignored mini bubbles disappear after 2 minutes. Pop starts a fresh wait. All messages are bundled offline.','muted'));
  if(error){const alert=el('p',error,'error');alert.setAttribute('role','alert');section.append(alert);}
  if(!settings)return section;
  function commit(next:ThoughtSettings):void {section.querySelectorAll('input').forEach(input=>{input.disabled=true;});void save(next);}
  const masterLabel=el('label',undefined,'thought-master');const master=el('input');master.type='checkbox';master.checked=settings.enabled;master.dataset.focus='thought-enabled';
  master.onchange=()=>commit({...settings,enabled:master.checked});masterLabel.append(master,document.createTextNode('Enable Helper Thoughts'));section.append(masterLabel);
  const options=el('fieldset',undefined,'thought-options');options.disabled=!settings.enabled;options.append(el('legend','Thought Options'));
  options.append(thoughtRange(settings.min_minutes,settings.max_minutes,(min,max)=>commit({...settings,min_minutes:min,max_minutes:max})));
  const toggles=el('div',undefined,'thought-toggles');
  for(const [key,title]of [['jokes','Jokes'],['facts','Fun Facts'],['motivation','Motivational Quotes']]as const){
    const label=el('label');const input=el('input');input.type='checkbox';input.checked=settings[key];input.dataset.focus=`thought-${key}`;
    input.onchange=()=>commit({...settings,[key]:input.checked});label.append(input,document.createTextNode(title));toggles.append(label);
  }
  options.append(toggles);section.append(options,el('p',!settings.enabled?'Off: no bubbles will appear.':!settings.jokes&&!settings.facts&&!settings.motivation?'All categories are off: no bubbles will appear.':'Enabled categories supply the next random thought.','muted'));
  return section;
}
