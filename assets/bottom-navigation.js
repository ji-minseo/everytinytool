(function(){'use strict';function init(){if(document.querySelector('.more-tools'))return;const main=document.querySelector('main'),nav=document.querySelector('nav.tool-tabs');if(!main||!nav)return;const wrap=document.createElement('section');wrap.className='more-tools';wrap.setAttribute('aria-label','More image tools');const heading=document.createElement('div');heading.className='more-tools-label';heading.textContent='More image tools';const copy=nav.cloneNode(true);copy.classList.add('bottom-tabs');copy.removeAttribute('aria-label');wrap.append(heading,copy);const ad=main.querySelector('.ad-slot');if(ad){ad.insertAdjacentElement('afterend',wrap);return}const anchor=main.querySelector('.info-grid, .seo-content, .network');if(anchor)anchor.insertAdjacentElement('beforebegin',wrap);else main.append(wrap)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();
/* Header language switch is rendered exactly once by the shared site-header HTML.
   The legacy dynamic language-toggle injector was retired to avoid duplicates. */

/* Canonical capsule names and emoji across all pages. */
(function(){function fix(){const ko=document.documentElement.lang==='ko';const labels={"compress-image":["🗜️ Compress","🗜️ 이미지 압축"],"remove-background":["✂️ Remove Background","✂️ 배경 제거"],"pdf-compressor":["📄 PDF Compressor","📄 PDF 압축"],"video-compressor":["🎬 Video Compressor","🎬 동영상 압축"],"jpg-compressor":["🟠 JPG Compressor","🟠 JPG 압축"],"png-compressor":["🔵 PNG Compressor","🔵 PNG 압축"],"resize-image":["↔️ Resize","↔️ 크기 조절"],"crop-image":["✂️ Crop","✂️ 자르기"],"convert-image":["🔁 Convert","🔁 이미지 변환"],"png-to-jpg":["🟡 PNG to JPG","🟡 PNG → JPG"],"jpg-to-png":["🔷 JPG to PNG","🔷 JPG → PNG"],"image-to-webp":["🟣 To WebP","🟣 WebP 변환"],"webp-to-jpg":["🟡 WebP to JPG","🟡 WebP → JPG"],"heic-to-jpg":["📱 HEIC to JPG","📱 HEIC → JPG"],"rotate-image":["↻ Rotate","↻ 회전"],"metadata-inspector":["🔎 Metadata Inspector · AI Metadata Checker","🔎 메타데이터 검사 · AI 정보 검사기"],"metadata-cleaner":["🧹 Metadata Cleaner ・ Remove AI Label","🧹 메타데이터 제거 · AI 정보 지우기"]};document.querySelectorAll('nav.tool-tabs a,nav.bottom-tabs a').forEach(a=>{const bits=(a.getAttribute('href')||'').split('/').filter(Boolean);const slug=bits[bits.length-1];if(labels[slug])a.textContent=labels[slug][ko?1:0];});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();})();

/* Processing feedback shared by dedicated and legacy tools. */
(function(){
 function init(){
  const btn=document.querySelector('#processBtn, #pdf-compress, #run, #bg-run');
  if(!btn||btn.dataset.loadingFeedback||document.querySelector('#video-processing'))return;
  btn.dataset.loadingFeedback='1';
  const ko=location.pathname.startsWith('/ko/');
  const line=document.createElement('div');
  line.className='tool-processing-feedback';line.hidden=true;
  line.setAttribute('role','status');line.setAttribute('aria-live','polite');
  line.innerHTML='<span class="tool-processing-spinner" aria-hidden="true"></span><div class="tool-processing-copy"><strong>'+(ko?'파일 처리 중…':'Processing files…')+'</strong><span>'+(ko?'잠시만 기다려 주세요.':'Please wait while files are processed.')+'</span></div><span class="tool-processing-count" aria-label="Processed files">1 / 1</span>';
  (btn.closest('.actions')||btn.parentElement).insertAdjacentElement('afterend',line);
  let pending=false;
  btn.addEventListener('click',()=>{
   if(btn.disabled)return;
   pending=true;
   const total=document.querySelectorAll('#fileSummary .selected-file, #fileSummary .media-item, .selected-files-grid .selected-file').length ||
    document.querySelectorAll('#meta-list .media-item, .pdfc-queue .pdfc-queue-row, .vs-selected, #fileSummary .selected-file').length || 1;
   window.ETTProcessingCount?.(1,total);
   requestAnimationFrame(()=>{if(pending&&btn.disabled)line.hidden=false});
  },true);
  new MutationObserver(()=>{
   if(!pending)return;
   if(btn.disabled)line.hidden=false;
   else{line.hidden=true;pending=false}
  }).observe(btn,{attributes:true,attributeFilter:['disabled']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Keep all processing indicators aligned with the Video Compressor count. */
window.ETTProcessingCount=function(current,total){document.querySelectorAll('.tool-processing-count').forEach(el=>{el.textContent=Math.max(0,current)+' / '+Math.max(1,total)})};
