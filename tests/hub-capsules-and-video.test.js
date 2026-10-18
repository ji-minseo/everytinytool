'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const api=require('../assets/video-studio.js');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const page=fs.readFileSync(path.join(root,'video-studio/index.html'),'utf8');
test('capsules cover image PDF video workspace and more',()=>{
 for(const type of ['image','pdf','video','workspace','more']){
  assert.match(html,new RegExp('data-hub-tab="'+type+'"'));
  assert.match(html,new RegExp('data-panel="'+type+'"'));
 }
 assert.equal([...html.matchAll(/data-hub-tab="/g)].length,5);
 assert.equal([...html.matchAll(/data-image-tab="/g)].length,3);
});
test('home exposes no unstyled native file selection',()=>{
 assert.doesNotMatch(html,/<input[^>]*type="file"/);
 for(const url of ['/quick-image-studio/','/remove-background/','/pdf-compressor/','/video-studio/','/workspace/']){
  assert.match(html,new RegExp('data-src="'+url.replaceAll('/','\\/')+'\\?embed=1"'));
 }
});
test('capsules link to appropriate category pages',()=>{
 for(const target of ['/quick-image-studio/','/remove-background/','/pdf-compressor/','/video-studio/','/workspace/']){
  const p=fs.readFileSync(path.join(root,target.slice(1),'index.html'),'utf8');
  assert.match(p,/dataset\.embedded='true'/);
  assert.match(p,/tool-embed\.css/);
 }
});
test('collection banners feature all three specialized subdomains',()=>{
 for(const domain of ['image.everytinytool.com','calculate.everytinytool.com','random.everytinytool.com'])assert.ok(html.includes('https://'+domain+'/'));
});
test('only actually supported encoders offered',()=>{
 const codecs=api.outputFormats({isTypeSupported:t=>t.includes('webm')});
 assert.equal(codecs.length,1);
 assert.equal(codecs[0].ext,'webm');
 assert.deepEqual(api.outputFormats({isTypeSupported:()=>false}),[]);
 assert.deepEqual(api.outputFormats(undefined),[]);
});
test('selected encoder must be in supported list',()=>{
 const fmts=api.outputFormats({isTypeSupported:t=>t.includes('webm')});
 assert.equal(api.getOutputType(fmts,'video/mp4'),null);
 assert.equal(api.getOutputType(fmts,fmts[0].type),fmts[0]);
});
test('video resize is proportional and never silently upscales',()=>{
 assert.deepEqual(api.dimensions(1920,1080,960),{width:960,height:540});
 assert.deepEqual(api.dimensions(640,480,1920),{width:640,height:480});
 assert.throws(()=>api.dimensions(0,100,640),/Unsupported/);
});
test('input limits and real output extensions',()=>{
 assert.equal(api.limits({type:'video/mp4',name:'clip.mp4',size:1000}),'');
 assert.match(api.limits({type:'image/png',name:'photo.png',size:1000}),/video file/);
 assert.match(api.limits({type:'video/mp4',name:'huge.mp4',size:251*1024*1024}),/under 250 MB/);
 assert.equal(api.outputName('clip.mov','webm'),'clip-optimized.webm');
 assert.equal(api.outputName('clip.mp4','mp4'),'clip-optimized.mp4');
});
test('video page includes real output controls, progress and limits',()=>{
 for(const id of ['vs-file','vs-format','vs-size','vs-bitrate','vs-run','vs-cancel','vs-progress','vs-download','vs-status'])assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(page,/(5 min|five minutes)/);
 assert.match(page,/browser supports/);
 assert.match(page,/(may be silent|audio capture)/);
});
test('main domain sitemap lists all new working tools',()=>{
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 for(const url of ['/pdf-compressor/','/remove-background/','/video-studio/','/quick-image-studio/','/workspace/'])assert.ok(sitemap.includes('https://everytinytool.com'+url));
});

test('image actions are separately labeled and file previews are present',()=>{
 for(const name of ['resize','compress','remove'])assert.match(html,new RegExp('data-image-tab="'+name+'"'));
 const resize=fs.readFileSync(path.join(root,'quick-image-studio/index.html'),'utf8');
 const bg=fs.readFileSync(path.join(root,'remove-background/index.html'),'utf8');
 const video=fs.readFileSync(path.join(root,'video-studio/index.html'),'utf8');
 assert.match(resize,/id="is-upload-preview"/);
 assert.match(bg,/id="bg-upload-preview"/);
 assert.match(video,/id="vs-preview"/);
 assert.match(html,/mode=compress/);
});
