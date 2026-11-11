/* Shared JPG, PNG and mixed-image compression settings. */
(()=>{'use strict';
window.ImageCompressionSettings={
 init(root=document){
  const $=sel=>root.querySelector(sel),modes=[...root.querySelectorAll('[data-mode]')],formats=[...root.querySelectorAll('[data-format]')],presets=[...root.querySelectorAll('[data-size]')];
  const customButton=$('[data-size-custom]'),customFields=$('.compress-custom-target'),targetRow=$('#compressTargetRow'),value=$('#compressTargetValue'),unit=$('#compressTargetUnit'),width=$('#compressMaxWidth');
  let mode='quality',format='jpeg';
  const mark=(items,active)=>items.forEach(b=>{const is=b===active;b.classList.toggle('active',is);b.setAttribute('aria-pressed',String(is))});
  modes.forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;mark(modes,b);if(targetRow)targetRow.hidden=mode!=='target'}));
  formats.forEach(b=>b.addEventListener('click',()=>{format=b.dataset.format;mark(formats,b)}));
  presets.forEach(b=>b.addEventListener('click',()=>{value.value=b.dataset.size;unit.value=b.dataset.unit;if(customFields)customFields.hidden=true;mark([...presets,customButton].filter(Boolean),b)}));
  customButton?.addEventListener('click',()=>{if(customFields)customFields.hidden=false;mark([...presets,customButton].filter(Boolean),customButton);value?.focus()});
  const sync=()=>{if(customFields&&!customFields.hidden)mark([...presets,customButton].filter(Boolean),customButton)};
  value?.addEventListener('input',sync);unit?.addEventListener('change',sync);
  mark(modes,modes[0]);if(formats.length)mark(formats,formats[0]);mark([...presets,customButton].filter(Boolean),presets.find(b=>b.dataset.size==='500')||presets[0]);
  return {get(){
   const raw=Number(value?.value);
   const target=mode==='target'&&Number.isFinite(raw)&&raw>0?Math.round(raw*(unit?.value==='MB'?1048576:1024)):0;
   return {mode,target,maxWidth:Number(width?.value)||0,format:formats.length?'image/'+format:null};
  }};
 }
};
})();