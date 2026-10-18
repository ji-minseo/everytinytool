(function(root,factory){
const api=factory(root);
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',api.init);else api.init();}
})(typeof window!=='undefined'?window:{},function(root){
'use strict';
const MAX_INPUT=200000,MAX_LINES=10000,STORAGE_KEY='ett-workspace-recipes-v1';
const STEPS=['trim','blank','unique','sort','lower','upper','filter','replace','prefix','suffix'];
const DEFAULT_RECIPE=['trim','blank','unique'];
const NAMES={trim:'Trim whitespace',blank:'Remove blank lines',unique:'Remove duplicates',sort:'Sort A to Z',lower:'Lowercase',upper:'Uppercase',filter:'Keep matching lines',replace:'Find & replace',prefix:'Add prefix',suffix:'Add suffix'};
function parseLines(text){if(typeof text!=='string'||text.length>MAX_INPUT)throw Error('Use up to 200,000 characters.');const out=text.replace(/\r\n?/g,'\n').split('\n');if(out.length>MAX_LINES)throw Error('Use up to 10,000 lines.');return text===''?[]:out;}
function normalize(value,matchCase){return matchCase?value:value.toLocaleLowerCase();}
function runStep(lines,operation,opts={}){
 if(!STEPS.includes(operation))throw Error('Unknown workflow step.');
 let out=lines.slice();
 switch(operation){
 case 'trim':out=out.map(v=>v.trim());break;
 case 'blank':out=out.filter(v=>v.trim()!=='');break;
 case 'unique':{const seen=new Set();out=out.filter(v=>{const key=normalize(v.trim(),opts.matchCase);if(seen.has(key))return false;seen.add(key);return true;});break;}
 case 'sort':out.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:opts.matchCase?'variant':'base'}));break;
 case 'lower':out=out.map(v=>v.toLocaleLowerCase());break;
 case 'upper':out=out.map(v=>v.toLocaleUpperCase());break;
 case 'filter':{const q=String(opts.query||'');if(q)out=out.filter(v=>normalize(v,opts.matchCase).includes(normalize(q,opts.matchCase)));break;}
 case 'replace':{const find=String(opts.find||''),replacement=String(opts.replacement||'');if(find)out=out.map(v=>{if(opts.matchCase)return v.split(find).join(replacement);const escaped=find.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&');return v.replace(new RegExp(escaped,'gi'),()=>replacement);});break;}
 case 'prefix':out=out.map(v=>String(opts.prefix||'')+v);break;
 case 'suffix':out=out.map(v=>v+String(opts.suffix||''));break;
 }
 if(out.join('\n').length>MAX_INPUT*3)throw Error('Output too long; shorten replacement or prefix.');
 return out;
}
function process(text,steps,opts={}){
 const original=parseLines(text);let rows=original.slice();
 const history=[{name:'Original',rows:rows.slice(),before:rows.length,after:rows.length}];
 for(const op of steps){const before=rows.length;rows=runStep(rows,op,opts);history.push({name:NAMES[op],rows:rows.slice(),before,after:rows.length});}
 return {original,rows,history,output:rows.join('\n')};
}
function compareLists(a,b,matchCase=false){
 const map=items=>{const out=new Map();for(const v of items){const s=v.trim();if(!s)continue;const k=normalize(s,matchCase);if(!out.has(k))out.set(k,s);}return out;};
 const left=map(a),right=map(b);
 return {onlyA:[...left].filter(([k])=>!right.has(k)).map(([,v])=>v),shared:[...left].filter(([k])=>right.has(k)).map(([,v])=>v),onlyB:[...right].filter(([k])=>!left.has(k)).map(([,v])=>v)};
}
function exportText(rows,format){
 if(format==='txt')return {content:rows.join('\n'),type:'text/plain;charset=utf-8',ext:'txt'};
 if(format==='csv')return {content:'item\r\n'+rows.map(v=>'"'+v.replace(/"/g,'""')+'"').join('\r\n')+(rows.length?'\r\n':''),type:'text/csv;charset=utf-8',ext:'csv'};
 if(format==='json')return {content:JSON.stringify(rows,null,2),type:'application/json;charset=utf-8',ext:'json'};
 throw Error('Unsupported export format.');
}
function safeRecipe(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.steps)||input.steps.length>15||input.steps.some(s=>!STEPS.includes(s)))return null;
 const name=String(input.name||'').trim().slice(0,45);if(!name)return null;
 const opts=input.options||{},options={matchCase:!!opts.matchCase};
 for(const k of ['query','find','replacement','prefix','suffix'])options[k]=String(opts[k]||'').slice(0,300);
 return {name,steps:input.steps.slice(),options};
}
function readRecipes(store){try{const arr=JSON.parse(store.getItem(STORAGE_KEY)||'[]');return Array.isArray(arr)?arr.map(safeRecipe).filter(Boolean).slice(0,12):[];}catch(_){return [];}}
function saveRecipes(store,arr){store.setItem(STORAGE_KEY,JSON.stringify(arr.slice(0,12).map(safeRecipe).filter(Boolean)));}
function init(){
 const d=document,$=id=>d.getElementById(id);if(!$('workspace'))return;
 const input=$('ws-input'),reference=$('ws-reference'),output=$('ws-output'),stepsList=$('ws-stages');
 const comparisonEl=$('ws-comparison'),compareToggle=$('ws-compare-toggle'),referenceWrap=$('ws-reference-wrap');
 const ops={};for(const k of ['query','find','replacement','prefix','suffix','matchCase'])ops[k]=$('ws-'+k);
 const storage=(()=>{try{return root.localStorage||null}catch(_){return null}})();
 let steps=DEFAULT_RECIPE.slice(),result=null,comparison=null,preview=0;
 function options(){const o={matchCase:ops.matchCase.checked};for(const k of ['query','find','replacement','prefix','suffix'])o[k]=ops[k].value;return o;}
 function status(text,error=false){$('ws-status').textContent=text;$('ws-status').dataset.error=String(error);}
 function drawSteps(){
   stepsList.replaceChildren();
   steps.forEach((name,i)=>{
    const li=d.createElement('li');li.className='ws-step';
    const caption=d.createElement('span');caption.textContent=(i+1)+'. '+NAMES[name];li.appendChild(caption);
    const actions=d.createElement('div');actions.className='ws-step-actions';
    for(const [symbol,title,change,disabled] of [
     ['↑','Move earlier',()=>{[steps[i-1],steps[i]]=[steps[i],steps[i-1]];update();},i===0],
     ['↓','Move later',()=>{[steps[i],steps[i+1]]=[steps[i+1],steps[i]];update();},i===steps.length-1],
     ['×','Remove step',()=>{steps.splice(i,1);update();},false]
    ]){const b=d.createElement('button');b.type='button';b.textContent=symbol;b.disabled=disabled;b.setAttribute('aria-label',title+': '+NAMES[name]);b.addEventListener('click',change);actions.appendChild(b);}
    li.appendChild(actions);stepsList.appendChild(li);
   });
   $('ws-no-steps').hidden=steps.length!==0;
   d.querySelectorAll('[data-ws-step]').forEach(b=>b.disabled=steps.length>=15);
 }
 function drawHistory(){
  const el=$('ws-history');el.replaceChildren();if(!result)return;
  result.history.forEach((stage,index)=>{
   const b=d.createElement('button');b.type='button';b.className='ws-history-button';b.textContent=stage.name+' · '+stage.after+' lines';
   b.setAttribute('aria-pressed',String(preview===index));
   b.addEventListener('click',()=>{preview=index;output.value=result.history[index].rows.join('\n');drawHistory();status('Previewing '+stage.name+'. Export always uses the final output.');});
   el.appendChild(b);
  });
 }
 function drawCompare(){
  comparison=null;comparisonEl.hidden=true;if(!compareToggle.checked||!result)return;
  comparison=compareLists(result.rows,parseLines(reference.value),ops.matchCase.checked);
  comparisonEl.hidden=false;
  for(const [key,id] of [['onlyA','ws-only-a'],['shared','ws-shared'],['onlyB','ws-only-b']]){$(id).value=comparison[key].join('\n');$('count-'+key).textContent=comparison[key].length;}
 }
 function update(){
  drawSteps();
  try{
   result=process(input.value,steps,options());
   preview=result.history.length-1;output.value=result.output;
   $('ws-original-count').textContent=result.original.length;
   $('ws-result-count').textContent=result.rows.length;
   $('ws-removed-count').textContent=Math.max(0,result.original.length-result.rows.length);
   drawHistory();drawCompare();
   $('ws-download').disabled=!result.rows.length;$('ws-copy').disabled=!result.rows.length;
   status('Ready · '+result.rows.length+' output lines');
  }catch(e){result=null;comparison=null;output.value='';$('ws-history').replaceChildren();comparisonEl.hidden=true;$('ws-download').disabled=true;$('ws-copy').disabled=true;status(e.message,true);}
 }
 function setOptions(o){ops.matchCase.checked=!!o.matchCase;for(const k of ['query','find','replacement','prefix','suffix'])ops[k].value=String(o[k]||'');}
 function syncRecipes(){
  const select=$('ws-saved-recipe');select.replaceChildren();
  const empty=d.createElement('option');empty.value='';empty.textContent='Choose a saved workflow';select.appendChild(empty);
  if(storage)readRecipes(storage).forEach((recipe,i)=>{const opt=d.createElement('option');opt.value=String(i);opt.textContent=recipe.name;select.appendChild(opt);});
 }
 d.querySelectorAll('[data-ws-step]').forEach(b=>b.addEventListener('click',()=>{if(steps.length<15){steps.push(b.dataset.wsStep);update();}}));
 input.addEventListener('input',update);
 reference.addEventListener('input',()=>{try{drawCompare();}catch(e){comparisonEl.hidden=true;status(e.message,true);}});
 for(const k of Object.keys(ops))ops[k].addEventListener(k==='matchCase'?'change':'input',update);
 compareToggle.addEventListener('change',()=>{referenceWrap.hidden=!compareToggle.checked;update();});
 $('ws-clear-steps').addEventListener('click',()=>{steps=[];update();});
 $('ws-default').addEventListener('click',()=>{steps=DEFAULT_RECIPE.slice();update();});
 $('ws-example').addEventListener('click',()=>{
  input.value='  Apple\nBanana\napple\n\nOrange\nBanana\n  Cherry  ';
  reference.value='Apple\nMango\nBanana';compareToggle.checked=true;referenceWrap.hidden=false;steps=DEFAULT_RECIPE.slice();update();input.focus();
 });
 $('ws-clear-all').addEventListener('click',()=>{input.value='';reference.value='';compareToggle.checked=false;referenceWrap.hidden=true;steps=DEFAULT_RECIPE.slice();setOptions({});update();input.focus();});
 $('ws-copy').addEventListener('click',async()=>{
  if(!result)return;
  try{
   if(root.navigator?.clipboard&&root.isSecureContext)await root.navigator.clipboard.writeText(result.output);
   else{output.value=result.output;output.focus();output.select();if(!d.execCommand('copy'))throw Error('Clipboard unavailable');}
   status('Copied final output.');
  }catch(_){output.value=result.output;output.focus();output.select();status('Copy blocked. Select and copy the highlighted result.');}
 });
 $('ws-download').addEventListener('click',()=>{
  if(!result)return;
  const resultFile=exportText(result.rows,$('ws-format').value);
  const url=URL.createObjectURL(new Blob([resultFile.content],{type:resultFile.type}));
  const anchor=d.createElement('a');anchor.href=url;anchor.download='tiny-workspace.'+resultFile.ext;
  d.body.appendChild(anchor);anchor.click();anchor.remove();
  root.setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 d.querySelectorAll('[data-ws-copy-group]').forEach(b=>b.addEventListener('click',async()=>{
  const key=b.dataset.wsCopyGroup;if(!comparison)return;
  const content=comparison[key].join('\n');const field=$(key==='onlyA'?'ws-only-a':key==='shared'?'ws-shared':'ws-only-b');
  try{await root.navigator.clipboard.writeText(content);status('Copied '+comparison[key].length+' entries.');}
  catch(_){field.focus();field.select();status('Clipboard blocked. Copy selected entries manually.');}
 }));
 $('ws-save-recipe').addEventListener('click',()=>{
  if(!storage){status('Browser storage not available.',true);return;}
  const recipe=safeRecipe({name:$('ws-recipe-name').value,steps,options:options()});
  if(!recipe){status('Enter a name for your workflow.',true);return;}
  try{const recipes=readRecipes(storage).filter(r=>r.name!==recipe.name);recipes.unshift(recipe);saveRecipes(storage,recipes);syncRecipes();$('ws-saved-recipe').value='0';status('Saved workflow in this browser.');}catch(_){status('Could not save workflow.',true);}
 });
 $('ws-load-recipe').addEventListener('click',()=>{
  const selection=$('ws-saved-recipe').value;if(!storage||selection==='')return;
  const recipe=readRecipes(storage)[Number(selection)];if(!recipe)return;
  steps=recipe.steps.slice();setOptions(recipe.options);$('ws-recipe-name').value=recipe.name;update();status('Loaded '+recipe.name+'.');
 });
 $('ws-delete-recipe').addEventListener('click',()=>{
  const selected=$('ws-saved-recipe').value;if(!storage||selected==='')return;
  const recipes=readRecipes(storage);recipes.splice(Number(selected),1);
  try{saveRecipes(storage,recipes);syncRecipes();status('Saved workflow deleted.');}catch(_){status('Could not delete workflow.',true);}
 });
 syncRecipes();update();
}
return {MAX_INPUT,MAX_LINES,STEPS,DEFAULT_RECIPE,parseLines,runStep,process,compareLists,exportText,safeRecipe,readRecipes,saveRecipes,init};
});