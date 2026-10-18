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
function init(){
 const $=id=>document.getElementById(id);if(!$('image-studio'))return;
 const zone=$('is-dropzone'),input=$('is-file'),choose=$('is-choose'),run=$('is-run'),details=$('is-details'),result=$('is-result');
 const status=$('is-status'),original=$('is-before'),preview=$('is-after'),download=$('is-download');
 let file=null,originalUrl=null,resultUrl=null,blob=null,busy=false,token=0,decoded=null;
 const controls=['is-size-mode','is-size-value','is-upscale','is-format','is-quality','is-target','is-background','is-custom-color'];
 function revoke(url){if(url)URL.revokeObjectURL(url);}
 function notify(t,error=false){status.textContent=t;status.dataset.error=String(error);}
 function setBusy(flag){busy=flag;input.disabled=flag;choose.disabled=flag;run.disabled=flag||!file;for(const id of controls)$(id).disabled=flag;}
 function invalidate(){token++;blob=null;result.hidden=true;revoke(resultUrl);resultUrl=null;preview.removeAttribute('src');download.removeAttribute('href');download.disabled=true;if(file)notify('Settings changed. Choose Process image to update your result.');}
 function settings(){
  const fmt=$('is-format').value;const mode=$('is-size-mode').value;
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
  invalidate();revoke(originalUrl);originalUrl=null;file=null;decoded?.close();decoded=null;input.value='';details.hidden=true;
  const error=validateFile(fileNext);
  if(error){notify(error,!!fileNext);setBusy(false);return;}
  try{
   decoded=await decodeFile(fileNext);
   if(!isSafeSize(decoded.width,decoded.height))throw Error('Image exceeds 24 megapixels or 12,000 px per side.');
   file=fileNext;originalUrl=URL.createObjectURL(fileNext);original.src=originalUrl;details.hidden=false;
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
 input.addEventListener('change',()=>{if(input.files?.[0])select(input.files[0]);});
 ['dragenter','dragover'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();if(!busy)zone.classList.add('dragover');}));
 ['dragleave','drop'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('dragover');if(type==='drop'&&!busy&&e.dataTransfer?.files?.[0])select(e.dataTransfer.files[0]);}));
 controls.forEach(id=>$(id).addEventListener(id==='is-quality'?'input':'change',()=>{if(busy)return;invalidate();updateControls();}));
 $('is-size-value').addEventListener('input',()=>{if(!busy){invalidate();updateControls();}});
 $('is-custom-color').addEventListener('input',()=>{if(!busy){invalidate();updateControls();}});
 document.querySelectorAll('[data-is-preset]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;$('is-size-mode').value='width';$('is-size-value').value=b.dataset.isPreset;invalidate();updateControls();}));
 run.addEventListener('click',async()=>{
  if(!file||!decoded||busy)return;
  const thisToken=++token;setBusy(true);result.hidden=true;notify('Processing your image locally…');
  try{
   await new Promise(r=>root.requestAnimationFrame?root.requestAnimationFrame(r):r());
   const s=settings();if(s.targetKB<0||!Number.isFinite(s.targetKB))throw Error('Target size must be a positive number or blank.');
   const out=await convertImage(decoded,s);
   if(thisToken!==token)return;
   blob=out.blob;revoke(resultUrl);resultUrl=URL.createObjectURL(blob);preview.src=resultUrl;
   $('is-output-summary').textContent=out.width+' × '+out.height+' px · '+formatBytes(blob.size);
   $('is-saving').textContent=savedPercent(file.size,blob.size)+'% file size change';
   $('is-saving').textContent=blob.size<=file.size?'Saved '+savedPercent(file.size,blob.size)+'% of original size':'File is '+Math.round((blob.size/file.size-1)*100)+'% larger (higher quality or format change)';
   download.href=resultUrl;download.download=fileName(file.name,out.format);download.disabled=false;
   result.hidden=false;notify('Your image is ready. Download the processed file.');
  }catch(err){notify(err.message||'Image processing failed.',true);}
  finally{setBusy(false);}
 });
 $('is-clear').addEventListener('click',()=>select(null));
 window.addEventListener?.('pagehide',()=>{revoke(originalUrl);revoke(resultUrl);decoded?.close();});
 $('is-quality-box').hidden=false;$('is-background-box').hidden=false;details.hidden=true;result.hidden=true;
 setBusy(false);updateControls();
}
return {MAX_BYTES,MAX_PIXELS,FORMATS,validateFile,isSafeSize,scaleDimensions,formatBytes,fileName,makeBackgroundColor,getBestCandidate,convertImage,init};
});