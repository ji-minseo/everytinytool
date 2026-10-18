/* Shared on-page image tools: real dropzones and local browser processing. */
(()=>{'use strict';
const qs=(r,s)=>r.querySelector(s);
const names={crop:'Crop',convert:'Convert',rotate:'Rotate',jpgpng:'JPG / PNG',webp:'WebP',heic:'HEIC'};
const opts={crop:'<div class="hub-crop-editor"><div class="hub-crop-presets"><button type="button" data-crop-ratio="free" class="active">Free</button><button type="button" data-crop-ratio="1">1:1</button><button type="button" data-crop-ratio="0.8">4:5</button><button type="button" data-crop-ratio="1.7777778">16:9</button></div><div class="hub-crop-stage" hidden><img class="hub-crop-image" alt="Image to crop"><div class="hub-crop-box" role="group" aria-label="Drag to move crop area, drag corner to resize"><span class="hub-crop-handle"></span></div></div><div class="hub-crop-fields"><label>X <input type="number" min="0" data-crop-field="x"></label><label>Y <input type="number" min="0" data-crop-field="y"></label><label>Width <input type="number" min="1" data-crop-field="w"></label><label>Height <input type="number" min="1" data-crop-field="h"></label></div><p class="hub-crop-help">Drag the selection to move it, or pull the corner to resize.</p></div>',convert:'<label>Output format <select data-key="format"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label>',rotate:'<div class="hub-rotate-buttons"><button type="button" data-rotate-action="left">↺ Rotate left</button><button type="button" data-rotate-action="right">↻ Rotate right</button><button type="button" data-rotate-action="flipH">↔ Flip horizontal</button><button type="button" data-rotate-action="flipV">↕ Flip vertical</button></div><div class="hub-rotate-preview" hidden></div>',jpgpng:'<label>Output format <select data-key="format"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>',webp:'<label>Output format <select data-key="format"><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option></select></label>',heic:''};
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
if(mode==='crop'&&config.crop){const v=config.crop,refW=v.imageW||w,refH=v.imageH||h;sx=Math.max(0,Math.min(w-1,Math.round(v.x/refW*w)));sy=Math.max(0,Math.min(h-1,Math.round(v.y/refH*h)));sw=Math.max(1,Math.min(w-sx,Math.round(v.w/refW*w)));sh=Math.max(1,Math.min(h-sy,Math.round(v.h/refH*h)));cw=sw;ch=sh;}
if(mode==='rotate'){rotation=parseInt(config.rotation,10)||0;if(rotation%180){cw=h;ch=w;}}
const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Cannot initialize canvas.');
let mime=mode==='convert'||mode==='jpgpng'||mode==='webp'?config.format:mode==='heic'?'image/jpeg':file.type==='image/webp'?'image/webp':file.type==='image/png'?'image/png':'image/jpeg';
if(mode==='rotate'){ctx.translate(cw/2,ch/2);ctx.rotate(rotation*Math.PI/180);if(config.flipH)ctx.scale(-1,1);if(config.flipV)ctx.scale(1,-1);if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(-w/2,-h/2,w,h)}ctx.drawImage(img,-w/2,-h/2,w,h);}
else{if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,cw,ch)}ctx.drawImage(img,sx,sy,sw,sh,0,0,cw,ch);}
const result=await blob(canvas,mime);return {result,name:fileName(file.name,mime),width:cw,height:ch};
}
function fmt(n){return n>=1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB'}
function init(){
document.querySelectorAll('[data-inline-image]').forEach(panel=>{
 const mode=panel.dataset.inlineImage,zone=qs(panel,'.hub-inline-dropzone'),input=qs(panel,'input[type=file]'),controls=qs(panel,'.hub-inline-controls'),results=qs(panel,'.hub-inline-results');
 let files=[],outputs=[],objectUrls=[],turn=0,flipH=false,flipV=false,working=false;
 const list=document.createElement('div');list.className='hub-upload-list';zone.insertAdjacentElement('afterend',list);
 controls.innerHTML=opts[mode]+'<button type="button" class="hub-inline-run">Process images</button>';
 const run=qs(controls,'.hub-inline-run');
 const downloadAll=document.createElement('button');downloadAll.type='button';downloadAll.className='hub-inline-zip';downloadAll.textContent='Download all as ZIP';downloadAll.hidden=true;run.insertAdjacentElement('afterend',downloadAll);
 function revoke(){objectUrls.forEach(URL.revokeObjectURL);objectUrls=[]}
 function render(){revoke();list.replaceChildren();controls.hidden=!files.length;results.replaceChildren();outputs=[];downloadAll.hidden=true;
 files.forEach((file,i)=>{const row=document.createElement('div');row.className='hub-file-row media-item';const box=document.createElement('div');box.className='hub-file-thumb';if(!/\.hei[cf]$/i.test(file.name)){const img=document.createElement('img'),u=URL.createObjectURL(file);objectUrls.push(u);img.src=u;img.alt='';box.append(img)}else box.textContent='📱';const detail=document.createElement('div');detail.className='hub-file-detail';const name=document.createElement('strong');name.textContent=file.name;const size=document.createElement('small');size.textContent=fmt(file.size);detail.append(name,size);const remove=document.createElement('button');remove.type='button';remove.className='hub-file-remove';remove.textContent='Remove';remove.onclick=()=>{files.splice(i,1);render()};row.append(box,detail,remove);list.append(row)});
 updateRotatePreview();if(mode==='crop')updateCropPreview();
 }
 function select(fs){files=[...fs].filter(f=>mode==='heic'?/\.hei[cf]$/i.test(f.name):f.type.startsWith('image/'));render()}
 function choose(){input.click()}
 zone.addEventListener('click',e=>{if(e.target!==input)choose()});zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
 zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover')});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
 zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');select(e.dataTransfer.files)});
 input.multiple=true;input.addEventListener('change',()=>{select(input.files);input.value=''});
 function config(){const c={rotation:String(turn),flipH,flipV};if(mode==='crop'&&cropImage&&cropSelection)c.crop={...cropSelection,imageW:cropImage.naturalWidth,imageH:cropImage.naturalHeight};controls.querySelectorAll('[data-key]').forEach(e=>c[e.dataset.key]=e.type==='checkbox'?e.checked:e.value);return c}
 let cropImage=null,cropSelection=null,cropRatio=null,cropUrl=null;
 const cropStage=qs(controls,'.hub-crop-stage'),cropImg=qs(controls,'.hub-crop-image'),cropBox=qs(controls,'.hub-crop-box');
 function cropClamp(v){if(!cropImage)return v;const w=cropImage.naturalWidth,h=cropImage.naturalHeight;let x=Math.max(0,Math.min(w-1,Math.round(v.x))),y=Math.max(0,Math.min(h-1,Math.round(v.y)));return{x,y,w:Math.max(1,Math.min(w-x,Math.round(v.w))),h:Math.max(1,Math.min(h-y,Math.round(v.h)))}} 
 function cropSync(){if(!cropSelection||!cropImage||!cropStage||cropStage.hidden)return;const rect=cropImg.getBoundingClientRect(),stageRect=cropStage.getBoundingClientRect(),v=cropSelection;if(!rect.width||!rect.height)return;const scaleX=rect.width/cropImage.naturalWidth,scaleY=rect.height/cropImage.naturalHeight;cropBox.style.left=(rect.left-stageRect.left+v.x*scaleX)+'px';cropBox.style.top=(rect.top-stageRect.top+v.y*scaleY)+'px';cropBox.style.width=v.w*scaleX+'px';cropBox.style.height=v.h*scaleY+'px';controls.querySelectorAll('[data-crop-field]').forEach(el=>{if(document.activeElement!==el)el.value=v[el.dataset.cropField]});}
 function cropSet(v){cropSelection=cropClamp(v);cropSync();}
 async function updateCropPreview(){if(mode!=='crop'||!cropStage)return;if(cropUrl){URL.revokeObjectURL(cropUrl);cropUrl=null}cropImage=null;cropSelection=null;cropStage.hidden=!files.length;if(!files.length)return;try{const img=await loadImage(files[0]);cropImage=img;cropUrl=URL.createObjectURL(files[0]);cropImg.onload=()=>{cropSync()};cropImg.src=cropUrl;cropSet({x:0,y:0,w:img.naturalWidth,h:img.naturalHeight});if(cropRatio)cropApplyRatio(cropRatio)}catch(e){cropStage.hidden=true}}
 function cropApplyRatio(r){cropRatio=r;controls.querySelectorAll('[data-crop-ratio]').forEach(b=>b.classList.toggle('active',b.dataset.cropRatio===(r===null?'free':String(r))));if(!cropImage||!r)return;let w=cropImage.naturalWidth,h=Math.round(w/r);if(h>cropImage.naturalHeight){h=cropImage.naturalHeight;w=Math.round(h*r)}cropSet({x:(cropImage.naturalWidth-w)/2,y:(cropImage.naturalHeight-h)/2,w,h})}
 if(mode==='crop'){
  controls.querySelectorAll('[data-crop-ratio]').forEach(b=>b.addEventListener('click',()=>cropApplyRatio(b.dataset.cropRatio==='free'?null:Number(b.dataset.cropRatio))));
  controls.querySelectorAll('[data-crop-field]').forEach(el=>el.addEventListener('input',()=>{if(!cropSelection)return;const v={...cropSelection};v[el.dataset.cropField]=Number(el.value)||0;if(cropRatio){if(el.dataset.cropField==='w')v.h=v.w/cropRatio;else if(el.dataset.cropField==='h')v.w=v.h*cropRatio}cropSet(v)}));
  let drag=null;cropBox.addEventListener('pointerdown',e=>{if(!cropSelection||!cropImg.getBoundingClientRect().width)return;e.preventDefault();cropBox.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,rect:cropImg.getBoundingClientRect(),v:{...cropSelection},resize:e.target.classList.contains('hub-crop-handle')}});
  cropBox.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)*cropImage.naturalWidth/drag.rect.width,dy=(e.clientY-drag.y)*cropImage.naturalHeight/drag.rect.height;const v={...drag.v};if(drag.resize){v.w=Math.max(1,v.w+dx);v.h=cropRatio?v.w/cropRatio:Math.max(1,v.h+dy)}else{v.x+=dx;v.y+=dy}cropSet(v)});
  const end=()=>drag=null;cropBox.addEventListener('pointerup',end);cropBox.addEventListener('pointercancel',end);window.addEventListener('resize',cropSync);
 }
 async function updateRotatePreview(){if(mode!=='rotate')return;const wrap=qs(controls,'.hub-rotate-preview');if(!wrap)return;wrap.replaceChildren();wrap.hidden=!files.length;if(!files.length)return;try{const img=await loadImage(files[0]);const c=document.createElement('canvas'),swap=turn%180!==0;c.width=swap?img.naturalHeight:img.naturalWidth;c.height=swap?img.naturalWidth:img.naturalHeight;const ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(turn*Math.PI/180);ctx.scale(flipH?-1:1,flipV?-1:1);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);wrap.append(c)}catch(e){wrap.textContent=e.message}}
 if(mode==='rotate')controls.querySelectorAll('[data-rotate-action]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.rotateAction==='left')turn=(turn+270)%360;else if(btn.dataset.rotateAction==='right')turn=(turn+90)%360;else if(btn.dataset.rotateAction==='flipH')flipH=!flipH;else flipV=!flipV;updateRotatePreview()}));
 run.addEventListener('click',async()=>{if(!files.length||working)return;working=true;run.disabled=true;results.replaceChildren();outputs=[];downloadAll.hidden=true;
 const text=document.createElement('p');text.className='hub-inline-processing';text.textContent='Processing images…';results.append(text);
 const c=config();for(const f of files){try{const out=await transform(f,mode,c);outputs.push(out)}catch(e){const warning=document.createElement('p');warning.textContent=f.name+': '+e.message;results.append(warning)}}
 text.remove();
 for(const out of outputs){const row=document.createElement('div');row.className='hub-output-row';const img=document.createElement('img'),url=URL.createObjectURL(out.result);objectUrls.push(url);img.src=url;img.alt='Processed preview';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=out.name;const detail=document.createElement('small');detail.textContent=out.width+' × '+out.height+' · '+fmt(out.result.size);info.append(title,detail);const button=document.createElement('button');button.type='button';button.textContent='Download';button.onclick=()=>exportFile(out.result,out.name);row.append(img,info,button);results.append(row)}
 downloadAll.hidden=outputs.length<2;working=false;run.disabled=false;});
 downloadAll.onclick=async()=>{if(!window.JSZip)return;downloadAll.disabled=true;try{const zip=new JSZip();const used=new Set();for(const o of outputs){let name=o.name,i=2;while(used.has(name))name=o.name.replace(/(\.[^.]+)$/,'-'+i+++'$1');used.add(name);zip.file(name,o.result)}exportFile(await zip.generateAsync({type:'blob'}),names[mode].toLowerCase().replace(/[^a-z]+/g,'-')+'-images.zip')}finally{downloadAll.disabled=false}};
});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();