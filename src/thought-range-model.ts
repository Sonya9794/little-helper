export type ThoughtHandle='min'|'max';
export function rangeMinute(x:number,left:number,width:number):number {
  if(!Number.isFinite(x)||!Number.isFinite(left)||!Number.isFinite(width)||width<=0)throw Error('Invalid interval slider geometry.');
  return Math.max(1,Math.min(30,Math.round(1+29*(x-left)/width)));
}
export function rangeHandle(value:number,min:number,max:number,delta=0):ThoughtHandle|null {
  if(min===max){if(delta)return delta<0?'min':'max';return value===min?null:value<min?'min':'max';}
  return Math.abs(value-min)<=Math.abs(value-max)?'min':'max';
}
export function moveThoughtHandle(min:number,max:number,handle:ThoughtHandle,value:number):[number,number] {
  const n=Math.max(1,Math.min(30,Math.round(value)));
  return handle==='min'?[Math.min(n,max),max]:[min,Math.max(n,min)];
}
