'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const api=require('../assets/video-studio.js');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const page=fs.readFileSync(path.join(root,'video-studio/index.html'),'utf8');
function attributeValues(source,name){
 return [...source.matchAll(new RegExp('(?:\\s|^)'+name+'="([^"]+)"','g'))].map(match=>match[1]);
}
test('all home categories and image actions have matching accessible panels',()=>{
 const categories=['image','pdf','video','metadata','workspace','more'];
 const imageActions=['resize','compress','remove','crop','convert','rotate','jpgpng','webp','heic'];
 assert.deepEqual(attributeValues(html,'data-hub-tab'),categories);
 assert.deepEqual(attributeValues(html,'data-panel'),categories);
 assert.deepEqual(attributeValues(html,'data-image-tab'),imageActions);
 assert.deepEqual(attributeValues(html,'data-image-panel'),imageActions);
 assert.deepEqual(attributeValues(html,'data-metadata-tab'),['inspect','clean']);
 assert.deepEqual(attributeValues(html,'data-metadata-panel'),['inspect','clean']);
 for(const category of categories){
  const tab=html.match(new RegExp('<button\\b[^>]*data-hub-tab="'+category+'"[^>]*>'))[0];
  assert.match(tab,/role="tab"/);
  assert.match(tab,new RegExp('aria-controls="hub-panel-'+category+'"'));
  assert.match(html,new RegExp('id="hub-panel-'+category+'"[^>]*role="tabpanel"[^>]*aria-labelledby="hub-tab-'+category+'"'));
 }
});
test('home uses styled labeled file inputs and keeps full tool embeds',()=>{
 const inlineActions=['crop','convert','rotate','jpgpng','webp','heic'];
 assert.deepEqual(attributeValues(html,'data-inline-image'),inlineActions);
 const inputs=[...html.matchAll(/<input\b[^>]*type="file"[^>]*>/g)].map(match=>match[0]);
 assert.equal(inputs.length,inlineActions.length);
 for(const input of inputs){
  assert.match(input,/\bmultiple(?:\s|>)/);
  assert.match(input,/accept="[^"]+"/);
  assert.match(input,/aria-label="[^"]+"/);
 }
 const styles=fs.readFileSync(path.join(root,'assets/hub-capsules.css'),'utf8');
 assert.match(styles,/\.hub-inline-dropzone input\[type=file\]\s*\{\s*display:\s*none\s*\}/);
 assert.equal([...html.matchAll(/class="hub-inline-dropzone" role="button" tabindex="0" aria-label="[^"]+"/g)].length,inlineActions.length);
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
test('sitemap lists self-canonical tools and preserves intentional cross-domain consolidation',()=>{
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
 for(const url of ['/video-studio/','/quick-image-studio/','/workspace/','/metadata-inspector/','/metadata-cleaner/']){
  const canonical='https://everytinytool.com'+url;
  assert.ok(locations.includes(canonical),canonical+' should be discoverable in the sitemap');
  const source=fs.readFileSync(path.join(root,url.slice(1),'index.html'),'utf8');
  assert.match(source,new RegExp('rel="canonical" href="'+canonical.replaceAll('.','\\.')+'"'));
 }
 for(const tool of ['pdf-compressor','remove-background']){
  const source=fs.readFileSync(path.join(root,tool,'index.html'),'utf8');
  const canonical=source.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)[1];
  assert.equal(canonical,'https://image.everytinytool.com/'+tool+'/');
  assert.ok(!locations.includes('https://everytinytool.com/'+tool+'/'));
  const schema=JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema.url,canonical);
 }
});

test('image actions are separately labeled and file previews are present',()=>{
 for(const name of ['resize','compress','remove'])assert.match(html,new RegExp('data-image-tab="'+name+'"'));
 const resize=fs.readFileSync(path.join(root,'quick-image-studio/index.html'),'utf8');
 const bg=fs.readFileSync(path.join(root,'remove-background/index.html'),'utf8');
 const video=fs.readFileSync(path.join(root,'video-studio/index.html'),'utf8');
 assert.match(resize,/id="is-upload-preview"/);
 assert.match(bg,/<img[^>]*id="bg-file-thumbnail"[^>]*alt="Selected image thumbnail"/);
 const backgroundScript=fs.readFileSync(path.join(root,'assets/background-remover.js'),'utf8');
 assert.match(backgroundScript,/uploadThumb\s*=\s*\$\('bg-file-thumbnail'\)/);
 assert.match(video,/id="vs-preview"/);
 assert.match(html,/mode=compress/);
});
