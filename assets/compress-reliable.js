/* Dedicated image compressor. Keeps file picking separate from other tool modes. */
(()=>{'use strict';window.__dedicatedImageCompressor=true;
const $=s=>document.querySelector(s),state={files:[],output:[]};
const fmt=n=>n>=1048576?(n/1048576).toFixed(2)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';
const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000)};
const toBlob=(canvas,type,q)=>new Promise((ok,fail)=>canvas.toBlob(b=>b?ok(b):fail(Error('Could not encode image.')),type,q));
const decode=f=>new Promise((ok,fail)=>{const u=URL.createObjectURL(f),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);ok(img)};img.onerror=()=>{URL.revokeObjectURL(u);fail(Error('Could not read image.'))};img.src=u});
async function encode(file,q,target,cfg={}){const img=await decode(file),c=document.createElement('canvas');const factor=cfg.maxWidth&&img.naturalWidth>cfg.maxWidth?cfg.maxWidth/img.naturalWidth:1;c.width=Math.max(1,Math.round(img.naturalWidth*factor));c.height=Math.max(1,Math.round(img.naturalHeight*factor));if(!c.width||!c.height||c.width*c.height>50000000)throw Error('Image dimensions are unsupported or too large.');const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas unavailable.');const type=cfg.format||(['image/jpeg','image/png','image/webp'].includes(file.type)?file.type:'image/png');if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)}ctx.drawImage(img,0,0,c.width,c.height);
let b=await toBlob(c,type,q);
if(type==='image/png'&&typeof UPNG!=='undefined'){
  try{
    const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    const makePng=colors=>new Blob([UPNG.encode([rgba.buffer.slice(0)],c.width,c.height,colors)],{type:'image/png'});
    // Try preserving all colors first. If a target was requested, progressively
    // reduce the palette, choosing the highest-detail candidate that fits.
    const palette=target?[0,256,192,128,96,64,48,32,24,16,8]:[0,256];
    let smallest=b,matching=null;
    for(const colors of palette){
      const candidate=makePng(colors);
      if(candidate.size<smallest.size)smallest=candidate;
      if(target&&candidate.size<=target){matching=candidate;break}
    }
    b=matching||smallest;
  }catch(error){console.warn('PNG palette optimization unavailable:',error)}
}
if(target&&type!=='image/png'){
  let lo=.08,hi=Math.max(.08,q),best=b.size<=target?b:null,smallest=b;
  for(let i=0;i<9;i++){
    const mid=(lo+hi)/2,x=await toBlob(c,type,mid);
    if(x.size<smallest.size)smallest=x;
    if(x.size<=target){best=x;lo=mid}else hi=mid;
  }
  b=best||smallest;
}
if(target&&b.size>target){
  const originalWidth=c.width,originalHeight=c.height;
  let smallest=b;
  for(const scale of [0.85,0.7,0.55,0.4,0.3]){
    const w=Math.max(1,Math.round(originalWidth*scale)),h=Math.max(1,Math.round(originalHeight*scale));
    const reduced=document.createElement('canvas');reduced.width=w;reduced.height=h;
    const rc=reduced.getContext('2d');if(!rc)continue;
    if(type==='image/jpeg'){rc.fillStyle='#fff';rc.fillRect(0,0,w,h)}
    rc.drawImage(c,0,0,w,h);
    let candidate=await toBlob(reduced,type,q);
    if(type==='image/png'&&typeof UPNG!=='undefined'){
      try{
        const rgba=rc.getImageData(0,0,w,h).data;
        for(const colors of [0,256,128,64,32,16]){
          const next=new Blob([UPNG.encode([rgba.buffer.slice(0)],w,h,colors)],{type:'image/png'});
          if(next.size<candidate.size)candidate=next;
          if(next.size<=target){candidate=next;break}
        }
      }catch(error){console.warn('PNG reduced resolution optimization unavailable',error)}
    }else if(type!=='image/png'){
      let lo=.08,hi=Math.max(.08,q),best=candidate.size<=target?candidate:null;
      for(let i=0;i<7;i++){const mid=(lo+hi)/2,x=await toBlob(reduced,type,mid);if(x.size<candidate.size)candidate=x;if(x.size<=target){best=x;lo=mid}else hi=mid}
      if(best)candidate=best;
    }
    if(candidate.size<smallest.size)smallest=candidate;
    if(candidate.size<=target){smallest=candidate;break}
  }
  b=smallest;
}
if(b.size>=file.size&&type===file.type&&factor===1)return {blob:file,kept:true,type,metTarget:!target||file.size<=target};
return {blob:b,kept:false,type,metTarget:!target||b.size<=target};
}
function init(){const input=$('#fileInput'),drop=$('#dropzone'),pick=$('.chooseBtn'),summary=$('#fileSummary'),run=$('#processBtn'),results=$('#results'),zipBtn=$('#downloadZipBtn');if(!input||!drop||!run||!results)return;
input.type='file';input.multiple=true;input.accept='image/jpeg,image/png,image/webp';input.style.removeProperty('display');
const picker=()=>input.click();
pick?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();picker()});
drop.addEventListener('click',e=>{if(e.target.closest('button,input,a'))return;picker()});
drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();picker()}});
for(const k of ['dragenter','dragover'])drop.addEventListener(k,e=>{e.preventDefault();drop.classList.add('dragover')});
for(const k of ['dragleave','drop'])drop.addEventListener(k,e=>{e.preventDefault();drop.classList.remove('dragover')});
function update(){const fs=state.files;results.replaceChildren();state.output=[];zipBtn?.classList.add('hidden');$('#compressionSummary')?.classList.add('hidden');run.disabled=!fs.length;summary.classList.toggle('show',!!fs.length);summary.replaceChildren();if(!fs.length)return;
const list=document.createElement('div');list.className='selected-files-grid';fs.forEach((f,i)=>{const item=document.createElement('div');item.className='media-item selected-file';const visual=document.createElement('div');visual.className='selected-file-thumb';const img=document.createElement('img');const preview=URL.createObjectURL(f);img.src=preview;img.alt='';img.onload=()=>URL.revokeObjectURL(preview);img.onerror=()=>{URL.revokeObjectURL(preview);visual.textContent='🖼️'};visual.append(img);const desc=document.createElement('div');desc.className='selected-file-info';const title=document.createElement('div');title.className='selected-file-name';title.textContent=f.name;title.title=f.name;const size=document.createElement('div');size.className='selected-file-size';size.textContent=fmt(f.size);desc.append(title,size);const remove=document.createElement('button');remove.type='button';remove.className='btn ghost selected-file-remove';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+f.name);remove.onclick=()=>{state.files.splice(i,1);update()};item.append(visual,desc,remove);list.append(item)});summary.append(list);
}
function select(files){state.files=[...state.files,...files].filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name));update();}
input.addEventListener('change',()=>{select(input.files);input.value=''});
drop.addEventListener('drop',e=>select(e.dataTransfer.files));
$('#quality')?.addEventListener('input',e=>{const el=$('#qualityValue');if(el)el.textContent=e.target.value+'%'});
const settings=window.ImageCompressionSettings?.init?.(document);
function addResult(f,blob,name,extra){const card=document.createElement('div');card.className='result-card';const img=document.createElement('img');img.className='thumb';img.alt='';const u=URL.createObjectURL(blob);img.src=u;const info=document.createElement('div');const t=document.createElement('div');t.className='result-name';t.textContent=name;const meta=document.createElement('div');meta.className='result-meta';meta.textContent=fmt(f.size)+' → '+fmt(blob.size)+(extra?' · '+extra:'');info.append(t,meta);const a=document.createElement('a');a.className='download';a.textContent='Download';a.href=u;a.download=name;card.append(img,info,a);results.append(card)}
run.addEventListener('click',async()=>{if(!state.files.length)return;run.disabled=true;results.replaceChildren();state.output=[];zipBtn?.classList.add('hidden');
const ko=location.pathname.startsWith('/ko/');
let progress=$('#compressProgress');
if(!progress){progress=document.createElement('div');progress.id='compressProgress';progress.className='compress-progress';progress.setAttribute('role','status');run.parentElement.insertAdjacentElement('afterend',progress)}
const controls=['#quality','#compressTargetValue','#compressTargetUnit','#compressMaxWidth'].map($).filter(Boolean).concat([...document.querySelectorAll('.compress-choice button')]);
controls.forEach(el=>el.disabled=true);const q=Math.max(.2,Math.min(1,Number($('#quality')?.value||80)/100)),cfg=settings?.get()||{},target=cfg.target||0;let totalIn=0,totalOut=0;
for(const [index,f] of state.files.entries()){window.ETTProcessingCount?.(index+1,state.files.length);progress.textContent=ko?`압축 중 ${index+1}/${state.files.length} · ${f.name}`:`Compressing ${index+1}/${state.files.length} · ${f.name}`;await new Promise(ok=>requestAnimationFrame(ok));try{const out=await encode(f,q,target,cfg);const ext=out.type==='image/png'?'png':out.type==='image/webp'?'webp':'jpg',name=f.name.replace(/\.[^.]+$/,'')+'-compressed.'+ext;state.output.push({name,blob:out.blob});totalIn+=f.size;totalOut+=out.blob.size;addResult(f,out.blob,name,(out.kept?(ko?'원본 유지':'original kept'):(ko?'압축 완료':'compressed'))+(target?(out.metTarget?(ko?' · 목표 달성':' · target met'):(ko?' · 목표 미달 (최선 결과)':' · target not reached (best effort)')):''))}catch(e){const p=document.createElement('p');p.textContent=f.name+': '+e.message;results.append(p)}}
if(totalIn){const panel=$('#compressionSummary');panel?.classList.remove('hidden');const pct=Math.round((1-totalOut/totalIn)*100);if($('#compressionSaved'))$('#compressionSaved').textContent=pct+'% smaller';if($('#compressionSize'))$('#compressionSize').textContent=fmt(totalIn)+' → '+fmt(totalOut);if($('#originalSize'))$('#originalSize').textContent=fmt(totalIn);if($('#compressedSize'))$('#compressedSize').textContent=fmt(totalOut);if($('#originalBar'))$('#originalBar').style.width='0%';if($('#compressedBar'))$('#compressedBar').style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{if($('#originalBar'))$('#originalBar').style.width='100%';if($('#compressedBar'))$('#compressedBar').style.width=Math.max(3,totalOut/totalIn*100)+'%';}));}
if(state.output.length>1)zipBtn?.classList.remove('hidden');progress.textContent=ko?`완료 · ${state.output.length}/${state.files.length}개 파일 처리됨`:`Complete · ${state.output.length} of ${state.files.length} files processed`;controls.forEach(el=>el.disabled=false);run.disabled=!state.files.length;
});
zipBtn?.addEventListener('click',async()=>{if(!window.JSZip){alert('ZIP download is unavailable. Please download individually.');return}zipBtn.disabled=true;try{const z=new window.JSZip();for(const item of state.output)z.file(item.name,item.blob);download(await z.generateAsync({type:'blob'}),'compressed-images.zip')}finally{zipBtn.disabled=false}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();