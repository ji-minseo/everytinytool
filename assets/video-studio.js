/* Video Studio: real-time browser-native video re-encoding via MediaRecorder.
   No video bytes uploaded. Supports only the input decoders and output codecs
   available in the user's browser. Never label a renamed blob as a conversion. */
(function(root,factory){const api=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',api.init);else api.init();}})(typeof window!=='undefined'?window:{},function(root){
'use strict';
const MAX_BYTES=250*1024*1024,MAX_DURATION=300;
const OUTPUT_FORMATS=[
 {type:'video/webm;codecs=vp8,opus',ext:'webm',label:'WebM · VP8 + Opus'},
 {type:'video/webm;codecs=vp9,opus',ext:'webm',label:'WebM · VP9 + Opus'},
 {type:'video/mp4;codecs=avc1.42E01E,mp4a.40.2',ext:'mp4',label:'MP4 · H.264 + AAC'},
 {type:'video/mp4',ext:'mp4',label:'MP4 · browser supported'}
];
function outputFormats(MediaRecorderType){if(!MediaRecorderType||typeof MediaRecorderType.isTypeSupported!=='function')return [];
 const found=OUTPUT_FORMATS.filter(x=>MediaRecorderType.isTypeSupported(x.type));
 return found.filter((x,i)=>found.findIndex(y=>y.ext===x.ext)===i);
}
function dimensions(width,height,maxWidth){if(!(width>0&&height>0))throw Error('Unsupported video dimensions.');const factor=Math.min(1,maxWidth/width);
 const w=Math.max(2,Math.round(width*factor/2)*2),h=Math.max(2,Math.round(height*factor/2)*2);
 if(w*h>4000000)throw Error('Output video resolution is too high for this browser.');return {width:w,height:h};}
function bytesText(size){return size>=1048576?(size/1048576).toFixed(2)+' MB':size>=1024?(size/1024).toFixed(1)+' KB':size+' B';}
function outputName(name,ext){return (String(name||'video').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'-').slice(0,90)||'video')+'-optimized.'+ext;}
function limits(file){if(!file)return 'Choose a video.';if(file.size<=0)return 'This video is empty.';if(file.size>MAX_BYTES)return 'Choose a video under 250 MB.';if(file.type&&!file.type.startsWith('video/')&&!/\.(mp4|mov|m4v|webm|ogv)$/i.test(file.name||''))return 'Choose a video file.';return '';}
function getOutputType(recs,selected){return recs.find(x=>x.type===selected)||null;}
function init(){
 const $=id=>document.getElementById(id);if(!$('video-studio'))return;
 const input=$('vs-file'),choose=$('vs-choose'),run=$('vs-run'),cancel=$('vs-cancel'),status=$('vs-status'),preview=$('vs-preview');
 const options=$('vs-options'),result=$('vs-result'),progress=$('vs-progress');
 const format=$('vs-format'),size=$('vs-size'),rate=$('vs-bitrate'),download=$('vs-download');
 const supported=outputFormats(root.MediaRecorder),canEncode=supported.length>0&&typeof root.HTMLCanvasElement?.prototype?.captureStream==='function',names={webm:'WebM',mp4:'MP4'};
 let file=null,source=null,output=null,busy=false,abort=false,recorder=null,video=null,stream=null,audioContext=null,decodedDuration=0,frames=0;
 function report(msg,error=false){status.textContent=msg;status.dataset.error=String(error);}
 function cleanup(){stream?.getTracks().forEach(t=>t.stop());stream=null;if(video){video.pause();video.removeAttribute('src');video.load();video=null;}if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}recorder=null;}
 function setBusy(v){busy=v;input.disabled=v||!canEncode;choose.disabled=v||!canEncode;run.disabled=v||!file||!canEncode;cancel.hidden=!v;format.disabled=v||!canEncode;size.disabled=v||!canEncode;rate.disabled=v||!canEncode;}
 function resetOutput(){result.hidden=true;download.removeAttribute('href');if(output)URL.revokeObjectURL(output);output=null;}
 function resetInput(next){
  if(busy)return;
  resetOutput();if(source)URL.revokeObjectURL(source);source=null;file=null;
  if(!next){options.hidden=true;preview.hidden=true;preview.removeAttribute('src');$('vs-dropzone').classList.remove('has-video');input.value='';report('Choose a video to start.');setBusy(false);return;}
  const err=limits(next);if(err){report(err,true);return;}
  file=next;source=URL.createObjectURL(file);preview.src=source;preview.hidden=false;$('vs-dropzone').classList.add('has-video');options.hidden=false;
  $('vs-file-name').textContent=file.name||'Video';
  $('vs-original-size').textContent=bytesText(file.size);
  report('Video selected. Preview it, then choose your output. Processing takes approximately the video duration.');
  setBusy(false);
 }
 if(!canEncode){report('This browser does not support local video re-encoding. Try current Chrome, Edge, Firefox or Safari.',true);}
 for(const item of supported){const option=document.createElement('option');option.value=item.type;option.textContent=item.label;format.appendChild(option);}
 if(supported.length)format.value=supported[0].type;
 function openPicker(){if(!busy)input.click();}
 choose.addEventListener('click',openPicker);
 $('vs-dropzone').addEventListener('click',e=>{if(e.target===input||e.target.closest?.('button,input,label,a,video'))return;openPicker();});
 $('vs-dropzone').addEventListener('keydown',e=>{if(e.target!==$('vs-dropzone')||!['Enter',' '].includes(e.key))return;e.preventDefault();openPicker();});
 input.addEventListener('change',()=>{if(input.files?.[0])resetInput(input.files[0]);});
 ['dragover','dragenter'].forEach(t=>$('vs-dropzone').addEventListener(t,e=>{e.preventDefault();if(!busy)$('vs-dropzone').classList.add('dragover');}));
 ['drop','dragleave'].forEach(t=>$('vs-dropzone').addEventListener(t,e=>{e.preventDefault();$('vs-dropzone').classList.remove('dragover');if(t==='drop'&&!busy&&e.dataTransfer?.files?.[0])resetInput(e.dataTransfer.files[0]);}));
 $('vs-clear').addEventListener('click',()=>resetInput(null));
 for(const id of ['vs-size','vs-bitrate','vs-format'])$(id).addEventListener('change',resetOutput);
 cancel.addEventListener('click',()=>{abort=true;report('Stopping video processing…');recorder?.state==='recording'&&recorder.stop();if(video)video.pause();});
 async function encode(){
  if(!file||busy)return;
  const choice=getOutputType(supported,format.value);if(!choice){report('Choose a supported output format.',true);return;}
  setBusy(true);abort=false;resetOutput();progress.hidden=false;progress.value=0;frames=0;
  let done,timeoutHandle=null;
  try{
   video=document.createElement('video');video.preload='auto';video.playsInline=true;video.muted=false;video.volume=0;
   video.src=source;
   await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('This browser cannot decode the selected video format.'));video.load();});
   decodedDuration=video.duration;
   if(!Number.isFinite(decodedDuration)||decodedDuration<=0||decodedDuration>MAX_DURATION)throw Error('Use a video up to 5 minutes long for browser processing.');
   const {width,height}=dimensions(video.videoWidth,video.videoHeight,Number(size.value));
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas video encoding is unavailable.');
   if(typeof canvas.captureStream!=='function')throw Error('This browser cannot capture video frames.');
   stream=canvas.captureStream(24);
   let hasAudio=false;
   try{
    const AudioContextType=root.AudioContext||root.webkitAudioContext;
    if(AudioContextType){
     audioContext=new AudioContextType();
     const sourceNode=audioContext.createMediaElementSource(video),dest=audioContext.createMediaStreamDestination();
     sourceNode.connect(dest);
     for(const track of dest.stream.getAudioTracks()){stream.addTrack(track);hasAudio=true;}
     await audioContext.resume();
    }
   }catch(_){if(audioContext){await audioContext.close().catch(()=>{});audioContext=null;}}
   const bits=Number(rate.value),bps=Math.round(bits*1000000);
   if(!(bps>=150000&&bps<=12000000))throw Error('Invalid bitrate.');
   recorder=new root.MediaRecorder(stream,{mimeType:choice.type,videoBitsPerSecond:bps,audioBitsPerSecond:hasAudio?96000:undefined});
   const blobs=[];
   done=new Promise((resolve,reject)=>{
    recorder.ondataavailable=e=>{if(e.data?.size)blobs.push(e.data);};
    recorder.onerror=()=>reject(Error('Video recorder failed.'));
    recorder.onstop=()=>blobs.length?resolve(new Blob(blobs,{type:choice.ext==='mp4'?'video/mp4':'video/webm'})):reject(Error('The browser did not create an output file.'));
   });
   let rafId=null,lastPaint=0;
   const draw=()=>{
    if(abort||!video||video.ended)return;
    try{if(video.readyState>=2){ctx.drawImage(video,0,0,width,height);frames++;}}catch(_){}
    const now=video.currentTime;
    if(now-lastPaint>.3){lastPaint=now;progress.value=Math.round(Math.min(100,now/decodedDuration*100));$('vs-percent').textContent=progress.value+'%';}
    rafId=root.requestAnimationFrame(draw);
   };
   video.onended=()=>{if(rafId)root.cancelAnimationFrame(rafId);if(recorder?.state==='recording')recorder.stop();};
   recorder.start(1000);
   await video.play();
   draw();
   report('Re-encoding video locally. This runs at playback speed; please keep the tab open.');
   timeoutHandle=root.setTimeout(()=>{abort=true;if(recorder?.state==='recording')recorder.stop();video?.pause();},(decodedDuration+45)*1000);
   const blob=await done;
   if(rafId)root.cancelAnimationFrame(rafId);
   if(abort)throw Error('Video conversion was stopped.');
   if(frames===0)throw Error('No frames were decoded from this video.');
   output=URL.createObjectURL(blob);download.href=output;download.download=outputName(file.name,choice.ext);
   $('vs-final-size').textContent=bytesText(blob.size);
   $('vs-output-format').textContent=names[choice.ext];
   $('vs-size-note').textContent=blob.size<file.size?'Saved '+Math.round((1-blob.size/file.size)*100)+'% of original size':'Output is larger than the original. Try a lower bitrate or smaller resolution.';
   result.hidden=false;progress.value=100;$('vs-percent').textContent='100%';
   report('Video ready! Download the processed file.');
  }catch(e){report(e?.message||'Video conversion failed. Try a different browser or input format.',true);}
  finally{if(timeoutHandle)root.clearTimeout(timeoutHandle);cleanup();progress.hidden=true;setBusy(false);}
 }
 run.addEventListener('click',encode);
 root.addEventListener?.('pagehide',()=>{abort=true;if(recorder?.state==='recording')recorder.stop();cleanup();if(source)URL.revokeObjectURL(source);if(output)URL.revokeObjectURL(output);});
 options.hidden=true;result.hidden=true;cancel.hidden=true;
 setBusy(false);
}
return {MAX_BYTES,MAX_DURATION,OUTPUT_FORMATS,outputFormats,dimensions,bytesText,outputName,limits,getOutputType,init};
});