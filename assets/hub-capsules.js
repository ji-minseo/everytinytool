/* Every Tiny Tool home · categorized capsule navigation with same-origin tool previews. */
(function(){
'use strict';
function init(){
 const mainTabs=[...document.querySelectorAll('[data-hub-tab]')];
 const imageTabs=[...document.querySelectorAll('[data-image-tab]')];
 const metadataTabs=[...document.querySelectorAll('[data-metadata-tab]')];
 const parent=document.querySelector('.hub-tools');
 if(!mainTabs.length||!parent)return;
 let active='image',imageActive='resize',metadataActive='inspect';
 const frameFor={resize:'hub-frame-resize',compress:'hub-frame-compress',remove:'hub-frame-remove',pdf:'hub-frame-pdf',video:'hub-frame-video',workspace:'hub-frame-workspace','metadata-inspect':'hub-frame-metadata-inspect','metadata-clean':'hub-frame-metadata-clean'};
 const frames=Object.fromEntries(Object.entries(frameFor).map(([key,id])=>[key,document.getElementById(id)]));
 // Measure the real content inside each same-origin tool, not the iframe's
 // scrollHeight (which includes the iframe viewport and prevents shrinking).
 const resizeFrame=frame=>{
  if(!frame||!frame.getAttribute('src')||frame.closest('[hidden]'))return;
  try{
   const doc=frame.contentDocument;
   if(!doc?.body)return;
   const root=doc.querySelector('.shell')||doc.body;
   const rect=root.getBoundingClientRect();
   const bodyTop=doc.body.getBoundingClientRect().top;
   const height=Math.max(160,Math.ceil(rect.bottom-bodyTop+8));
   if(Math.abs(frame.getBoundingClientRect().height-height)>2){
    frame.style.height=height+'px';
   }
  }catch(_){frame.style.height='680px';}
 };
 function loadFrame(frame){
  if(!frame)return;
  if(!frame.getAttribute('src')){
   const src=frame.dataset.src;
   if(!src||!src.startsWith('/'))return;
   frame.style.height='320px';
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
    if(!doc?.body)return;
    const root=doc.querySelector('.shell')||doc.body;
    if('ResizeObserver' in window){
     const observer=new ResizeObserver(()=>resizeFrame(frame));
     observer.observe(root);
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
  else if(which==='metadata')loadFrame(frames['metadata-'+metadataActive]);
  else if(frames[which])loadFrame(frames[which]);
  history.replaceState(null,'',location.pathname+location.search+'#tools');
 }
 function activateImage(which,focus=false){
  if(!imageTabs.some(x=>x.dataset.imageTab===which))return;
  imageActive=which;
  imageTabs.forEach(t=>{const selected=t.dataset.imageTab===which;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;if(selected&&focus)t.focus();});
  document.querySelectorAll('[data-image-panel]').forEach(p=>p.hidden=p.dataset.imagePanel!==which);
  const link=document.querySelector('[data-image-full]');
  const external={crop:['crop-image','Crop Image'],convert:['convert-image','Convert Image'],rotate:['rotate-image','Rotate Image'],jpgpng:['png-to-jpg','PNG to JPG'],webp:['image-to-webp','Image to WebP'],heic:['heic-to-jpg','HEIC to JPG']};
  if(link){
   if(external[which]){link.href='https://image.everytinytool.com/'+external[which][0]+'/';link.textContent='Open full '+external[which][1]+' tool ↗';link.target='_blank';link.rel='noopener noreferrer';}
   else {link.removeAttribute('target');link.removeAttribute('rel');link.href=which==='remove'?'/remove-background/':which==='compress'?'/quick-image-studio/?mode=compress':'/quick-image-studio/';link.textContent=which==='remove'?'Open full background remover ↗':which==='compress'?'Open full image compressor ↗':'Open full image resizer ↗';}
  }
  if(active==='image'&&frames[which])loadFrame(frames[which]);
 }
 function activateMetadata(which,focus=false){
  if(!metadataTabs.some(x=>x.dataset.metadataTab===which))return;
  metadataActive=which;
  metadataTabs.forEach(t=>{const selected=t.dataset.metadataTab===which;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;if(selected&&focus)t.focus();});
  document.querySelectorAll('[data-metadata-panel]').forEach(p=>p.hidden=p.dataset.metadataPanel!==which);
  const link=document.querySelector('[data-metadata-full]');
  if(link){link.href=which==='clean'?'/metadata-cleaner/':'/metadata-inspector/';link.textContent=which==='clean'?'Open full metadata cleaner ↗':'Open full metadata inspector ↗';}
  if(active==='metadata')loadFrame(frames['metadata-'+which]);
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
 arrowHandler(metadataTabs,activateMetadata,'metadataTab');
 // Direct links from marketing or SEO can select the requested tool.
 const fragment=location.hash.replace('#','');
 if(fragment==='metadata-inspector'){activateMain('metadata');activateMetadata('inspect');}
 else if(fragment==='metadata-cleaner'){activateMain('metadata');activateMetadata('clean');}
 else if(fragment==='metadata')activateMain('metadata');
 else if(fragment==='video')activateMain('video');
 else if(fragment==='pdf')activateMain('pdf');
 else if(fragment==='workspace')activateMain('workspace');
 else if(fragment==='remove-background'){activateMain('image');activateImage('remove');}
 else if(fragment==='compress-image'){activateMain('image');activateImage('compress');}
 else if(['crop','convert','rotate','jpgpng','webp','heic'].includes(fragment)){activateMain('image');activateImage(fragment);}
 else activateMain('image');
 window.addEventListener('resize',()=>{for(const frame of Object.values(frames))if(frame?.getAttribute('src'))resizeFrame(frame);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();