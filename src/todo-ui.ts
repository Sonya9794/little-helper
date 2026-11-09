import { invoke, el, button } from './api';
import { colorPicker } from './todo-picker';
import { durationMinutes, rowInk } from './todo-colors';
export interface TodoTask { id: number; checked: boolean; task: string; deadline: string | null; time_needed_minutes: number | null; color: string }
interface TodoStore { tasks: TodoTask[] }
type TodoEdit = {kind:'add';task:string}|{kind:'rename';id:number;task:string}|{kind:'check';id:number;checked:boolean}|{kind:'deadline';id:number;deadline:string|null}|{kind:'duration';id:number;minutes:number|null}|{kind:'color';id:number;color:string}|{kind:'delete';id:number};
export async function todoUI(root: HTMLElement): Promise<void> {
  document.body.classList.add('todo');
  let state: TodoStore | null=null,error='',newTask='',pending=0;let queue:Promise<void>=Promise.resolve();let picker:HTMLDialogElement|null=null;
  async function load(): Promise<void> { try {state=await invoke<TodoStore>('todo_state');error='';} catch(cause) {state=null;error=String(cause);}render(); }
  function edit(action:TodoEdit,after?:()=>void):Promise<void> {
    pending++;
    const operation=queue.then(async()=>{
      try {state=await invoke<TodoStore>('edit_todo',{edit:action});error='';after?.();}
      catch(cause){error=String(cause);throw cause;}
      finally{pending--;render();}
    });
    queue=operation.catch(()=>{});return operation;
  }
  const commit=(action:TodoEdit)=>{void edit(action).catch(()=>{});};
  function render():void {
    const active=document.activeElement as HTMLInputElement|null;const key=active?.dataset.focus;
    const draft=active instanceof HTMLInputElement && ['text','number','datetime-local'].includes(active.type)?active.value:null;
    root.replaceChildren();const header=el('header');header.append(el('h1','To-Do List'),button('← Back to Lock In',()=>{void invoke('close_todo',{back:true});}));root.append(header);
    if(error){const alert=el('p',error,'error');alert.setAttribute('role','alert');root.append(alert);}
    if(!state){root.append(el('p',error?'Your to-do file has not been replaced.':'Loading local tasks…'),button('Retry',()=>{void load();}));return;}
    root.append(el('p','Deadlines use local date and time. Time Needed is an estimate in hours and minutes. Changes save on Enter or leaving a field.','muted'));
    const wrap=el('div',undefined,'todo-table-wrap');const table=el('table',undefined,'todo-table');const caption=el('caption','Tasks');caption.className='visually-hidden';table.append(caption);
    const head=el('thead');const headerRow=el('tr');
    for(const label of ['✓','Task','Deadline','Time Needed']){const cell=el('th',label);cell.scope='col';if(label==='✓')cell.setAttribute('aria-label','Completed');headerRow.append(cell);}head.append(headerRow);table.append(head);
    const body=el('tbody');
    for(const task of state.tasks){
      const row=el('tr');row.style.backgroundColor=task.color;row.style.setProperty('--todo-ink',rowInk(task.color));row.classList.toggle('dark-row',rowInk(task.color)==='#ffffff');row.classList.toggle('task-complete',task.checked);
      const checkedCell=el('td');const checked=el('input');checked.type='checkbox';checked.checked=task.checked;checked.dataset.focus=`todo-check-${task.id}`;checked.setAttribute('aria-label',`Complete: ${task.task}`);
      checked.onchange=()=>commit({kind:'check',id:task.id,checked:checked.checked});checkedCell.append(checked);
      const taskCell=el('td');const name=el('input');name.type='text';name.value=task.task;name.required=true;name.maxLength=2000;name.className='todo-task-name';name.dataset.focus=`todo-name-${task.id}`;name.setAttribute('aria-label',`Task: ${task.task}`);
      name.onchange=()=>commit({kind:'rename',id:task.id,task:name.value});
      const controls=el('div',undefined,'todo-row-tools');const color=button('Color',()=>{
        if(picker)return;
        picker=colorPicker(task.color,value=>edit({kind:'color',id:task.id,color:value}),()=>{picker=null;root.querySelector<HTMLButtonElement>(`[data-focus="todo-color-${task.id}"]`)?.focus();});
        document.body.append(picker);picker.showModal();
      },`todo-color-${task.id}`);
      const sample=el('span',undefined,'todo-color-sample');sample.style.backgroundColor=task.color;sample.setAttribute('aria-hidden','true');color.prepend(sample);color.setAttribute('aria-label',`Row color for ${task.task}`);
      controls.append(color,button('Delete',()=>commit({kind:'delete',id:task.id}),`todo-delete-${task.id}`));taskCell.append(name,controls);
      const deadlineCell=el('td');const deadline=el('input');deadline.type='datetime-local';deadline.step='60';deadline.value=task.deadline??'';deadline.dataset.focus=`todo-deadline-${task.id}`;deadline.setAttribute('aria-label',`Deadline for ${task.task}`);
      deadline.onchange=()=>{if(deadline.validity.valid)commit({kind:'deadline',id:task.id,deadline:deadline.value||null});else{error='Choose a valid deadline.';render();}};deadlineCell.append(deadline);
      const durationCell=el('td');const duration=el('div',undefined,'todo-duration');
      const hours=el('input'),minutes=el('input');
      for(const [input,unit,max] of [[hours,'hours',null],[minutes,'minutes','59']] as const){input.type='number';input.min='0';input.step='1';if(max)input.max=max;input.placeholder=unit==='hours'?'h':'m';input.dataset.focus=`todo-${unit}-${task.id}`;input.setAttribute('aria-label',`Time Needed ${unit} for ${task.task}`);const label=el('label');label.append(input,el('span',unit==='hours'?'h':'m'));duration.append(label);}
      hours.value=task.time_needed_minutes===null?'':String(Math.floor(task.time_needed_minutes/60));minutes.value=task.time_needed_minutes===null?'':String(task.time_needed_minutes%60);
      const saveTime=()=>{try{commit({kind:'duration',id:task.id,minutes:durationMinutes(hours.value,minutes.value)});}catch(cause){error=String(cause);render();}};hours.onchange=saveTime;minutes.onchange=saveTime;durationCell.append(duration);
      for(const input of [name,deadline,hours,minutes])input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}};
      row.append(checkedCell,taskCell,deadlineCell,durationCell);body.append(row);
    }
    table.append(body);wrap.append(table);root.append(wrap);
    if(!state.tasks.length)root.append(el('p','No tasks yet. Add your first task below.','muted'));
    const form=el('form',undefined,'todo-add');const label=el('label','New Task');const input=el('input');input.type='text';input.required=true;input.maxLength=2000;input.value=newTask;input.dataset.focus='todo-new';input.oninput=()=>{newTask=input.value;};label.append(input);const add=el('button','Add Task');add.type='submit';add.disabled=pending>0;
    form.append(label,add);form.onsubmit=event=>{event.preventDefault();add.disabled=true;const submitted=input.value;void edit({kind:'add',task:submitted},()=>{if(newTask===submitted)newTask='';}).catch(()=>{});};root.append(form);
    root.setAttribute('aria-busy',String(pending>0));
    if(key){const next=root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`);if(next){if(draft!==null&&next instanceof HTMLInputElement)next.value=key==='todo-new'?newTask:draft;next.focus();}}
  }
  window.addEventListener('focus',()=>{if(!pending&&!picker)void load();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!picker){event.preventDefault();void invoke('close_todo',{back:true});}});
  await load();
}
