'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'..');
const api=require('../assets/tiny-workspace.js');
const home=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const page=fs.readFileSync(path.join(dir,'workspace/index.html'),'utf8');
test('processes multiple steps in sequence with stage previews',()=>{
 const input='  Apple\nBanana\napple\n\nOrange\nBanana\n  Cherry  ';
 const result=api.process(input,['trim','blank','unique','sort']);
 assert.equal(result.output,'Apple\nBanana\nCherry\nOrange');
 assert.equal(result.history.length,5);
 assert.equal(result.history[1].rows[0],'Apple');
 assert.equal(result.history[2].rows.length,6);
 assert.equal(result.history[3].rows.length,4);
});
test('step order has a real effect on filtering and replacement',()=>{
 const data='red\nblue',opts={find:'red',replacement:'green',query:'green'};
 assert.deepEqual(api.process(data,['replace','filter'],opts).rows,['green']);
 assert.deepEqual(api.process(data,['filter','replace'],opts).rows,[]);
});
test('filters by literal text and honors case-sensitive mode',()=>{
 assert.deepEqual(api.process('APPLE\napple\nPear',['filter'],{query:'app'}).rows,['APPLE','apple']);
 assert.deepEqual(api.process('APPLE\napple\nPear',['filter'],{query:'app',matchCase:true}).rows,['apple']);
});
test('supports find and replace without executing user regex',()=>{
 assert.equal(api.process('a.b\naXb',['replace'],{find:'.',replacement:'_'}).output,'a_b\naXb');
 assert.equal(api.process('APPLE\napple',['replace'],{find:'apple',replacement:'pear'}).output,'pear\npear');
 assert.equal(api.process('abc',['prefix','suffix'],{prefix:'SKU-',suffix:'-24'}).output,'SKU-abc-24');
});
test('compares clean output to reference lists with distinct categories',()=>{
 assert.deepEqual(api.compareLists(['Apple','Banana','apple'],['BANANA','Mango']),
 {onlyA:['Apple'],shared:['Banana'],onlyB:['Mango']});
 assert.deepEqual(api.compareLists(['APPLE','Apple'],['Apple'],true),
 {onlyA:['APPLE'],shared:['Apple'],onlyB:[]});
});
test('safely exports TXT, CSV with correct escaping, and JSON',()=>{
 assert.equal(api.exportText(['a','b'],'txt').content,'a\nb');
 assert.equal(api.exportText(['a,b','a"b'],'csv').content,'item\r\n"a,b"\r\n"a""b"\r\n');
 assert.equal(api.exportText(['a','b'],'json').content,'[\n  "a",\n  "b"\n]');
 assert.throws(()=>api.exportText([], 'xlsx'),/Unsupported/);
});
test('protects memory and rejects unknown operations',()=>{
 assert.throws(()=>api.parseLines('x'.repeat(api.MAX_INPUT+1)),/200,000/);
 assert.throws(()=>api.parseLines('x\n'.repeat(api.MAX_LINES+1)),/10,000/);
 assert.throws(()=>api.process('hi',['exec']),/Unknown/);
});
test('saves only validated workflow settings, not pasted data',()=>{
 const mem=new Map(),store={getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v)};
 const recipe={name:'Weekly cleanup',steps:['trim','unique'],options:{query:'shoe',matchCase:true}};
 api.saveRecipes(store,[recipe]);
 const [loaded]=api.readRecipes(store);
 assert.equal(loaded.name,'Weekly cleanup');
 assert.deepEqual(loaded.steps,['trim','unique']);
 assert.equal(loaded.options.query,'shoe');
 assert.equal(loaded.options.matchCase,true);
 assert.equal(api.safeRecipe({name:'bad',steps:['eraseDisk']}),null);
 assert.doesNotMatch([...mem.values()][0],/pasted data/);
});
test('workspace page has all required UI IDs and no duplicates',()=>{
 const source=fs.readFileSync(path.join(dir,'assets/tiny-workspace.js'),'utf8');
 const ids=[...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const m of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1]),'Missing '+m[1]);
 for(const step of api.STEPS)assert.match(page,new RegExp('data-ws-step="'+step+'"'));
 assert.match(page,/id="ws-compare-toggle"/);
 assert.match(page,/id="ws-download"/);
 assert.match(page,/id="ws-save-recipe"/);
});
test('home page, sitemap and stylesheet integrate the new flagship tool',()=>{
 assert.match(home,/href="\.\/workspace\/"/);
 assert.ok(home.indexOf('class="workspace-feature"')<home.indexOf('class="collection-section"'));
 const map=fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8');
 assert.match(map,/https:\/\/everytinytool.com\/workspace\//);
 const css=fs.readFileSync(path.join(dir,'assets/tiny-workspace.css'),'utf8');
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.ws-compare\{display:grid/);
});

test('full UI initialization supports example, stage ordering, comparison, and saved recipes',async()=>{
 const vm=require('node:vm');
 const script=fs.readFileSync(path.join(dir,'assets/tiny-workspace.js'),'utf8');
 const ids=[...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 function element(id){
  return {
   id,hidden:false,disabled:false,value:'',checked:false,dataset:{},events:{},children:[],textContent:'',
   setAttribute(key,value){this[key]=value;},addEventListener(type,cb){this.events[type]=cb;},
   appendChild(node){this.children.push(node);},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},
   click(){return this.events.click?.();},focus(){},select(){},remove(){}
  };
 }
 const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
 elements['ws-format'].value='txt';
 const steps=[...page.matchAll(/data-ws-step="([^"]+)"/g)].map(m=>{
  const e=element('step-'+m[1]);e.dataset.wsStep=m[1];return e;
 });
 const groupBtns=[...page.matchAll(/data-ws-copy-group="([^"]+)"/g)].map(m=>{
  const e=element('group-'+m[1]);e.dataset.wsCopyGroup=m[1];return e;
 });
 const document={
  readyState:'loading',
  getElementById:id=>elements[id],
  createElement:tag=>element(tag),
  querySelectorAll:selector=>selector==='[data-ws-step]'?steps:selector==='[data-ws-copy-group]'?groupBtns:[],
  addEventListener(type,callback){this[type]=callback;},body:{appendChild(){}}
 };
 const memory=new Map(),window={
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
  navigator:{clipboard:{writeText:async text=>{window.copied=text;}}},
  isSecureContext:true,setTimeout(cb){cb();}
 };
 vm.runInNewContext(script,{document,window,module:{exports:{}}});
 document.DOMContentLoaded();
 assert.equal(elements['ws-stages'].children.length,3);
 elements['ws-example'].click();
 assert.equal(elements['ws-output'].value,'Apple\nBanana\nOrange\nCherry');
 assert.equal(elements['ws-only-a'].value,'Orange\nCherry');
 assert.equal(elements['ws-only-b'].value,'Mango');
 assert.equal(elements['ws-comparison'].hidden,false);
 elements['ws-query'].value='Banana';
 elements['ws-query'].events.input();
 steps.find(x=>x.dataset.wsStep==='filter').click();
 assert.equal(elements['ws-output'].value,'Banana');
 const down=elements['ws-stages'].children[0].children[1].children[1];
 down.click();
 assert.match(elements['ws-stages'].children[0].children[0].textContent,/Remove blank lines/);
 elements['ws-recipe-name'].value='Weekly cleanup';
 elements['ws-save-recipe'].click();
 assert.equal(memory.size,1);
 elements['ws-clear-steps'].click();
 elements['ws-saved-recipe'].value='0';
 elements['ws-load-recipe'].click();
 assert.equal(elements['ws-stages'].children.length,4);
 await elements['ws-copy'].click();
 assert.equal(window.copied,'Banana');
});
