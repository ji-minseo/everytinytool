/* Every Tiny Tool home · categorized capsule navigation with same-origin tool previews. */
(function(){
'use strict';
function init(){
 const mainTabs=[...document.querySelectorAll('[data-hub-tab]')];
 const imageTabs=[...document.querySelectorAll('[data-image-tab]')];
 const parent=document.querySelector('.hub-tools');
 if(!mainTabs.length||!parent)return;
 let active='image',imageActive='resize';
 const frameFor={resize:'hub-frame-resize',remove:'hub-frame-remove',pdf:'hub-frame-pdf',video:'hub-frame-video',workspace:'hub-frame-workspace'};
 const frames=Object.fromEntries(Object.entries(frameFor).map(([key,id])=>[key,document.getElementById(id)]));
 const resizeFrame=frame=>{
  if(!frame?.contentDocument)return;
  try{
   const doc=frame.contentDocument;
   if(!doc.body)return;
   const contentHeight=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);
   frame.style.height=Math.max(280,Math.ceil(contentHeight+8))+'px';
  }catch(_){frame.style.height='780px';}
 };
 function loadFrame(frame){
  if(!frame)return;
  if(!frame.getAttribute('src')){
   const src=frame.dataset.src;
   if(!src||!src.startsWith('/'))return;
   frame.src=src;
  }
  requestAnimationFrame(()=>resizeFrame(frame));
 }
 for(const frame of Object.values(frames)){
  if(!frame)continue;
  frame.addEventListener('load',()=>{
   resizeFrame(frame);
   try{
    const doc=frame.contentDocument;
    if(!doc)return;
    if('ResizeObserver' in window){
     const observer=new ResizeObserver(()=>resizeFrame(frame));
     observer.observe(doc.body);
     frame._observer=observer;
    }
    const within=()=>requestAnimationFrame(()=>resizeFrame(frame));
    doc.addEventListener('click',within);
    doc.addEventListener('change',within);
    doc.addEventListener('input',within);
    setTimeout(within,200);
  }catch(_){}
  });
 }
 function activateMain(which,focus=false){
  if(!mainTabs.some(x=>x.dataset.hubTab===which))return;
  active=which;
  mainTabs.forEach(t=>{
   const selected=t.dataset.hubTab===which;
   t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;
   if(selected&&focus)t.focus();
  });
  document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==which);
  if(which==='image')loadFrame(frames[imageActive]);
  else if(frames[which])loadFrame(frames[which]);
  history.replaceState(null,'',location.pathname+location.search+'#tools');
 }
 function activateImage(which,focus=false){
  if(!imageTabs.some(x=>x.dataset.imageTab===which))return;
  imageActive=which;
  imageTabs.forEach(t=>{const selected=t.dataset.imageTab===which;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;if(selected&&focus)t.focus();});
  document.querySelectorAll('[data-image-panel]').forEach(p=>p.hidden=p.dataset.imagePanel!==which);
  const link=document.querySelector('[data-image-full]');
  if(link){link.href=which==='remove'?'/remove-background/':'/quick-image-studio/';link.textContent=which==='remove'?'Open full background remover ↗':'Open full image studio ↗';}
  if(active==='image')loadFrame(frames[which]);
 }
 function arrowHandler(tabs,select,dataKey){
  tabs.forEach((tab,index)=>{
   tab.addEventListener('click',()=>select(tab.dataset[dataKey]));
   tab.addEventListener('keydown',e=>{
    let next;
    if(e.key==='ArrowRight')next=(index+1)%tabs.length;
    else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    else if(e.key==='Home')next=0;
    else if(e.key==='End')next=tabs.length-1;
    if(next!==undefined){e.preventDefault();select(tabs[next].dataset[dataKey],true);}
   });
  });
 }
 arrowHandler(mainTabs,activateMain,'hubTab');
 arrowHandler(imageTabs,activateImage,'imageTab');
 // Direct links from marketing or SEO can select the requested tool.
 const fragment=location.hash.replace('#','');
 if(fragment==='video')activateMain('video');
 else if(fragment==='pdf')activateMain('pdf');
 else if(fragment==='workspace')activateMain('workspace');
 else if(fragment==='remove-background'){activateMain('image');activateImage('remove');}
 else activateMain('image');
 window.addEventListener('resize',()=>{for(const frame of Object.values(frames))if(frame?.getAttribute('src'))resizeFrame(frame);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();