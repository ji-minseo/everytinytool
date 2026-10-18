'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=require('../assets/quick-image-studio.js');
const page=fs.readFileSync(path.join(root,'quick-image-studio/index.html'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('accepts JPG PNG WebP and guards empty or oversized inputs',()=>{
 for(const type of ['image/jpeg','image/png','image/webp'])assert.equal(core.validateFile({name:'image',type,size:300}), '');
 assert.match(core.validateFile({type:'image/svg+xml',size:300}),/JPG, PNG or WebP/);
 assert.match(core.validateFile({type:'image/jpeg',size:0}),/empty/);
 assert.match(core.validateFile({type:'image/jpeg',size:30*1024*1024}),/under 25 MB/);
});
test('preserves aspect ratios for width height and percentage',()=>{
 assert.deepEqual(core.scaleDimensions(4000,3000,'width',1000),{width:1000,height:750});
 assert.deepEqual(core.scaleDimensions(4032,3024,'height',1080),{width:1440,height:1080});
 assert.deepEqual(core.scaleDimensions(4000,3000,'percent',50),{width:2000,height:1500});
});
test('avoids unintentional upscaling but allows opt-in',()=>{
 assert.deepEqual(core.scaleDimensions(400,300,'width',1080),{width:400,height:300});
 assert.deepEqual(core.scaleDimensions(400,300,'width',1080,true),{width:1080,height:810});
});
test('rejects invalid image dimensions and huge outputs',()=>{
 assert.throws(()=>core.scaleDimensions(6000,5000,'width',1000),/24 megapixel/);
 assert.throws(()=>core.scaleDimensions(400,300,'width',13000),/1–12,000/);
 assert.throws(()=>core.scaleDimensions(400,300,'percent',600),/1 and 400/);
});
test('does not flatten PNG alpha, composites JPG only if needed',()=>{
 assert.equal(core.makeBackgroundColor('image/png','white'),null);
 assert.equal(core.makeBackgroundColor('image/jpeg','white'),'#ffffff');
 assert.equal(core.makeBackgroundColor('image/webp','black'),'#000000');
 assert.equal(core.makeBackgroundColor('image/jpeg','custom','#c4d8ff'),'#c4d8ff');
});
test('uses measured encoded size for best-effort KB targets',()=>{
 const candidates=[{blob:{size:3200}},{blob:{size:920}},{blob:{size:400}}];
 assert.equal(core.getBestCandidate(candidates,1024).blob.size,920);
 assert.equal(core.getBestCandidate(candidates,100).blob.size,400);
 assert.equal(core.getBestCandidate(candidates,0).blob.size,3200);
});
test('creates safe filenames for optimized images',()=>{
 assert.equal(core.fileName('my.photo.png','image/webp'),'my.photo-optimized.webp');
 assert.equal(core.fileName('test.jpg','image/jpeg'),'test-optimized.jpg');
});
test('image pipeline draws the decoded bitmap at correct scaled dimensions',async()=>{
 const calls=[],bmp={width:1600,height:1200},context={
   fillRect(...args){calls.push(['fill',...args]);},
   drawImage(...args){calls.push(['draw',...args]);},
   set imageSmoothingQuality(q){calls.push(['smoothing',q]);},
   set fillStyle(c){calls.push(['background',c]);}
 };
 const canvas={
   getContext(kind){assert.equal(kind,'2d');return context;},
   toBlob(cb,type,quality){calls.push(['encoded',type,quality]);cb({type,size:700});}
 };
 const output=await core.convertImage({image:bmp,width:1600,height:1200},{
   mode:'width',value:800,format:'image/jpeg',quality:82,background:'white',
   createCanvas(){return canvas;}
 });
 assert.equal(output.width,800);assert.equal(output.height,600);
 assert.ok(calls.some(c=>c[0]==='draw'&&c[1]===bmp&&c[4]===600));
 assert.ok(calls.some(c=>c[0]==='background'&&c[1]==='#ffffff'));
 assert.ok(calls.some(c=>c[0]==='encoded'&&c[1]==='image/jpeg'));
});
test('target filesize searches more than one JPEG quality',async()=>{
 let count=0;
 const ctx={drawImage(){},fillRect(){}};
 const canvas={getContext(){return ctx;},toBlob(cb,type,quality){
   count++;cb({type,size:Math.round(quality*3000)});
 }};
 const output=await core.convertImage({width:1000,height:800},{
   mode:'original',format:'image/webp',quality:90,targetKB:1,
   createCanvas(){return canvas;}
 });
 assert.ok(count>1);assert.ok(output.blob.size<1024);
});
test('markup includes functional main-domain image workspace and one-click preview',()=>{
 const ids=[...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 const homeIds=[...home.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 assert.equal(homeIds.length,new Set(homeIds).size);
 for(const id of ['is-dropzone','is-file','is-run','is-download','is-before','is-after','is-size-mode','is-format'])assert.ok(ids.includes(id),id);
 for(const id of ['home-image-file','home-image-run','home-image-preview','home-image-download'])assert.ok(homeIds.includes(id),id);
 assert.match(home,/href="\.\/quick-image-studio\/"/);
 assert.match(home,/src="\.\/assets\/quick-image-studio.js/);
 assert.match(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),/https:\/\/everytinytool.com\/quick-image-studio\//);
});
test('responsive CSS and image privacy statements exist',()=>{
 const css=fs.readFileSync(path.join(root,'assets/quick-image-studio.css'),'utf8');
 assert.match(css,/@media\(max-width:460px\)/);
 assert.match(page,/No photo upload/);
 assert.match(page,/image\.everytinytool\.com\/pdf-compressor/);
 assert.match(page,/image\.everytinytool\.com\/remove-background/);
});
