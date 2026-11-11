const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const tool=document.body.dataset.tool||"";
const TOP_LINKS=[
["compress","🗜️ Compress","../compress-image/"],
["jpg-compress","🟠 JPG Compressor","../jpg-compressor/"],
["png-compress","🔵 PNG Compressor","../png-compressor/"],
["resize","↔️ Resize","../resize-image/"],
["crop","✂️ Crop","../crop-image/"],
["convert","🔁 Convert","../convert-image/"],
["png-jpg","🟡 PNG to JPG","../png-to-jpg/"],
["jpg-png","🔷 JPG to PNG","../jpg-to-png/"],
["webp","🟣 To WebP","../image-to-webp/"],
["jpg","🟡 WebP to JPG","../webp-to-jpg/"],
["heic-jpg","📱 HEIC to JPG","../heic-to-jpg/"],
["rotate","↻ Rotate","../rotate-image/"],
["info","ⓘ Info","../image-info/"],
["metadata","🔎 Metadata","../metadata-checker/"],
["exif","🧹 EXIF Cleaner","../remove-exif/"]
];

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function formatBytes(bytes){
  if(bytes===0)return"0 B";
  const units=["B","KB","MB","GB"],i=Math.floor(Math.log(bytes)/Math.log(1024));
  return `${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${units[i]}`;
}
function baseName(name){return name.replace(/\.[^.]+$/,"")}
function extFor(type){return type==="image/jpeg"?"jpg":type==="image/png"?"png":type==="image/webp"?"webp":"img"}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function loadImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read image"))};
    img.src=url;
  });
}
function canvasBlob(canvas,type,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not create image")),type,quality));
}
function makeCanvas(img,w=img.naturalWidth,h=img.naturalHeight,type="image/png",backgroundColor="#ffffff"){
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const ctx=c.getContext("2d");
  if(type==="image/jpeg"){ctx.fillStyle=backgroundColor||"#ffffff";ctx.fillRect(0,0,w,h)}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(img,0,0,w,h);
  return c;
}
async function encodeToTarget(canvas,type,targetBytes,maxQuality=.92){
  if(!targetBytes)return canvasBlob(canvas,type,maxQuality);
  let lo=.08,hi=Math.max(.08,Math.min(1,maxQuality)),best=null;
  for(let i=0;i<8;i++){
    const q=(lo+hi)/2,blob=await canvasBlob(canvas,type,q);
    if(blob.size<=targetBytes){best=blob;lo=q}else hi=q;
  }
  return best||canvasBlob(canvas,type,.08);
}
function pngColorCountFromQuality(q){
  return Math.max(16,Math.min(256,Math.round(16+q*240)));
}
async function encodePngQuantized(file,{colors=256,targetBytes=0,maxWidth=0}={}){
  if(typeof UPNG==="undefined")throw new Error("PNG compression library did not load. Please refresh and try again.");
  const img=await loadImage(file),factor=maxWidth&&img.naturalWidth>maxWidth?maxWidth/img.naturalWidth:1,canvas=makeCanvas(img,Math.max(1,Math.round(img.naturalWidth*factor)),Math.max(1,Math.round(img.naturalHeight*factor)),"image/png");
  const ctx=canvas.getContext("2d",{willReadFrequently:true}),rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const tryEncode=c=>new Blob([UPNG.encode([rgba.buffer.slice(0)],canvas.width,canvas.height,c)],{type:"image/png"});
  const colorLimit=Number.isFinite(colors)?Math.max(0,Math.min(256,colors)):256;
  // 0 = lossless RGBA; respect chosen maximum palette when looking for a size target.
  const candidates=colorLimit===0?[0]:[...new Set([colorLimit,192,128,96,64,48,32,24,16,8].filter(c=>c<=colorLimit&&c>0))];
  let best=null,achieved=null;
  for(const c of (targetBytes?candidates:[colorLimit])){
    const blob=tryEncode(c);
    if(!best||blob.size<best.size)best=blob;
    if(targetBytes&&blob.size<=targetBytes){achieved=blob;break}
  }
  const output=achieved||best;
  if(!output||(file.size<=output.size&&factor===1))return {blob:file,keptOriginal:true};
  return {blob:output,keptOriginal:false};
}
function ratioText(w,h){
  const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(w,h);
  return `${w/g}:${h/g}`;
}
function setSummary(file,img){
  const el=$("#fileSummary"); if(!el)return;
  if(el.querySelector(".selected-files-grid"))return;
  el.classList.add("show");
  el.textContent=`${file.name} · ${img.naturalWidth}×${img.naturalHeight}px · ${formatBytes(file.size)}`;
}
function renderResult(file,blob,label){
  const box=$("#results"); if(!box)return;
  const card=document.createElement("div");card.className="result-card";
  const thumb=document.createElement("img");thumb.className="thumb";thumb.alt="";
  thumb.src=URL.createObjectURL(blob);
  const info=document.createElement("div");info.className="result-detail";
  const pct=file.size?Math.round((1-blob.size/file.size)*100):0;
  info.innerHTML=`<div class="result-name">${escapeHtml(label)}</div><div class="result-meta">${formatBytes(file.size)} → ${formatBytes(blob.size)}${pct>0?` · ${pct}% smaller`:""}</div>`;
  const a=document.createElement("a");a.className="download";a.textContent="Download";a.href=URL.createObjectURL(blob);a.download=label;
  card.append(thumb,info,a);box.appendChild(card);
}
function resetResults(){const r=$("#results");if(r)r.innerHTML=""}
function initDropzone({multiple=false,accept="image/*",onFiles}={}){
  const dz=$("#dropzone"),input=$("#fileInput");
  if(!dz||!input)return;
  let currentFiles=[],selectionUrls=[];
  input.multiple=multiple;input.accept=accept;

  const summary=(()=>{
    let el=$("#fileSummary");
    if(!el){
      el=document.createElement("div");el.id="fileSummary";el.className="file-summary";
      dz.insertAdjacentElement("afterend",el);
    }
    return el;
  })();

  const clearSelectionUrls=()=>{
    selectionUrls.forEach(url=>URL.revokeObjectURL(url));
    selectionUrls=[];
  };

  const renderSelection=()=>{
    clearSelectionUrls();
    if(!currentFiles.length){
      summary.classList.remove("show");
      summary.innerHTML="";
      return;
    }
    summary.classList.add("show");
    const head=document.createElement("div");head.className="selected-files-head";
    head.textContent="";
    const grid=document.createElement("div");grid.className="selected-files-grid";

    currentFiles.forEach((file,index)=>{
      const item=document.createElement("div");item.className="media-item selected-file";
      const visual=document.createElement("div");visual.className="selected-file-thumb";
      const canPreview=file.type.startsWith("image/")&&!/\.hei[cf]$/i.test(file.name);
      if(canPreview){
        const img=document.createElement("img"),url=URL.createObjectURL(file);selectionUrls.push(url);
        img.src=url;img.alt="";
        img.onerror=()=>{visual.innerHTML='<span aria-hidden="true">🖼️</span>'};
        visual.appendChild(img);
      }else{
        visual.innerHTML=`<span aria-hidden="true">${/\.hei[cf]$/i.test(file.name)?"📱":"🖼️"}</span>`;
      }

      const info=document.createElement("div");info.className="selected-file-info";
      info.innerHTML=`<div class="selected-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div><div class="selected-file-size">${formatBytes(file.size)}</div>`;

      const remove=document.createElement("button");remove.type="button";remove.className="btn ghost selected-file-remove";
      remove.setAttribute("aria-label",`Remove ${file.name}`);remove.textContent="Remove";
      remove.addEventListener("click",async e=>{
        e.preventDefault();e.stopPropagation();
        currentFiles=currentFiles.filter((_,i)=>i!==index);
        if(!currentFiles.length){
          $("#processBtn")&&( $("#processBtn").disabled=true );
          resetResults();
          const preview=$("#preview");if(preview){preview.innerHTML="";preview.classList.remove("show")}
          $("#cropStage")?.classList.add("hidden");
        }
        renderSelection();
        try{await Promise.resolve(onFiles?.([...currentFiles]));}catch(error){console.error("Image selection processing error:",error);}
      });

      item.append(visual,info,remove);grid.appendChild(item);
    });

    summary.innerHTML="";summary.append(head,grid);
  };

  const deliver=async files=>{
    currentFiles=multiple?[...currentFiles,...files]:files.slice(0,1);
    renderSelection();
    try { await Promise.resolve(onFiles?.([...currentFiles])); }
    catch(error){console.error("Image selection processing error:",error);const run=$("#processBtn");if(run)run.disabled=true;}
  };

  // Match PDF Compressor: the whole dropzone is interactive, but its
  // nested Choose button and the file input must never trigger a second picker.
  const openFilePicker=()=>input.click();
  $(".chooseBtn")?.addEventListener("click",openFilePicker);
  dz.addEventListener("click",e=>{
    if(e.target===input||e.target.closest("button, input, a, label"))return;
    openFilePicker();
  });
  dz.addEventListener("keydown",e=>{
    if(e.target!==dz||(e.key!=="Enter"&&e.key!==" "))return;
    e.preventDefault();
    openFilePicker();
  });
  ["dragenter","dragover"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add("dragover")}));
  ["dragleave","drop"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove("dragover")}));
  dz.addEventListener("drop",e=>deliver([...e.dataTransfer.files].filter(f=>f.type.startsWith("image/")||/\.(heic|heif)$/i.test(f.name))));
  input.addEventListener("change",()=>{const selected=[...input.files];input.value="";deliver(selected)});
}
function addBottomTabs(){
  const ad=$(".ad-slot"),top=$(".tool-tabs");if(!ad||!top)return;
  const wrap=document.createElement("section");wrap.className="more-tools";
  const label=document.createElement("div");label.className="more-tools-label";label.textContent="More image tools";
  const nav=top.cloneNode(true);nav.classList.add("bottom-tabs");nav.removeAttribute("aria-label");
  wrap.append(label,nav);ad.insertAdjacentElement("afterend",wrap);
}
addBottomTabs();

function makeCrcTable(){
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    table[n]=c>>>0;
  }
  return table;
}
const CRC_TABLE=makeCrcTable();
function crc32(bytes){
  let c=0xffffffff;
  for(const b of bytes)c=CRC_TABLE[(c^b)&0xff]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function u16le(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32le(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
async function zipStored(entries){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const entry of entries){
    const name=enc.encode(entry.name),data=new Uint8Array(await entry.blob.arrayBuffer()),crc=crc32(data);
    const local=concatBytes([
      u32le(0x04034b50),u16le(20),u16le(0x0800),u16le(0),u16le(0),u16le(0),
      u32le(crc),u32le(data.length),u32le(data.length),u16le(name.length),u16le(0),name,data
    ]);
    locals.push(local);
    const central=concatBytes([
      u32le(0x02014b50),u16le(20),u16le(20),u16le(0x0800),u16le(0),u16le(0),u16le(0),
      u32le(crc),u32le(data.length),u32le(data.length),u16le(name.length),u16le(0),u16le(0),
      u16le(0),u16le(0),u32le(0),u32le(offset),name
    ]);
    centrals.push(central);offset+=local.length;
  }
  const centralSize=centrals.reduce((n,p)=>n+p.length,0);
  const end=concatBytes([
    u32le(0x06054b50),u16le(0),u16le(0),u16le(entries.length),u16le(entries.length),
    u32le(centralSize),u32le(offset),u16le(0)
  ]);
  return new Blob([...locals,...centrals,end],{type:"application/zip"});
}
function renderCompressionSummary(original,compressed){
  const wrap=$("#compressionSummary");if(!wrap)return;
  const max=Math.max(original,compressed,1),saved=original-compressed,pct=original?Math.round((saved/original)*100):0;
  $("#originalSize").textContent=formatBytes(original);
  $("#compressedSize").textContent=formatBytes(compressed);
  $("#compressionSize").textContent=`${formatBytes(original)} → ${formatBytes(compressed)}`;
  $("#compressionSaved").textContent=saved>=0?`${pct}% smaller · saved ${formatBytes(saved)}`:`${Math.abs(pct)}% larger`;
  wrap.classList.remove("hidden");
  const ob=$("#originalBar"),cb=$("#compressedBar");
  ob.style.width="0%";cb.style.width="0%";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    ob.style.width=`${Math.max(5,original/max*100)}%`;
    cb.style.width=`${Math.max(5,compressed/max*100)}%`;
  }));
}
async function initCompress({accept="image/*",outputType=null,qualityEnabled=true}={}){
  let files=[],processed=[];
  const clearBatch=()=>{
    processed=[];resetResults();
    $("#downloadZipBtn")?.classList.add("hidden");
    $("#compressionSummary")?.classList.add("hidden");
  };
  initDropzone({multiple:true,accept,onFiles:fs=>{
    files=fs.filter(f=>accept==="image/*"||f.type===accept);clearBatch();$("#fileSummary").classList.add("show");
    
    $("#processBtn").disabled=!files.length;
  }});
  $("#quality")?.addEventListener("input",e=>$("#qualityValue").textContent=e.target.value+"%");
  const targetToggle=null,targetOptions=null,targetInput=null;
  const settings=window.ImageCompressionSettings?.init?.(document);
  $("#downloadZipBtn")?.addEventListener("click",async()=>{
    if(processed.length<2)return;
    const btn=$("#downloadZipBtn");btn.disabled=true;btn.textContent="Building ZIP…";
    try{downloadBlob(await zipStored(processed),`compressed-images-${processed.length}.zip`)}
    finally{btn.disabled=false;btn.textContent="Download all as ZIP"}
  });
  $("#processBtn")?.addEventListener("click",async()=>{
    clearBatch();$("#processBtn").disabled=true;
    const isKorean=location.pathname.startsWith("/ko/");
    let status=$("#compressProgress");
    if(!status){status=document.createElement("div");status.id="compressProgress";status.className="compress-progress";status.setAttribute("role","status");status.setAttribute("aria-live","polite");$("#processBtn").parentElement.insertAdjacentElement("afterend",status);}
    const controls=["#quality","#pngColors","#compressTargetValue","#compressTargetUnit","#compressMaxWidth"].map(sel=>$(sel)).filter(Boolean).concat([...document.querySelectorAll(".compress-choice button")]);
    controls.forEach(el=>el.disabled=true);
    status.textContent=isKorean?"이미지 압축 준비 중…":"Preparing image compression…";
    const q=qualityEnabled?Number($("#quality")?.value||80)/100:.92;
    const cfg=settings?.get()||{target:0,maxWidth:0,format:null};
    const targetBytes=cfg.target;
    let totalOriginal=0,totalCompressed=0;
    for(const [index,file] of files.entries()){
      window.ETTProcessingCount?.(index+1,files.length);
      status.textContent=isKorean?`압축 중 ${index+1}/${files.length} · ${file.name}`:`Compressing ${index+1}/${files.length} · ${file.name}`;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      try{
        let type=outputType||cfg.format||(["image/jpeg","image/png","image/webp"].includes(file.type)?file.type:"image/jpeg"),blob,keptOriginal=false;
        if(type==="image/png"&&file.type==="image/png"&&typeof UPNG!=="undefined"){
          const selected=Number($("#pngColors")?.value||pngColorCountFromQuality(q));
          try{
            const result=await encodePngQuantized(file,{colors:selected,targetBytes,maxWidth:cfg.maxWidth});
            blob=result.blob;keptOriginal=result.keptOriginal;
          }catch(error){
            const img=await loadImage(file),factor=cfg.maxWidth&&img.naturalWidth>cfg.maxWidth?cfg.maxWidth/img.naturalWidth:1,canvas=makeCanvas(img,Math.max(1,Math.round(img.naturalWidth*factor)),Math.max(1,Math.round(img.naturalHeight*factor)),"image/png");
            const fallback=await canvasBlob(canvas,"image/png");
            keptOriginal=fallback.size>=file.size;
            blob=keptOriginal?file:fallback;
          }
        }else{
          const img=await loadImage(file),factor=cfg.maxWidth&&img.naturalWidth>cfg.maxWidth?cfg.maxWidth/img.naturalWidth:1,canvas=makeCanvas(img,Math.max(1,Math.round(img.naturalWidth*factor)),Math.max(1,Math.round(img.naturalHeight*factor)),type);
          blob=(type==="image/jpeg"||type==="image/webp")?await encodeToTarget(canvas,type,targetBytes,q):await canvasBlob(canvas,type,q);
          if(blob.size>=file.size&&type===file.type&&(!cfg.maxWidth||cfg.maxWidth>=img.naturalWidth)){blob=file;keptOriginal=true}
        }
        const name=`${baseName(file.name)}-compressed.${extFor(type)}`;
        processed.push({name,blob});totalOriginal+=file.size;totalCompressed+=blob.size;
        renderResult(file,blob,name);
        if(keptOriginal){
          const meta=$("#results")?.lastElementChild?.querySelector(".result-meta");
          if(meta)meta.textContent=`${formatBytes(file.size)} · already optimized — original kept${targetBytes?(file.size<=targetBytes?" · target already met":" · target not reached"):""}`;
        }else if(targetBytes){
          const meta=$("#results")?.lastElementChild?.querySelector(".result-meta");
          if(meta)meta.textContent+=blob.size<=targetBytes?" · target reached":" · target not reached (best effort)";
        }
      }catch(e){
        const box=$("#results"),card=document.createElement("div");card.className="result-card";
        card.innerHTML=`<div class="thumb" style="display:grid;place-items:center">!</div><div><div class="result-name">${escapeHtml(file.name)}</div><div class="result-meta">${escapeHtml(e.message||"Could not compress this file")}</div></div>`;box?.appendChild(card);
      }
    }
    if(processed.length){
      renderCompressionSummary(totalOriginal,totalCompressed);
      if(processed.length>1)$("#downloadZipBtn")?.classList.remove("hidden");
    }
    window.ETTProcessingCount?.(processed.length,files.length);
    status.textContent=isKorean?`완료 · ${processed.length}/${files.length}개 파일 처리됨`:`Complete · ${processed.length} of ${files.length} files processed`;
    controls.forEach(el=>el.disabled=false);
    $("#processBtn").disabled=false;
  });
}
function enableSimpleBatch(toolName,getFiles,makeOne){
  const button=$("#processBtn"),zip=$("#downloadZipBtn");if(!button)return;
  let results=[];if(!zip){const z=document.createElement("button");z.id="downloadZipBtn";z.type="button";z.className="btn secondary hidden";z.textContent="Download all as ZIP";button.insertAdjacentElement("afterend",z)}
  $("#downloadZipBtn").addEventListener("click",async()=>{if(results.length<2)return;const b=$("#downloadZipBtn");b.disabled=true;try{downloadBlob(await zipStored(results),toolName+"-images.zip")}finally{b.disabled=false}});
  button.addEventListener("click",async(event)=>{const selected=getFiles();if(selected.length<2)return;event.stopImmediatePropagation();results=[];resetResults();button.disabled=true;for(const f of selected){try{const x=await makeOne(f);results.push(x);renderResult(f,x.blob,x.name)}catch(e){const p=document.createElement("p");p.textContent=f.name+": "+(e.message||"Processing failed");$("#results")?.append(p)}}$("#downloadZipBtn").classList.toggle("hidden",results.length<2);button.disabled=false;},true);
}
function initResize(){
  let batchFiles=[];
  let file=null,img=null,lock=true;
  const width=$("#width"),height=$("#height"),mode=$("#resizeMode"),pct=$("#resizePercent"),behavior=$("#resizeBehavior");
  const makeResizeCanvas=(w,h,type="image/png")=>{
    const fit=behavior?.value||"stretch";
    if(fit==="stretch")return makeCanvas(img,w,h,type);
    if(fit==="contain"){
      const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
      const outW=Math.max(1,Math.round(img.naturalWidth*scale)),outH=Math.max(1,Math.round(img.naturalHeight*scale));
      return makeCanvas(img,outW,outH,type);
    }
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const ctx=c.getContext("2d");
    if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)}
    const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
    const drawW=img.naturalWidth*scale,drawH=img.naturalHeight*scale;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,(w-drawW)/2,(h-drawH)/2,drawW,drawH);
    return c;
  };
  const renderPreview=(w,h)=>{
    if(!img)return;
    const type=["image/jpeg","image/png","image/webp"].includes(file?.type)?file.type:"image/png";
    const c=mode?.value==="percent"?makeCanvas(img,w,h,type):makeResizeCanvas(w,h,type);
    c.className="preview-canvas";
    const wrap=$("#preview");wrap.innerHTML="";wrap.append(c);wrap.classList.add("show");
  };
  const syncMode=()=>{
    const percent=mode?.value==="percent";
    $("#pixelControls")?.classList.toggle("hidden",percent);
    $("#percentControls")?.classList.toggle("hidden",!percent);
    if(img&&percent){
      const p=Number(pct?.value||50)/100;
      renderPreview(Math.max(1,Math.round(img.naturalWidth*p)),Math.max(1,Math.round(img.naturalHeight*p)));
    }else if(img)renderPreview(Math.max(1,Number(width.value)||img.naturalWidth),Math.max(1,Number(height.value)||img.naturalHeight));
  };
  initDropzone({multiple:true,onFiles:async fs=>{batchFiles=fs;
    file=fs[0];if(!file)return;img=await loadImage(file);setSummary(file,img);
    width.value=img.naturalWidth;height.value=img.naturalHeight;$("#processBtn").disabled=false;syncMode();
  }});
  $("#lock")?.addEventListener("change",e=>lock=e.target.checked);
  width?.addEventListener("input",()=>{if(lock&&img&&width.value)height.value=Math.max(1,Math.round(Number(width.value)*img.naturalHeight/img.naturalWidth));syncMode()});
  height?.addEventListener("input",()=>{if(lock&&img&&height.value)width.value=Math.max(1,Math.round(Number(height.value)*img.naturalWidth/img.naturalHeight));syncMode()});
  mode?.addEventListener("change",syncMode);behavior?.addEventListener("change",syncMode);
  pct?.addEventListener("input",()=>{if($("#resizePercentValue"))$("#resizePercentValue").textContent=pct.value+"%";syncMode()});
  $$(".preset-btn[data-size]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!img)return;const [w,h]=btn.dataset.size.split("x").map(Number);
    mode.value="pixels";width.value=w;height.value=h;syncMode();
  }));
  enableSimpleBatch("resized",()=>batchFiles,async f=>{const source=await loadImage(f);const type=["image/jpeg","image/png","image/webp"].includes(f.type)?f.type:"image/png";let w,h;if(mode?.value==="percent"){const scale=Math.max(.1,Number(pct?.value||50)/100);w=Math.max(1,Math.round(source.naturalWidth*scale));h=Math.max(1,Math.round(source.naturalHeight*scale))}else{w=Math.max(1,Number(width.value)||1);h=Math.max(1,Number(height.value)||1)}let canvas;if(mode?.value!=="percent"&&behavior?.value==="contain"){const scale=Math.min(w/source.naturalWidth,h/source.naturalHeight);w=Math.max(1,Math.round(source.naturalWidth*scale));h=Math.max(1,Math.round(source.naturalHeight*scale))}canvas=makeCanvas(source,w,h,type);if(mode?.value!=="percent"&&behavior?.value==="cover"){const ctx=canvas.getContext("2d"),scale=Math.max(w/source.naturalWidth,h/source.naturalHeight);ctx.clearRect(0,0,w,h);if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)}ctx.drawImage(source,(w-source.naturalWidth*scale)/2,(h-source.naturalHeight*scale)/2,source.naturalWidth*scale,source.naturalHeight*scale)}return{name:baseName(f.name)+"-"+w+"x"+h+"."+extFor(type),blob:await canvasBlob(canvas,type,.92)}});
  $("#processBtn")?.addEventListener("click",async()=>{
    if(!file||!img)return;resetResults();
    let w,h,canvas;
    if(mode?.value==="percent"){
      const p=Math.max(.1,Number(pct?.value||50)/100);w=Math.max(1,Math.round(img.naturalWidth*p));h=Math.max(1,Math.round(img.naturalHeight*p));
      const type=["image/jpeg","image/png","image/webp"].includes(file.type)?file.type:"image/png";
      canvas=makeCanvas(img,w,h,type);
    }else{
      w=Math.max(1,Number(width.value)||1);h=Math.max(1,Number(height.value)||1);
      const type=["image/jpeg","image/png","image/webp"].includes(file.type)?file.type:"image/png";
      canvas=makeResizeCanvas(w,h,type);
      w=canvas.width;h=canvas.height;
    }
    const type=["image/jpeg","image/png","image/webp"].includes(file.type)?file.type:"image/png";
    const blob=await canvasBlob(canvas,type,.92);
    renderResult(file,blob,`${baseName(file.name)}-${w}x${h}.${extFor(type)}`);
  });
}
async function initCrop(){
  let batchFiles=[];
  let file=null,img=null,ratio=null,objectUrl=null;
  const stage=$("#cropStage"),stageImg=$("#cropImage"),box=$("#cropBox");
  const vals=()=>({
    x:Math.max(0,Number($("#cropX").value)||0),y:Math.max(0,Number($("#cropY").value)||0),
    w:Math.max(1,Number($("#cropW").value)||1),h:Math.max(1,Number($("#cropH").value)||1)
  });
  const clampCrop=v=>{
    if(!img)return v;
    v.x=Math.max(0,Math.min(v.x,img.naturalWidth-1));v.y=Math.max(0,Math.min(v.y,img.naturalHeight-1));
    v.w=Math.max(1,Math.min(v.w,img.naturalWidth-v.x));v.h=Math.max(1,Math.min(v.h,img.naturalHeight-v.y));
    return v;
  };
  const updateOutput=()=>{
    if(!img)return;const v=clampCrop(vals());
    const c=document.createElement("canvas");c.width=v.w;c.height=v.h;c.className="preview-canvas";
    c.getContext("2d").drawImage(img,v.x,v.y,v.w,v.h,0,0,v.w,v.h);
    const wrap=$("#preview");wrap.innerHTML="";wrap.append(c);wrap.classList.add("show");
    syncBox();
  };
  const syncBox=()=>{
    if(!img||!stageImg?.complete||!box)return;
    const rect=stageImg.getBoundingClientRect(),stageRect=stage.getBoundingClientRect(),v=clampCrop(vals());
    if(!rect.width||!rect.height)return;
    const sx=rect.width/img.naturalWidth,sy=rect.height/img.naturalHeight;
    box.style.left=(rect.left-stageRect.left+v.x*sx)+"px";
    box.style.top=(rect.top-stageRect.top+v.y*sy)+"px";
    box.style.width=(v.w*sx)+"px";box.style.height=(v.h*sy)+"px";
  };
  const setCrop=(x,y,w,h)=>{
    const v=clampCrop({x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)});
    $("#cropX").value=v.x;$("#cropY").value=v.y;$("#cropW").value=v.w;$("#cropH").value=v.h;updateOutput();
  };
  const applyRatio=r=>{
    ratio=r;
    $$(".crop-ratios .preset-btn").forEach(b=>b.classList.toggle("active",(b.dataset.ratio==="free"&&r===null)||Number(b.dataset.ratio)===r));
    if(!img||!r)return;
    let w=img.naturalWidth,h=Math.round(w/r);
    if(h>img.naturalHeight){h=img.naturalHeight;w=Math.round(h*r)}
    setCrop((img.naturalWidth-w)/2,(img.naturalHeight-h)/2,w,h);
  };
  initDropzone({multiple:true,onFiles:async fs=>{batchFiles=fs;
    file=fs[0];if(!file)return;img=await loadImage(file);setSummary(file,img);
    $("#cropX").value=0;$("#cropY").value=0;$("#cropW").value=img.naturalWidth;$("#cropH").value=img.naturalHeight;
    $("#processBtn").disabled=false;
    if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);stageImg.src=objectUrl;stage.classList.remove("hidden");
    stageImg.onload=()=>{updateOutput();syncBox()};
  }});
  ["#cropX","#cropY","#cropW","#cropH"].forEach(s=>$(s)?.addEventListener("input",()=>{
    if(ratio&&s==="#cropW")$("#cropH").value=Math.max(1,Math.round(Number($("#cropW").value)/ratio));
    if(ratio&&s==="#cropH")$("#cropW").value=Math.max(1,Math.round(Number($("#cropH").value)*ratio));
    updateOutput();
  }));
  $$(".crop-ratios .preset-btn").forEach(btn=>btn.addEventListener("click",()=>applyRatio(btn.dataset.ratio==="free"?null:Number(btn.dataset.ratio))));
  $("#centerSquare")?.addEventListener("click",()=>applyRatio(1));
  let drag=null;
  box?.addEventListener("pointerdown",e=>{
    if(!img)return;e.preventDefault();box.setPointerCapture(e.pointerId);
    const isResize=e.target.classList.contains("crop-handle"),rect=stageImg.getBoundingClientRect(),v=vals();
    drag={isResize,startX:e.clientX,startY:e.clientY,v,rect};
  });
  box?.addEventListener("pointermove",e=>{
    if(!drag||!img)return;
    const sx=img.naturalWidth/drag.rect.width,sy=img.naturalHeight/drag.rect.height;
    const dx=(e.clientX-drag.startX)*sx,dy=(e.clientY-drag.startY)*sy;
    if(drag.isResize){
      let w=Math.max(1,drag.v.w+dx),h=Math.max(1,drag.v.h+dy);
      if(ratio){h=w/ratio;if(h>img.naturalHeight-drag.v.y){h=img.naturalHeight-drag.v.y;w=h*ratio}}
      setCrop(drag.v.x,drag.v.y,w,h);
    }else setCrop(drag.v.x+dx,drag.v.y+dy,drag.v.w,drag.v.h);
  });
  const endDrag=()=>drag=null;box?.addEventListener("pointerup",endDrag);box?.addEventListener("pointercancel",endDrag);
  window.addEventListener("resize",syncBox);
  enableSimpleBatch("cropped",()=>batchFiles,async f=>{const source=await loadImage(f);const type=["image/jpeg","image/png","image/webp"].includes(f.type)?f.type:"image/png",v=vals();const x=Math.max(0,Math.min(source.naturalWidth-1,Math.round(v.x))),y=Math.max(0,Math.min(source.naturalHeight-1,Math.round(v.y))),w=Math.max(1,Math.min(source.naturalWidth-x,Math.round(v.w))),h=Math.max(1,Math.min(source.naturalHeight-y,Math.round(v.h)));const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d");if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)}ctx.drawImage(source,x,y,w,h,0,0,w,h);return{name:baseName(f.name)+"-cropped."+extFor(type),blob:await canvasBlob(c,type,.92)}});
  $("#processBtn")?.addEventListener("click",async()=>{
    if(!file||!img)return;resetResults();const v=clampCrop(vals());
    const type=["image/jpeg","image/png","image/webp"].includes(file.type)?file.type:"image/png";
    const c=document.createElement("canvas");c.width=v.w;c.height=v.h;const ctx=c.getContext("2d");
    if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,v.w,v.h)}
    ctx.drawImage(img,v.x,v.y,v.w,v.h,0,0,v.w,v.h);
    const blob=await canvasBlob(c,type,.92);renderResult(file,blob,`${baseName(file.name)}-cropped.${extFor(type)}`);
  });
}
function initConvert(forceType=null,accept="image/*"){
  let files=[],processed=[];
  const clearBatch=()=>{processed=[];resetResults();$("#downloadZipBtn")?.classList.add("hidden")};
  initDropzone({multiple:true,accept,onFiles:fs=>{
    files=fs.filter(f=>accept==="image/*"||f.type===accept);clearBatch();
    $("#fileSummary").classList.add("show");$("#processBtn").disabled=!files.length
  }});
  $("#quality")?.addEventListener("input",e=>$("#qualityValue").textContent=e.target.value+"%");
  const formatSelect=$("#format"),backgroundControl=$("#backgroundControl");
  const syncBackgroundControl=()=>{
    if(!backgroundControl)return;
    const outputType=forceType||formatSelect?.value;
    backgroundControl.classList.toggle("hidden",outputType!=="image/jpeg");
  };
  formatSelect?.addEventListener("change",syncBackgroundControl);syncBackgroundControl();
  $("#downloadZipBtn")?.addEventListener("click",async()=>{
    if(processed.length<2)return;
    const btn=$("#downloadZipBtn");btn.disabled=true;btn.textContent="Building ZIP…";
    try{downloadBlob(await zipStored(processed),`converted-images-${processed.length}.zip`)}
    finally{btn.disabled=false;btn.textContent="Download all as ZIP"}
  });
  $("#processBtn")?.addEventListener("click",async()=>{
    clearBatch();$("#processBtn").disabled=true;
    const q=Number($("#quality")?.value||92)/100,type=forceType||$("#format").value;
    for(const file of files){
      try{
        const img=await loadImage(file),background=$("#backgroundColor")?.value||"#ffffff",canvas=makeCanvas(img,img.naturalWidth,img.naturalHeight,type,background);
        const blob=await canvasBlob(canvas,type,q),name=`${baseName(file.name)}.${extFor(type)}`;
        processed.push({name,blob});renderResult(file,blob,name);
      }catch(e){}
    }
    if(processed.length>1)$("#downloadZipBtn")?.classList.remove("hidden");
    $("#processBtn").disabled=false;
  });
}
function initHeicToJpg(){
  let files=[],processed=[];
  const clearBatch=()=>{processed=[];resetResults();$("#downloadZipBtn")?.classList.add("hidden")};
  initDropzone({multiple:true,accept:".heic,.heif,image/heic,image/heif",onFiles:fs=>{
    files=fs.filter(f=>/\.hei[cf]$/i.test(f.name)||f.type==="image/heic"||f.type==="image/heif");clearBatch();
    $("#fileSummary").classList.add("show");$("#fileSummary").textContent=`${files.length} photo${files.length===1?"":"s"} ready`;$("#processBtn").disabled=!files.length;
  }});
  $("#quality")?.addEventListener("input",e=>$("#qualityValue").textContent=e.target.value+"%");
  $("#downloadZipBtn")?.addEventListener("click",async()=>{
    if(processed.length<2)return;const btn=$("#downloadZipBtn");btn.disabled=true;btn.textContent="Building ZIP…";
    try{downloadBlob(await zipStored(processed),`heic-to-jpg-${processed.length}.zip`)}
    finally{btn.disabled=false;btn.textContent="Download all as ZIP"}
  });
  $("#processBtn")?.addEventListener("click",async()=>{
    clearBatch();$("#processBtn").disabled=true;const q=Number($("#quality")?.value||92)/100;
    for(const file of files){
      try{
        if(typeof heic2any!=="function")throw new Error("HEIC converter did not load. Please refresh and try again.");
        let out=await heic2any({blob:file,toType:"image/jpeg",quality:q});
        if(Array.isArray(out))out=out[0];
        const blob=out instanceof Blob?out:new Blob([out],{type:"image/jpeg"}),name=`${baseName(file.name)}.jpg`;
        processed.push({name,blob});renderResult(file,blob,name);
      }catch(e){
        const box=$("#results"),card=document.createElement("div");card.className="result-card";
        card.innerHTML=`<div class="thumb" style="display:grid;place-items:center">!</div><div><div class="result-name">${escapeHtml(file.name)}</div><div class="result-meta">${escapeHtml(e.message||"Could not convert this HEIC file")}</div></div>`;box?.appendChild(card);
      }
    }
    if(processed.length>1)$("#downloadZipBtn")?.classList.remove("hidden");
    $("#processBtn").disabled=false;
  });
}
async function initRotate(){
  let batchFiles=[];
  let file=null,img=null,angle=0,flipX=1,flipY=1;
  const draw=()=>{
    if(!img)return null;
    const swap=Math.abs(angle)%180===90,c=document.createElement("canvas");
    c.width=swap?img.naturalHeight:img.naturalWidth;c.height=swap?img.naturalWidth:img.naturalHeight;c.className="preview-canvas";
    const ctx=c.getContext("2d");ctx.translate(c.width/2,c.height/2);ctx.rotate(angle*Math.PI/180);ctx.scale(flipX,flipY);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);return c;
  };
  const preview=()=>{const c=draw();if(!c)return;const w=$("#preview");w.innerHTML="";w.append(c);w.classList.add("show")};
  initDropzone({multiple:true,onFiles:async fs=>{batchFiles=fs;file=fs[0];if(!file)return;img=await loadImage(file);angle=0;flipX=flipY=1;setSummary(file,img);$("#processBtn").disabled=false;preview()}});
  $("#left")?.addEventListener("click",()=>{angle=(angle-90)%360;preview()});
  $("#right")?.addEventListener("click",()=>{angle=(angle+90)%360;preview()});
  $("#flipH")?.addEventListener("click",()=>{flipX*=-1;preview()});
  $("#flipV")?.addEventListener("click",()=>{flipY*=-1;preview()});
  enableSimpleBatch("edited",()=>batchFiles,async f=>{const source=await loadImage(f),type=["image/jpeg","image/png","image/webp"].includes(f.type)?f.type:"image/png",swap=Math.abs(angle)%180===90,c=document.createElement("canvas");c.width=swap?source.naturalHeight:source.naturalWidth;c.height=swap?source.naturalWidth:source.naturalHeight;const ctx=c.getContext("2d");ctx.translate(c.width/2,c.height/2);ctx.rotate(angle*Math.PI/180);ctx.scale(flipX,flipY);ctx.drawImage(source,-source.naturalWidth/2,-source.naturalHeight/2);return{name:baseName(f.name)+"-edited."+extFor(type),blob:await canvasBlob(c,type,.92)}});
  $("#processBtn")?.addEventListener("click",async()=>{
    if(!file||!img)return;resetResults();const c=draw();const type=["image/jpeg","image/png","image/webp"].includes(file.type)?file.type:"image/png";
    const blob=await canvasBlob(c,type,.92);renderResult(file,blob,`${baseName(file.name)}-edited.${extFor(type)}`);
  });
}
function initInfo(){
  initDropzone({multiple:true,onFiles:async files=>{
    const out=$("#results");out.innerHTML="";
    for(const file of files){
      try{
        const img=await loadImage(file),card=document.createElement("div");card.className="info-card";
        card.innerHTML=`<h2>${file.name}</h2><p>${img.naturalWidth} × ${img.naturalHeight}px · ${ratioText(img.naturalWidth,img.naturalHeight)} · ${formatBytes(file.size)} · ${file.type||"Unknown format"}</p>`;
        out.append(card);
      }catch(e){}
    }
  }});
}
if(tool==="compress"&&!window.__dedicatedImageCompressor)initCompress();
if(tool==="jpg-compress")initCompress({accept:"image/jpeg",outputType:"image/jpeg"});
if(tool==="png-compress")initCompress({accept:"image/png",outputType:"image/png",qualityEnabled:false});
if(tool==="resize")initResize();
if(tool==="crop")initCrop();
if(tool==="convert")initConvert();
if(tool==="png-jpg")initConvert("image/jpeg","image/png");
if(tool==="jpg-png")initConvert("image/png","image/jpeg");
if(tool==="webp")initConvert("image/webp");
if(tool==="jpg")initConvert("image/jpeg","image/webp");
if(tool==="heic-jpg")initHeicToJpg();
if(tool==="rotate")initRotate();
if(tool==="info")initInfo();
if(tool==="metadata")initMetadataChecker();
if(tool==="exif")initExifCleaner();

function asciiSlice(bytes,start,end){
  let s=""; const lim=Math.min(end,bytes.length);
  for(let i=start;i<lim;i++) s+=String.fromCharCode(bytes[i]);
  return s;
}
function containsAscii(bytes,needle){
  const n=[...needle].map(c=>c.charCodeAt(0));
  outer: for(let i=0;i<=bytes.length-n.length;i++){
    for(let j=0;j<n.length;j++) if(bytes[i+j]!==n[j]) continue outer;
    return true;
  }
  return false;
}
function readU16BE(b,o){return (b[o]<<8)|b[o+1]}
function readU32BE(b,o){return ((b[o]*0x1000000)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3])>>>0}
function readU32LE(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0}
function concatBytes(parts){
  const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let o=0;
  for(const p of parts){out.set(p,o);o+=p.length} return out;
}
function hasGpsInTiff(tiff){
  if(tiff.length<8)return false;
  const le=tiff[0]===0x49&&tiff[1]===0x49,be=tiff[0]===0x4d&&tiff[1]===0x4d;
  if(!le&&!be)return false;
  const u16=o=>le?(tiff[o]|(tiff[o+1]<<8)):readU16BE(tiff,o);
  const u32=o=>le?readU32LE(tiff,o):readU32BE(tiff,o);
  const ifd0=u32(4); if(ifd0+2>tiff.length)return false;
  const count=u16(ifd0);
  for(let i=0;i<count;i++){
    const o=ifd0+2+i*12;if(o+12>tiff.length)break;
    if(u16(o)===0x8825)return true;
  }
  return false;
}
function readExifOrientation(tiff){
  if(tiff.length>=6&&asciiSlice(tiff,0,6)==="Exif\0\0")tiff=tiff.slice(6);
  if(tiff.length<8)return null;
  const le=tiff[0]===0x49&&tiff[1]===0x49,be=tiff[0]===0x4d&&tiff[1]===0x4d;
  if(!le&&!be)return null;
  const u16=o=>o+2<=tiff.length?(le?(tiff[o]|(tiff[o+1]<<8)):readU16BE(tiff,o)):0;
  const u32=o=>o+4<=tiff.length?(le?readU32LE(tiff,o):readU32BE(tiff,o)):0;
  const ifd0=u32(4);if(ifd0+2>tiff.length)return null;
  const count=u16(ifd0);
  for(let i=0;i<count;i++){
    const o=ifd0+2+i*12;if(o+12>tiff.length)break;
    if(u16(o)===0x0112&&u16(o+2)===3&&u32(o+4)>=1){
      const value=u16(o+8);
      return value>=1&&value<=8?value:null;
    }
  }
  return null;
}
function orientationLabel(value){
  return ({1:"Standard",2:"Mirrored horizontal",3:"180°",4:"Mirrored vertical",5:"Mirrored + 90°",6:"90° clockwise",7:"Mirrored + 90° counterclockwise",8:"90° counterclockwise"})[value]||"Not found";
}
function minimalOrientationTiff(orientation){
  return new Uint8Array([
    0x49,0x49,0x2a,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,
    0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,
    orientation&255,(orientation>>>8)&255,0x00,0x00,
    0x00,0x00,0x00,0x00
  ]);
}
function u16be(n){return new Uint8Array([(n>>>8)&255,n&255])}
function u32be(n){return new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255])}
function makeJpegOrientationSegment(orientation){
  const prefix=new Uint8Array([0x45,0x78,0x69,0x66,0x00,0x00]),payload=concatBytes([prefix,minimalOrientationTiff(orientation)]);
  return concatBytes([new Uint8Array([0xff,0xe1]),u16be(payload.length+2),payload]);
}
function makePngChunk(kind,data){
  const typeBytes=new TextEncoder().encode(kind),body=concatBytes([typeBytes,data]),crc=crc32(body);
  return concatBytes([u32be(data.length),typeBytes,data,u32be(crc)]);
}
function makeWebpChunk(kind,data){
  const typeBytes=new TextEncoder().encode(kind),pad=data.length%2?new Uint8Array([0]):new Uint8Array(0);
  return concatBytes([typeBytes,u32le(data.length),data,pad]);
}
function inspectMetadataBytes(bytes,type){
  const result={format:type||"Unknown",exif:false,gps:false,xmp:false,provenance:false,orientation:null,notes:[]};
  if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xd8){
    result.format="JPEG";let p=2;
    while(p+4<=bytes.length&&bytes[p]===0xff){
      const marker=bytes[p+1];
      if(marker===0xda||marker===0xd9)break;
      if(marker===0x00||marker===0xd8){p+=2;continue}
      const len=readU16BE(bytes,p+2);if(len<2||p+2+len>bytes.length)break;
      const start=p+4,end=p+2+len,head=asciiSlice(bytes,start,Math.min(end,start+48));
      if(marker===0xe1&&head.startsWith("Exif\0\0")){
        result.exif=true;const tiff=bytes.slice(start+6,end);result.gps=result.gps||hasGpsInTiff(tiff);result.orientation=result.orientation||readExifOrientation(tiff);
      }
      if(marker===0xe1&&head.includes("http://ns.adobe.com/xap/1.0/"))result.xmp=true;
      if(marker===0xeb)result.provenance=result.provenance||containsAscii(bytes.slice(start,end),"c2pa")||containsAscii(bytes.slice(start,end),"jumb");
      p=end;
    }
  }else if(bytes.length>=8&&asciiSlice(bytes,1,4)==="PNG"){
    result.format="PNG";let p=8;
    while(p+12<=bytes.length){
      const len=readU32BE(bytes,p),kind=asciiSlice(bytes,p+4,p+8),dataStart=p+8,dataEnd=dataStart+len;
      if(dataEnd+4>bytes.length)break;
      const data=bytes.slice(dataStart,dataEnd);
      if(kind==="eXIf"){result.exif=true;result.gps=result.gps||hasGpsInTiff(data);result.orientation=result.orientation||readExifOrientation(data)}
      if((kind==="iTXt"||kind==="tEXt"||kind==="zTXt")&&(containsAscii(data,"XML:com.adobe.xmp")||containsAscii(data,"xmp")))result.xmp=true;
      if(kind==="caBX"||containsAscii(data,"c2pa")||containsAscii(data,"contentauth"))result.provenance=true;
      p=dataEnd+4;if(kind==="IEND")break;
    }
  }else if(bytes.length>=12&&asciiSlice(bytes,0,4)==="RIFF"&&asciiSlice(bytes,8,12)==="WEBP"){
    result.format="WebP";let p=12;
    while(p+8<=bytes.length){
      const kind=asciiSlice(bytes,p,p+4),len=readU32LE(bytes,p+4),dataStart=p+8,dataEnd=dataStart+len;
      if(dataEnd>bytes.length)break;
      const data=bytes.slice(dataStart,dataEnd);
      if(kind==="EXIF"){result.exif=true;result.gps=result.gps||hasGpsInTiff(data);result.orientation=result.orientation||readExifOrientation(data)}
      if(kind==="XMP ")result.xmp=true;
      if(kind==="C2PA"||kind==="JUMB"||containsAscii(data,"c2pa")||containsAscii(data,"contentauth"))result.provenance=true;
      p=dataEnd+(len%2);
    }
  }else{
    result.notes.push("This format is not deeply parsed; only a basic text scan was possible.");
  }
  if(!result.provenance)result.provenance=containsAscii(bytes,"c2pa")||containsAscii(bytes,"contentauth")||containsAscii(bytes,"Content Credentials");
  if(!result.xmp)result.xmp=containsAscii(bytes,"http://ns.adobe.com/xap/1.0/")||containsAscii(bytes,"xmpmeta");
  return result;
}
function boolBadge(v){return `<strong class="${v?"meta-yes":"meta-no"}">${v?"Detected":"Not detected"}</strong>`}
function renderMetadataCard(file,result){
  const card=document.createElement("article");card.className="meta-file";
  card.innerHTML=`<h2>${escapeHtml(file.name)}</h2><div class="meta-sub">${escapeHtml(result.format)} · ${formatBytes(file.size)}</div>
  <div class="meta-grid">
    <div class="meta-row"><span>EXIF metadata</span>${boolBadge(result.exif)}</div>
    <div class="meta-row"><span>GPS directory</span>${boolBadge(result.gps)}</div>
    <div class="meta-row"><span>Orientation tag</span><strong>${result.orientation?escapeHtml(orientationLabel(result.orientation)):"Not detected"}</strong></div>
    <div class="meta-row"><span>XMP metadata</span>${boolBadge(result.xmp)}</div>
    <div class="meta-row"><span>Possible provenance signal</span>${boolBadge(result.provenance)}</div>
  </div>${result.notes.length?`<div class="meta-note">${escapeHtml(result.notes.join(" "))}</div>`:""}`;
  return card;
}
function initMetadataChecker(){
  initDropzone({multiple:true,onFiles:async files=>{
    const out=$("#results");out.innerHTML="";
    for(const file of files){
      try{
        const bytes=new Uint8Array(await file.arrayBuffer());
        out.appendChild(renderMetadataCard(file,inspectMetadataBytes(bytes,file.type)));
      }catch(e){
        const card=document.createElement("article");card.className="meta-file";
        card.innerHTML=`<h2>${escapeHtml(file.name)}</h2><div class="meta-note">Could not inspect this file.</div>`;out.appendChild(card);
      }
    }
  }});
}
function stripExifJpeg(bytes,keepOrientation=false){
  if(bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error("Not JPEG");
  const parts=[bytes.slice(0,2)];let p=2,removed=false,orientation=null,orientationPreserved=false;
  while(p<bytes.length){
    if(bytes[p]!==0xff){parts.push(bytes.slice(p));break}
    const marker=bytes[p+1];
    if(marker===0xda){parts.push(bytes.slice(p));break}
    if(marker===0xd9){parts.push(bytes.slice(p,p+2));break}
    if(marker===0x00||marker===0xd8){parts.push(bytes.slice(p,p+2));p+=2;continue}
    if(p+4>bytes.length){parts.push(bytes.slice(p));break}
    const len=readU16BE(bytes,p+2),end=p+2+len;
    if(len<2||end>bytes.length){parts.push(bytes.slice(p));break}
    const isExif=marker===0xe1&&asciiSlice(bytes,p+4,Math.min(end,p+10))==="Exif\0\0";
    if(isExif){
      removed=true;
      const current=readExifOrientation(bytes.slice(p+10,end));
      if(!orientation&&current)orientation=current;
      if(keepOrientation&&!orientationPreserved&&current>=2&&current<=8){
        parts.push(makeJpegOrientationSegment(current));orientationPreserved=true;
      }
    }else parts.push(bytes.slice(p,end));
    p=end;
  }
  return {bytes:concatBytes(parts),removed,orientation,orientationPreserved};
}
function stripExifPng(bytes,keepOrientation=false){
  if(!(bytes.length>=8&&asciiSlice(bytes,1,4)==="PNG"))throw new Error("Not PNG");
  const parts=[bytes.slice(0,8)];let p=8,removed=false,orientation=null,orientationPreserved=false;
  while(p+12<=bytes.length){
    const len=readU32BE(bytes,p),kind=asciiSlice(bytes,p+4,p+8),dataStart=p+8,dataEnd=dataStart+len,end=p+12+len;
    if(end>bytes.length){parts.push(bytes.slice(p));break}
    if(kind==="eXIf"){
      removed=true;const current=readExifOrientation(bytes.slice(dataStart,dataEnd));
      if(!orientation&&current)orientation=current;
      if(keepOrientation&&!orientationPreserved&&current>=2&&current<=8){
        parts.push(makePngChunk("eXIf",minimalOrientationTiff(current)));orientationPreserved=true;
      }
    }else parts.push(bytes.slice(p,end));
    p=end;if(kind==="IEND")break;
  }
  if(p<bytes.length)parts.push(bytes.slice(p));
  return {bytes:concatBytes(parts),removed,orientation,orientationPreserved};
}
function stripExifWebp(bytes,keepOrientation=false){
  if(!(bytes.length>=12&&asciiSlice(bytes,0,4)==="RIFF"&&asciiSlice(bytes,8,12)==="WEBP"))throw new Error("Not WebP");
  let scan=12,orientation=null,hasVp8x=false;
  while(scan+8<=bytes.length){
    const kind=asciiSlice(bytes,scan,scan+4),len=readU32LE(bytes,scan+4),dataStart=scan+8,dataEnd=dataStart+len,end=dataEnd+(len%2);
    if(end>bytes.length)break;
    if(kind==="VP8X")hasVp8x=true;
    if(kind==="EXIF"&&!orientation)orientation=readExifOrientation(bytes.slice(dataStart,dataEnd));
    scan=end;
  }
  const preserve=!!(keepOrientation&&hasVp8x&&orientation>=2&&orientation<=8);
  const chunks=[];let p=12,removed=false,orientationPreserved=false;
  while(p+8<=bytes.length){
    const kind=asciiSlice(bytes,p,p+4),len=readU32LE(bytes,p+4),dataStart=p+8,dataEnd=dataStart+len,end=dataEnd+(len%2);
    if(end>bytes.length)break;
    if(kind==="EXIF"){
      removed=true;
      if(preserve&&!orientationPreserved){chunks.push(makeWebpChunk("EXIF",minimalOrientationTiff(orientation)));orientationPreserved=true}
    }else{
      let chunk=bytes.slice(p,end);
      if(kind==="VP8X"&&chunk.length>=9){
        chunk=chunk.slice();
        chunk[8]=preserve?(chunk[8]|0x08):(chunk[8]&~0x08);
      }
      chunks.push(chunk);
    }
    p=end;
  }
  const enc=new TextEncoder(),payload=concatBytes([enc.encode("WEBP"),...chunks]),out=new Uint8Array(8+payload.length);
  out.set(enc.encode("RIFF"),0);
  const size=payload.length;out[4]=size&255;out[5]=(size>>>8)&255;out[6]=(size>>>16)&255;out[7]=(size>>>24)&255;out.set(payload,8);
  return {bytes:out,removed,orientation,orientationPreserved};
}
function stripExifFile(bytes,keepOrientation=false){
  if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xd8)return {...stripExifJpeg(bytes,keepOrientation),type:"image/jpeg",ext:"jpg"};
  if(bytes.length>=8&&asciiSlice(bytes,1,4)==="PNG")return {...stripExifPng(bytes,keepOrientation),type:"image/png",ext:"png"};
  if(bytes.length>=12&&asciiSlice(bytes,0,4)==="RIFF"&&asciiSlice(bytes,8,12)==="WEBP")return {...stripExifWebp(bytes,keepOrientation),type:"image/webp",ext:"webp"};
  throw new Error("Supported formats: JPEG, PNG and WebP");
}
function initExifCleaner(){
  let files=[],processed=[];
  const verify=$("#verifyMetadataBtn"),zip=$("#downloadZipBtn");
  const clearBatch=()=>{processed=[];resetResults();verify?.classList.add("hidden");zip?.classList.add("hidden")};
  initDropzone({multiple:true,onFiles:fs=>{
    files=fs;clearBatch();const sum=$("#fileSummary");sum.classList.add("show");
    sum.textContent=`${files.length} image${files.length===1?"":"s"} ready`;$("#processBtn").disabled=!files.length;
  }});
  zip?.addEventListener("click",async()=>{
    if(processed.length<2)return;zip.disabled=true;zip.textContent="Building ZIP…";
    try{downloadBlob(await zipStored(processed),`cleaned-images-${processed.length}.zip`)}
    finally{zip.disabled=false;zip.textContent="Download all as ZIP"}
  });
  $("#processBtn")?.addEventListener("click",async()=>{
    clearBatch();$("#processBtn").disabled=true;let success=0;
    const keepOrientation=$("#keepOrientation")?.checked!==false;
    for(const file of files){
      try{
        const bytes=new Uint8Array(await file.arrayBuffer()),out=stripExifFile(bytes,keepOrientation);
        const blob=new Blob([out.bytes],{type:out.type}),label=`${baseName(file.name)}-no-exif.${out.ext}`;
        processed.push({name:label,blob});renderResult(file,blob,label);success++;
        const last=$("#results")?.lastElementChild,meta=last?.querySelector(".result-meta");
        if(meta){
          if(!out.removed)meta.textContent=`${formatBytes(file.size)} · no EXIF block was found; file structure preserved`;
          else if(out.orientationPreserved)meta.textContent=`${formatBytes(file.size)} → ${formatBytes(blob.size)} · private EXIF removed · orientation kept`;
          else if(keepOrientation&&out.orientation>=2&&out.orientation<=8)meta.textContent=`${formatBytes(file.size)} → ${formatBytes(blob.size)} · EXIF removed · orientation tag could not be retained`;
          else meta.textContent=`${formatBytes(file.size)} → ${formatBytes(blob.size)} · EXIF & GPS removed`;
        }
      }catch(e){
        const box=$("#results"),card=document.createElement("div");card.className="result-card";
        card.innerHTML=`<div class="thumb" style="display:grid;place-items:center">!</div><div><div class="result-name">${escapeHtml(file.name)}</div><div class="result-meta">${escapeHtml(e.message||"Could not clean this file")}</div></div>`;box.appendChild(card);
      }
    }
    if(success)verify?.classList.remove("hidden");
    if(processed.length>1)zip?.classList.remove("hidden");
    $("#processBtn").disabled=false;
  });
}


function addSiteTrustLinks() {
  const footer = document.querySelector(".footer");
  if (!footer || footer.querySelector("nav, .footer-trust-links")) return;
  const nav = document.createElement("nav");
  nav.className = "footer-trust-links";
  nav.setAttribute("aria-label", "Site information");
  nav.innerHTML = '<a href="https://everytinytool.com/">Every Tiny Tool</a><a href="https://everytinytool.com/about/">About</a><a href="https://everytinytool.com/privacy/">Privacy</a><a href="https://everytinytool.com/contact/">Contact</a>';
  footer.appendChild(nav);
}
addSiteTrustLinks();

/* Language selection is provided by the static shared site header; do not inject a second switch. */

/* Canonical capsule names and emoji across all pages. */
(function(){function fix(){const ko=document.documentElement.lang==='ko';const labels={"compress-image":["🗜️ Compress","🗜️ 이미지 압축"],"remove-background":["✂️ Remove Background","✂️ 배경 제거"],"pdf-compressor":["📄 PDF Compressor","📄 PDF 압축"],"video-compressor":["🎬 Video Compressor","🎬 동영상 압축"],"jpg-compressor":["🟠 JPG Compressor","🟠 JPG 압축"],"png-compressor":["🔵 PNG Compressor","🔵 PNG 압축"],"resize-image":["↔️ Resize","↔️ 크기 조절"],"crop-image":["✂️ Crop","✂️ 자르기"],"convert-image":["🔁 Convert","🔁 이미지 변환"],"png-to-jpg":["🟡 PNG to JPG","🟡 PNG → JPG"],"jpg-to-png":["🔷 JPG to PNG","🔷 JPG → PNG"],"image-to-webp":["🟣 To WebP","🟣 WebP 변환"],"webp-to-jpg":["🟡 WebP to JPG","🟡 WebP → JPG"],"heic-to-jpg":["📱 HEIC to JPG","📱 HEIC → JPG"],"rotate-image":["↻ Rotate","↻ 회전"],"metadata-inspector":["🔎 Metadata Inspector · AI Metadata Checker","🔎 메타데이터 검사 · AI 정보 검사기"],"metadata-cleaner":["🧹 Metadata Cleaner ・ Remove AI Label","🧹 메타데이터 제거 · AI 정보 지우기"]};document.querySelectorAll('nav.tool-tabs a,nav.bottom-tabs a').forEach(a=>{const bits=(a.getAttribute('href')||'').split('/').filter(Boolean);const slug=bits[bits.length-1];if(labels[slug])a.textContent=labels[slug][ko?1:0];});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();})();

/* Shared processing feedback for every tool using the primary Process button. */
(function(){
 function mount(){
  const button=document.querySelector('#processBtn');
  if(!button||button.dataset.loadingFeedback)return;
  button.dataset.loadingFeedback='1';
  const ko=location.pathname.startsWith('/ko/');
  const indicator=document.createElement('div');
  indicator.className='tool-processing-feedback';
  indicator.setAttribute('role','status');
  indicator.setAttribute('aria-live','polite');
  indicator.hidden=true;
  indicator.innerHTML='<span class="tool-processing-spinner" aria-hidden="true"></span><div class="tool-processing-copy"><strong>'+(ko?'파일 처리 중…':'Processing files…')+'</strong><span>'+(ko?'잠시만 기다려 주세요.':'Please wait while files are processed.')+'</span></div><span class="tool-processing-count" aria-label="Processed files">1 / 1</span>';
  const actions=button.closest('.actions')||button.parentElement;
  actions.insertAdjacentElement('afterend',indicator);
  let armed=false;
  button.addEventListener('click',()=>{
   if(button.disabled)return;
   armed=true;
   requestAnimationFrame(()=>{if(armed&&button.disabled)indicator.hidden=false;});
  },true);
  new MutationObserver(()=>{
   if(!armed)return;
   if(button.disabled){indicator.hidden=false}
   else{indicator.hidden=true;armed=false}
  }).observe(button,{attributes:true,attributeFilter:['disabled']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
