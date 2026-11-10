/* File selection UI resilience shared by image tools.
   Like Quick Image Studio: read the FileList on change immediately. */
(()=>{'use strict';function init(){const input=document.getElementById('fileInput'),summary=document.getElementById('fileSummary');if(!input||!summary||document.body.dataset.tool==='compress')return;
let fallbackUrls=[];function show(files){fallbackUrls.forEach(URL.revokeObjectURL);fallbackUrls=[];if(!files.length)return;
queueMicrotask(()=>{if(summary.querySelectorAll('.selected-file').length===files.length)return;
summary.classList.add('show');summary.replaceChildren();const grid=document.createElement('div');grid.className='selected-files-grid';
files.forEach(f=>{const item=document.createElement('div');item.className='selected-file';const visual=document.createElement('div');visual.className='selected-file-thumb';if(f.type.startsWith('image/')&&!/\\.hei[cf]$/i.test(f.name)){const image=document.createElement('img'),u=URL.createObjectURL(f);fallbackUrls.push(u);image.src=u;image.alt='';visual.append(image)}else visual.textContent='📷';const info=document.createElement('div');info.className='selected-file-info';const name=document.createElement('div');name.className='selected-file-name';name.textContent=f.name;const size=document.createElement('div');size.className='selected-file-size';size.textContent=f.size>1048576?(f.size/1048576).toFixed(2)+' MB':(f.size/1024).toFixed(1)+' KB';info.append(name,size);item.append(visual,info);grid.append(item)});summary.append(grid);
});}
input.addEventListener('change',()=>{const fs=Array.from(input.files||[]);if(fs.length)show(fs)},true);
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();