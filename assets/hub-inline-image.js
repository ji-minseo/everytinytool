/* Shared on-page image tools: real dropzones and local browser processing. */
(()=>{'use strict';
const qs=(r,s)=>r.querySelector(s);
const names={crop:'Crop',convert:'Convert',rotate:'Rotate',jpgpng:'JPG / PNG',webp:'WebP',heic:'HEIC'};
const opts={crop:'<label>Aspect ratio <select data-key="ratio"><option value="free">Original image</option><option value="1">1:1</option><option value="0.8">4:5</option><option value="1.7777778">16:9</option></select></label>',convert:'<label>Output format <select data-key="format"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label>',rotate:'<label>Rotate <select data-key="rotation"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label><input type="checkbox" data-key="flip"> Flip horizontally</label>',jpgpng:'<label>Output format <select data-key="format"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>',webp:'<label>Output format <select data-key="format"><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option></select></label>',heic:''};
function blob(canvas,type,quality=.9){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('This format is not supported by your browser.')),type,quality));}
function fileName(original,mime){const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';return original.replace(/\.[^.]+$/,'')+'-edited.'+ext;}
function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Unable to open this image.'))};img.src=url;});}
function exportFile(b,name){const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function transform(file,mode,config){
let source=file;
if(mode==='heic'){if(typeof window.heic2any!=='function')throw Error('HEIC decoder is unavailable. Please retry with an internet connection.');const b=await window.heic2any({blob:file,toType:'image/jpeg',quality:.9});source=Array.isArray(b)?b[0]:b;}
const img=await loadImage(source),w=img.naturalWidth,h=img.naturalHeight;
if(w*h>45000000)throw Error('Image is too large for browser processing.');
let cw=w,ch=h,sx=0,sy=0,sw=w,sh=h,rotation=0;
if(mode==='crop'&&config.ratio!=='free'){const aspect=parseFloat(config.ratio);if(w/h>aspect){sw=Math.max(1,Math.floor(h*aspect));sx=Math.floor((w-sw)/2);}else{sh=Math.max(1,Math.floor(w/aspect));sy=Math.floor((h-sh)/2);}cw=sw;ch=sh;}
if(mode==='rotate'){rotation=parseInt(config.rotation,10)||0;if(rotation%180){cw=h;ch=w;}}
const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Cannot initialize canvas.');
let mime=mode==='convert'||mode==='jpgpng'||mode==='webp'?config.format:mode==='heic'?'image/jpeg':file.type==='image/webp'?'image/webp':file.type==='image/png'?'image/png':'image/jpeg';
if(mode==='rotate'){ctx.translate(cw/2,ch/2);ctx.rotate(rotation*Math.PI/180);if(config.flip)ctx.scale(-1,1);if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(-w/2,-h/2,w,h)}ctx.drawImage(img,-w/2,-h/2,w,h);}
else{if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,cw,ch)}ctx.drawImage(img,sx,sy,sw,sh,0,0,cw,ch);}
const result=await blob(canvas,mime);return {result,name:fileName(file.name,mime),width:cw,height:ch};
}
function init(){
document.querySelectorAll('[data-inline-image]').forEach(panel=>{
const mode=panel.dataset.inlineImage,zone=qs(panel,'.hub-inline-dropzone'),input=qs(panel,'input[type=file]'),controls=qs(panel,'.hub-inline-controls'),results=qs(panel,'.hub-inline-results');
let files=[];controls.innerHTML=opts[mode]+'<button type="button" class="hub-inline-run">Process images</button>';
const run=qs(controls,'.hub-inline-run');
const renderFiles=()=>{controls.hidden=files.length===0;results.textContent=files.length?files.length+' image'+(files.length===1?'':'s')+' selected. Ready to process.':'';};
function choose(){input.click();}
zone.addEventListener('click',e=>{if(e.target!==input)choose()});zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover')});
zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');files=Array.from(e.dataTransfer.files).filter(f=>mode==='heic'?/\.(heic|heif)$/i.test(f.name):f.type.startsWith('image/'));renderFiles();});
input.addEventListener('change',()=>{files=Array.from(input.files);renderFiles();});
run.addEventListener('click',async()=>{if(!files.length)return;run.disabled=true;results.textContent='Processing images…';const config={};controls.querySelectorAll('[data-key]').forEach(e=>config[e.dataset.key]=e.type==='checkbox'?e.checked:e.value);
let done=0;const errors=[];
for(const file of files){try{const out=await transform(file,mode,config);exportFile(out.result,out.name);done++;}catch(e){errors.push(file.name+': '+e.message);}}
results.textContent=done+' file(s) downloaded.'+(errors.length?' '+errors.join(' | '):'');run.disabled=false;
});
});
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();