export type TimerMode='normal'|'pomodoro'|'stopwatch';
export interface TimerConfig {normal_seconds:number;work_seconds:number;break_seconds:number;decrease_seconds:number;rounds:number}
export interface TimerView {mode:TimerMode;status:'idle'|'running'|'paused'|'complete';config:TimerConfig;elapsed_ms:number;remaining_ms:number|null;phase:'countdown'|'work'|'break'|null;round:number;rounds:number;total_ms:number|null}
export interface TimerDraft {hours:string;minutes:string;seconds:string;work:string;break:string;decrease:string;rounds:string}
export function defaultTimerDraft():TimerDraft{return {hours:'0',minutes:'25',seconds:'0',work:'25',break:'5',decrease:'0',rounds:'4'};}
export function draftFromTimer(c:TimerConfig):TimerDraft{return {hours:String(Math.floor(c.normal_seconds/3600)),minutes:String(Math.floor(c.normal_seconds/60)%60),seconds:String(c.normal_seconds%60),work:String(c.work_seconds/60),break:String(c.break_seconds/60),decrease:String(c.decrease_seconds/60),rounds:String(c.rounds)};}
function integer(text:string,label:string,min:number,max:number):number {
  if(!/^\d+$/.test(text.trim()))throw Error(`${label} must be a whole number.`);
  const n=Number(text);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${label} must be between ${min} and ${max}.`);return n;
}
export function timerConfig(mode:TimerMode,draft:TimerDraft):TimerConfig {
  const c:TimerConfig={normal_seconds:1500,work_seconds:1500,break_seconds:300,decrease_seconds:0,rounds:4};
  if(mode==='normal'){
    c.normal_seconds=integer(draft.hours,'Hours',0,24)*3600+integer(draft.minutes,'Minutes',0,59)*60+integer(draft.seconds,'Seconds',0,59);
    if(c.normal_seconds<1||c.normal_seconds>86400)throw Error('Set a duration between 1 second and 24 hours.');
  }else if(mode==='pomodoro'){
    c.work_seconds=integer(draft.work,'Starting work time',1,1440)*60;c.break_seconds=integer(draft.break,'Starting break time',1,1440)*60;
    c.decrease_seconds=integer(draft.decrease,'Work decrease',0,1440)*60;c.rounds=integer(draft.rounds,'Rounds',1,100);
    if(c.work_seconds-c.decrease_seconds*(c.rounds-1)<=0)throw Error('The decrease would make a work period zero or negative. Reduce the decrease or number of rounds.');
  }
  return c;
}
export function timerText(ms:number,countdown=false):string {
  const seconds=countdown?Math.ceil(Math.max(0,ms)/1000):Math.floor(Math.max(0,ms)/1000);
  const h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;
  return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');
}
