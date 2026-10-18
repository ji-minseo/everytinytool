/* Quick Image Studio · entirely local JPEG, PNG, WebP resize and compression */
(function(root,factory){const api=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',api.init);else api.init();}})(typeof window!=='undefined'?window:{},function(root){
'use strict';
const MAX_BYTES=25*1024*1024,MAX_PIXELS=24*1000000,MAX_SIDE=12000;
const FORMATS={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function validateFile(file){if(!file)return 'Choose an image first.';if(!Object.hasOwn(FORMATS,file.type))return 'Use a JPG, PNG or WebP image.';if(file.size<=0)return 'This file is empty.';if(file.size>MAX_BYTES)return 'Use an image under 25 MB.';return '';}
function isSafeSize(w,h){return Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=MAX_SIDE&&h<=MAX_SIDE&&w*h<=MAX_PIXELS;}
function scaleDimensions(w,h,mode,value,allowUpscale=false){if(!isSafeSize(w,h))throw Error('Image dimensions exceed the 24 megapixel limit.');
 let factor=1;
 if(mode==='width'){if(!Number.isInteger(value)||value<1||value>MAX_SIDE)throw Error('Width must be 1–12,000 pixels.');factor=value/w;}
 else if(mode==='height'){if(!Number.isInteger(value)||value<1||value>MAX_SIDE)throw Error('Height must be 1–12,000 pixels.');factor=value/h;}
 else if(mode==='percent'){if(!Number.isFinite(value)||value<1||value>400)throw Error('Scale must be between 1 and 400%.');factor=value/100;}
 else if(mode==='original')factor=1;
 else throw Error('Unsupported sizing mode.');
 if(!allowUpscale)factor=Math.min(1,factor);
 const width=Math.max(1,Math.round(w*factor)),height=Math.max(1,Math.round(h*factor));
 if(!isSafeSize(width,height))throw Error('Output is too large. Use a smaller dimension.');
 return {width,height};
}
function formatBytes(size){return size>=1048576?(size/1048576).toFixed(2)+' MB':size>=1024?(size/1024).toFixed(1)+' KB':size+' B';}
function fileName(name,format){const base=String(name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'-').slice(0,90)||'image';return base+'-optimized.'+FORMATS[format];}
function savedPercent(start,end){return start?Math.round((1-end/start)*100):0;}
function makeBackgroundColor(format,choice,custom){if(format==='image/png')return null;return choice==='black'?'#000000':choice==='custom'&&/^#[0-9a-f]{6}$/i.test(custom)?custom:'#ffffff';}
function getBestCandidate(items,targetBytes){const valid=items.filter(x=>x&&x.blob&&x.blob.size>0);if(!valid.length)throw Error('Browser could not export this format.');if(!targetBytes)return valid[0];return valid.find(x=>x.blob.size<=targetBytes)||valid.reduce((best,x)=>x.blob.size<best.blob.size?x:best);}
function canvasToBlob(canvas,type,quality){return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob&&blob.size?resolve(blob):reject(Error('Unable to encode this image in your browser.')),type,quality);}catch(e){reject(e);}});}
async function convertImage(image,settings){
 const {width,height}=scaleDimensions(image.width,image.height,settings.mode,settings.value,!!settings.allowUpscale);
 const canvas=settings.createCanvas?settings.createCanvas(width,height):document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Image processing is unavailable in this browser.');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const color=makeBackgroundColor(settings.format,settings.background,settings.customColor);
 if(color){ctx.fillStyle=color;ctx.fillRect(0,0,width,height);}
 ctx.drawImage(image.image||image,0,0,width,height);
 const quality=Math.max(0.1,Math.min(1,Number(settings.quality)/100||0.82));
 let result=await canvasToBlob(canvas,settings.format,quality);
 if(result.type!==settings.format)throw Error('This browser cannot export '+(FORMATS[settings.format]||settings.format)+'. Choose JPG or PNG.');
 if(settings.targetKB>0&&settings.format!=='image/png'&&result.size>settings.targetKB*1024){
   let best=result;
   const candidates=[{blob:result}];
   for(let q=quality-0.10;q>=0.20;q-=0.10){const next=await canvasToBlob(canvas,settings.format,q);if(next.type!==settings.format)break;candidates.push({blob:next});}
   best=getBestCandidate(candidates,settings.targetKB*1024).blob;result=best;
 }
 return {blob:result,width,height,format:settings.format};
}
async function decodeFile(file){
 if(root.createImageBitmap){const bitmap=await root.createImageBitmap(file);return {image:bitmap,width:bitmap.width,height:bitmap.height,close(){bitmap.close?.()}};}
 return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve({image:img,width:img.naturalWidth,height:img.naturalHeight,close(){}})};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not decode this image.'))};img.src=url;});
}
function initMini(){
 const $=id=>document.getElementById(id);if(!$('home-image-quick'))return;
 const input=$('home-image-file'),width=$('home-image-width'),status=$('home-image-status'),preview=$('home-image-preview'),download=$('home-image-download'),btn=$('home-image-run');
 let selected=null,decoded=null,sourceUrl=null,outputUrl=null,busy=false;
 const revoke=u=>{if(u)URL.revokeObjectURL(u);};
 function notify(message,isError=false){status.textContent=message;status.dataset.error=String(isError);}
 function invalidate(){revoke(outputUrl);outputUrl=null;download.hidden=true;btn.disabled=!selected||busy;}
 function selectFile(file){
  if(busy)return;
  const err=validateFile(file);if(err){notify(err,true);return;}
  invalidate();revoke(sourceUrl);sourceUrl=null;decoded?.close();
  decoded=null;selected=null;
  (async()=>{
   try{
    const img=await decodeFile(file);if(!isSafeSize(img.width,img.height)){img.close();throw Error('Image is too large for this browser tool.');}
    decoded=img;selected=file;sourceUrl=URL.createObjectURL(file);
    preview.src=sourceUrl;preview.hidden=false;
    $('home-image-name').textContent=file.name+' · '+formatBytes(file.size);
    btn.disabled=false;notify('Ready to resize — your image stays on this device.');
   }catch(error){notify(error.message||'Could not read image.',true);}
  })();
 }
 input.addEventListener('change',()=>{if(input.files?.[0])selectFile(input.files[0]);});
 width.addEventListener('change',invalidate);
 btn.addEventListener('click',async()=>{
  if(!selected||!decoded||busy)return;
  busy=true;btn.disabled=true;input.disabled=true;notify('Resizing and compressing in your browser…');
  try{
   const result=await convertImage(decoded,{mode:'width',value:Number(width.value),allowUpscale:false,format:'image/jpeg',quality:82,background:'white'});
   revoke(outputUrl);outputUrl=URL.createObjectURL(result.blob);
   download.href=outputUrl;download.download=fileName(selected.name,'image/jpeg');download.hidden=false;
   $('home-image-result').textContent=result.width+' × '+result.height+' · '+formatBytes(result.blob.size);
   notify('Done! Your resized photo is ready.');
  }catch(e){notify(e.message||'Unable to resize this image.',true);}
  finally{busy=false;btn.disabled=!selected;input.disabled=false;}
 });
 root.addEventListener?.('pagehide',()=>{revoke(sourceUrl);revoke(outputUrl);decoded?.close();});
 download.hidden=true;btn.disabled=true;
}
function init(){
 initMini();
 const $=id=>document.getElementById(id);if(!$('image-studio'))return;
 const zone=$('is-dropzone'),input=$('is-file'),choose=$('is-choose'),run=$('is-run'),details=$('is-details'),result=$('is-result');
 const status=$('is-status'),original=$('is-before'),preview=$('is-after'),download=$('is-download');
 const compressMode=new URLSearchParams(root.location?.search||'').get('mode')==='compress';
 const uploadThumb=$('is-upload-preview');
 let file=null,originalUrl=null,resultUrl=null,blob=null,busy=false,token=0,decoded=null;
 let batchFiles=[],batchUrls=[],batchThumbUrls=[];
 const batchBox=$('is-batch'),batchList=$('is-batch-list');
 function clearBatchUrls(){batchUrls.forEach(u=>revoke(u));batchUrls=[];}
 function clearBatchThumbs(){batchThumbUrls.forEach(u=>revoke(u));batchThumbUrls=[];}
 function showBatch(selected){
  batchFiles=selected.slice();
  clearBatchUrls();clearBatchThumbs();batchList.replaceChildren();
  batchBox.hidden=batchFiles.length<2;
  if(batchFiles.length<2)return;
  for(const candidate of batchFiles){
   const row=document.createElement('div');row.className='ett-batch-row';
   const thumb=document.createElement('img');thumb.alt='';const src=URL.createObjectURL(candidate);batchThumbUrls.push(src);thumb.src=src;
   const label=document.createElement('span');label.textContent=candidate.name+' · '+formatBytes(candidate.size);
   const state=document.createElement('strong');state.textContent='Ready';
   row.append(thumb,label,state);batchList.appendChild(row);
  }
 }
 if(compressMode){$('is-size-mode').value='original';$('is-sizing-options').hidden=true;$('is-size-presets').hidden=true;$('is-upscale-row').hidden=true;$('is-advanced').open=true;$('is-run').textContent='Compress image ↗';$('is-choose').textContent='Choose image to compress';}
 else {$('is-advanced').open=false;$('is-run').textContent='Resize image ↗';}
 const controls=['is-size-mode','is-size-value','is-upscale','is-format','is-quality','is-target','is-background','is-custom-color'];
 function revoke(url){if(url)URL.revokeObjectURL(url);}
 function notify(t,error=false){status.textContent=t;status.dataset.error=String(error);}
 function setBusy(flag){busy=flag;input.disabled=flag;choose.disabled=flag;run.disabled=flag||!file;for(const id of controls)$(id).disabled=flag;}
 function invalidate(){token++;blob=null;result.hidden=true;revoke(resultUrl);resultUrl=null;preview.removeAttribute('src');download.removeAttribute('href');download.disabled=true;if(file)notify('Settings changed. Choose Process image to update your result.');}
 function settings(){
  const fmt=$('is-format').value;const mode=compressMode?'original':$('is-size-mode').value;
  return {mode,value:Number($('is-size-value').value),allowUpscale:$('is-upscale').checked,
  format:fmt,quality:Number($('is-quality').value),targetKB:Number($('is-target').value),
  background:$('is-background').value,customColor:$('is-custom-color').value};
 }
 function updateControls(){
  const s=settings();
  $('is-quality-box').hidden=s.format==='image/png';
  $('is-background-box').hidden=s.format==='image/png';
  $('is-custom-box').hidden=s.format==='image/png'||s.background!=='custom';
  $('is-target-note').textContent=s.format==='image/png'
   ? 'PNG is lossless; quality and target KB do not apply.'
   : 'Optional target is best effort and may not be achievable at this resolution.';
  const v=$('is-size-value');v.disabled=busy||s.mode==='original';v.min=s.mode==='percent'?'1':'1';v.max=s.mode==='percent'?'400':String(MAX_SIDE);
  v.step=s.mode==='percent'?'1':'1';
  const label=$('is-size-value-label');label.textContent=s.mode==='percent'?'Scale (%)':s.mode==='height'?'Height (px)':'Width (px)';
  if(file&&decoded){try{const d=scaleDimensions(decoded.width,decoded.height,s.mode,s.value,s.allowUpscale);$('is-output-size').textContent=d.width+' × '+d.height+' px';}catch(_){$('is-output-size').textContent='Check dimensions';}}
  $('is-quality-label').textContent=s.quality+'%';
 }
 async function select(fileNext){
  if(busy)return;
  invalidate();revoke(originalUrl);originalUrl=null;file=null;decoded?.close();decoded=null;input.value='';details.hidden=true;uploadThumb.hidden=true;uploadThumb.removeAttribute('src');zone.classList.remove('has-image');
  const error=validateFile(fileNext);
  if(error){notify(error,!!fileNext);setBusy(false);return;}
  try{
   decoded=await decodeFile(fileNext);
   if(!isSafeSize(decoded.width,decoded.height))throw Error('Image exceeds 24 megapixels or 12,000 px per side.');
   file=fileNext;originalUrl=URL.createObjectURL(fileNext);original.src=originalUrl;uploadThumb.src=originalUrl;uploadThumb.hidden=false;zone.classList.add('has-image');details.hidden=false;
   $('is-file-name').textContent=file.name||'image';
   $('is-input-size').textContent=decoded.width+' × '+decoded.height+' px · '+formatBytes(file.size);
   const sizeMode=$('is-size-mode').value;
   if(sizeMode==='width')$('is-size-value').value=String(decoded.width);
   if(sizeMode==='height')$('is-size-value').value=String(decoded.height);
   updateControls();notify('Image ready. Set the size and export format, then process.');
  }catch(e){notify(e.message||'Cannot open this image.',true);decoded?.close();decoded=null;}
  setBusy(false);
 }
 zone.addEventListener('click',e=>{if(busy||e.target===input||e.target.closest?.('button,input,label,a'))return;input.click();});
 zone.addEventListener('keydown',e=>{if(busy||e.target!==zone||!['Enter',' '].includes(e.key))return;e.preventDefault();input.click();});
 choose.addEventListener('click',()=>{if(!busy)input.click();});
 input.addEventListener('change',()=>{
  const list=Array.from(input.files||[]);
  if(!list.length)return;
  const selected=list.slice(0,10);
  if(list.length>10)notify('Only the first 10 images will be processed.');
  showBatch(selected);
  select(selected[0]);
 });
 ['dragenter','dragover'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();if(!busy)zone.classList.add('dragover');}));
 ['dragleave','drop'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('dragover');if(type==='drop'&&!busy&&e.dataTransfer?.files?.[0]){const files=Array.from(e.dataTransfer.files).slice(0,10);showBatch(files);select(files[0]);}}));
 controls.forEach(id=>$(id).addEventListener(id==='is-quality'?'input':'change',()=>{
  if(busy)return;
  if(id==='is-size-mode'&&decoded&&!compressMode){
   const choice=$('is-size-mode').value;
   if(choice==='width')$('is-size-value').value=String(decoded.width);
   if(choice==='height')$('is-size-value').value=String(decoded.height);
   if(choice==='percent')$('is-size-value').value='100';
  }
  invalidate();updateControls();
 }));
 $('is-size-value').addEventListener('input',()=>{if(!busy){invalidate();updateControls();}});
 $('is-custom-color').addEventListener('input',()=>{if(!busy){invalidate();updateControls();}});
 document.querySelectorAll('[data-is-preset]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;$('is-size-mode').value='width';$('is-size-value').value=b.dataset.isPreset;invalidate();updateControls();}));
 run.addEventListener('click',async()=>{
  if(!file||!decoded||busy)return;
  const thisToken=++token;setBusy(true);result.hidden=true;notify('Processing your image locally…');
  try{
   await new Promise(r=>root.requestAnimationFrame?root.requestAnimationFrame(r):r());
   const s=settings();if(s.targetKB<0||!Number.isFinite(s.targetKB))throw Error('Target size must be a positive number or blank.');
   const queue=batchFiles.length?batchFiles:[file];
   clearBatchUrls();
   let success=0,failed=0;
   if(queue.length>1)batchBox.hidden=false;
   for(let i=0;i<queue.length;i++){
    const current=queue[i],row=batchList.children[i],label=row?.querySelector('strong');
    let localDecoded=null;
    try{
     if(validateFile(current))throw Error(validateFile(current));
     localDecoded=i===0?decoded:await decodeFile(current);
     if(!isSafeSize(localDecoded.width,localDecoded.height))throw Error('Image dimensions too large.');
     if(label)label.textContent='Processing…';
     const out=await convertImage(localDecoded,s);
     if(thisToken!==token)break;
     const url=URL.createObjectURL(out.blob);
     if(queue.length>1){
      batchUrls.push(url);
      if(label){label.textContent=formatBytes(out.blob.size);}
      const link=document.createElement('a');link.href=url;link.download=fileName(current.name,out.format);link.textContent='Download ↓';
      row?.appendChild(link);
     }
     if(i===0){
      blob=out.blob;revoke(resultUrl);
      resultUrl=queue.length>1?null:url;
      preview.src=url;
      $('is-output-summary').textContent=out.width+' × '+out.height+' px · '+formatBytes(blob.size);
      $('is-saving').textContent=blob.size<=current.size?'Saved '+savedPercent(current.size,blob.size)+'% of original size':'File is '+Math.round((blob.size/current.size-1)*100)+'% larger';
      download.href=url;download.download=fileName(current.name,out.format);download.disabled=false;
      result.hidden=false;
     }else if(queue.length===1){revoke(url);}
     success++;
    }catch(e){failed++;if(label){label.textContent=e.message||'Failed';label.classList.add('ett-error');}}
    finally{if(i!==0)localDecoded?.close();}
   }
   notify('Finished '+success+' image'+(success===1?'':'s')+(failed?' · '+failed+' could not be processed':'')+'. Download each result below.',failed>0&&success===0);
  }catch(err){notify(err.message||'Image processing failed.',true);}
  finally{setBusy(false);updateControls();}
 });
 $('is-clear').addEventListener('click',()=>{showBatch([]);select(null);});
 window.addEventListener?.('pagehide',()=>{revoke(originalUrl);revoke(resultUrl);clearBatchUrls();clearBatchThumbs();decoded?.close();});
 $('is-quality-box').hidden=false;$('is-background-box').hidden=false;details.hidden=true;result.hidden=true;
 setBusy(false);updateControls();
}
return {MAX_BYTES,MAX_PIXELS,FORMATS,validateFile,isSafeSize,scaleDimensions,formatBytes,fileName,makeBackgroundColor,getBestCandidate,convertImage,init};
});