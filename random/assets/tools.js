const $ = (selector) => document.querySelector(selector);

function parseItems(value) {
  return value.split(/\n|,/).map(v => v.trim()).filter(Boolean);
}
function randomFloat() {
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }
  return (Math.random)();
}
function sample(arr) {
  return arr[Math.floor(randomFloat() * arr.length)];
}
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function randomInt(min, max) {
  return Math.floor(randomFloat() * (max - min + 1)) + min;
}
function copyButtonText(button, message="Copied!") {
  const old=button.textContent;button.textContent=message;setTimeout(()=>button.textContent=old,1100);
}
function wheelLink(items) {
  const u=new URL("../wheel-decider/",location.href);
  u.searchParams.set("items",items.join("\n"));
  return u.toString();
}
async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button.children.length) {
      const label = button.querySelector("span");
      const value = button.querySelector("strong");
      if (label && value) {
        const oldLabel = label.textContent;
        const oldValue = value.textContent;
        label.textContent = "Copied!";
        value.textContent = "✓";
        setTimeout(() => {
          label.textContent = oldLabel;
          value.textContent = oldValue;
        }, 1100);
        return;
      }
    }
    const old = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => button.textContent = old, 1100);
  } catch {
    window.prompt("Copy this:", text);
  }
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function initColor() {
  const paletteEl=$("#palette"),history=[],colors=Array(5).fill("#000000"),locked=Array(5).fill(false);
  let selected=0;
  const hexToRgb=hex=>{const n=parseInt(hex.slice(1),16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}};
  const rgbToHsl=({r,g,b})=>{
    r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0,l=(max+min)/2;
    if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);
      switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4}h/=6}
    return {h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
  };
  const lum=hex=>{
    const {r,g,b}=hexToRgb(hex),f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
    return .2126*f(r)+.7152*f(g)+.0722*f(b);
  };
  const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const readable=hex=>lum(hex)>.38?"#111":"#fff";
  const randomHex=()=>"#"+randomInt(0,0xFFFFFF).toString(16).padStart(6,"0").toUpperCase();

  const syncSelected=()=>{
    const hex=colors[selected],rgb=hexToRgb(hex),hsl=rgbToHsl(rgb);
    $("#hexValue").textContent=hex;
    $("#rgbValue").textContent=`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    $("#hslValue").textContent=`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  };
  const updateContrast=()=>{
    const fg=colors[Number($("#contrastText").value)||0],bg=colors[Number($("#contrastBg").value)||1],r=contrast(fg,bg);
    $("#contrastRatio").textContent=`${r.toFixed(2)}:1`;
    $("#contrastStatus").textContent=r>=7?"AAA · excellent":r>=4.5?"AA · passes normal text":r>=3?"AA large text only":"Low contrast";
    const p=$("#contrastPreview");p.style.color=fg;p.style.background=bg;
  };
  const syncContrastOptions=()=>{
    for(const id of ["#contrastText","#contrastBg"]){
      const select=$(id),old=select.value;
      select.innerHTML=colors.map((hex,i)=>`<option value="${i}">Color ${i+1} · ${hex}</option>`).join("");
      select.value=old|| (id==="#contrastText"?"0":"1");
    }
    if($("#contrastText").value===$("#contrastBg").value)$("#contrastBg").value=$("#contrastText").value==="0"?"1":"0";
    updateContrast();
  };
  const renderPalette=()=>{
    paletteEl.innerHTML="";
    colors.forEach((hex,i)=>{
      const card=document.createElement("div");card.className="palette-swatch"+(selected===i?" selected":"");card.style.background=hex;card.style.color=readable(hex);
      const lock=document.createElement("button");lock.type="button";lock.className="palette-lock";lock.textContent=locked[i]?"🔒":"🔓";
      lock.addEventListener("click",ev=>{ev.stopPropagation();locked[i]=!locked[i];renderPalette()});
      const value=document.createElement("button");value.type="button";value.className="palette-hex";value.textContent=hex;
      card.addEventListener("click",()=>{selected=i;syncSelected();renderPalette()});
      value.addEventListener("click",ev=>{ev.stopPropagation();selected=i;syncSelected();renderPalette()});
      card.append(lock,value);paletteEl.appendChild(card);
    });
    syncSelected();syncContrastOptions();
  };
  const renderHistory=()=>{
    const box=$("#colorHistory");box.innerHTML="";
    history.forEach(hex=>{
      const b=document.createElement("button");b.type="button";b.className="color-chip";b.title=`Copy ${hex}`;b.style.background=hex;
      b.addEventListener("click",()=>copyText(hex,b));box.appendChild(b);
    });
  };
  const generate=()=>{
    colors.forEach((_,i)=>{if(!locked[i])colors[i]=randomHex()});
    colors.filter((_,i)=>!locked[i]).forEach(hex=>history.unshift(hex));
    history.splice(12);renderHistory();renderPalette();
  };
  $("#generate").addEventListener("click",generate);
  document.addEventListener("keydown",ev=>{
    const tag=document.activeElement?.tagName;
    if(ev.code==="Space"&&!["INPUT","TEXTAREA","SELECT","BUTTON"].includes(tag)){ev.preventDefault();generate()}
  });
  $("#copy").addEventListener("click",ev=>copyText(colors[selected],ev.currentTarget));
  $("#copyHex").addEventListener("click",ev=>copyText($("#hexValue").textContent,ev.currentTarget));
  $("#copyRgb").addEventListener("click",ev=>copyText($("#rgbValue").textContent,ev.currentTarget));
  $("#copyHsl").addEventListener("click",ev=>copyText($("#hslValue").textContent,ev.currentTarget));
  $("#copyPaletteCss").addEventListener("click",ev=>{
    const cssText=":root {\n"+colors.map((hex,i)=>`  --color-${i+1}: ${hex};`).join("\n")+"\n}";
    copyText(cssText,ev.currentTarget);
  });
  $("#contrastText").addEventListener("change",updateContrast);
  $("#contrastBg").addEventListener("change",updateContrast);
  generate();
}

function initChoice() {
  const output=$("#choiceResult"),input=$("#items"),historyEl=$("#choiceHistory"),countEl=$("#choiceCount"),pickCount=$("#choicePickCount");
  const history=[];
  const syncCount=()=>{
    const n=parseItems(input.value).length;
    countEl.textContent=`${n} choice${n===1?"":"s"}`;
    $("#spinChoices").disabled=n<2;
    pickCount.max=Math.max(1,n);if(Number(pickCount.value)>n&&n)pickCount.value=n;
  };
  const renderHistory=()=>historyEl.textContent=history.length>1?"Recent: "+history.join(" · "):"";
  const showPicks=picks=>{
    output.textContent=picks.join(" → ");
    history.unshift(picks.join(" → "));history.splice(5);renderHistory();
  };
  $("#pick").addEventListener("click",()=>{
    const items=parseItems(input.value);
    if(!items.length){output.textContent="Add at least one choice";return}
    const count=Math.min(items.length,Math.max(1,Math.trunc(Number(pickCount.value))||1));
    const picks=shuffle(items).slice(0,count);showPicks(picks);
    if($("#removePicked").checked){
      const remove=new Set(picks);input.value=items.filter(item=>!remove.has(item)).join("\n");syncCount();
    }
  });
  $("#example").addEventListener("click",()=>{input.value="Pizza\nTacos\nPasta\nSushi";pickCount.value=1;syncCount()});
  $("#copyChoice").addEventListener("click",ev=>copyText(output.textContent.replaceAll(" → ","\n"),ev.currentTarget));
  $("#spinChoices").addEventListener("click",()=>{const items=parseItems(input.value);if(items.length>=2)location.href=wheelLink(items)});
  input.addEventListener("input",syncCount);syncCount();
}

function colorsFor(count) {
  const palette = ["#0A84FF","#65B5FF","#FFD95A","#76D7C4","#FFB5C8","#8CC8FF","#FFAA7A","#A7E46B"];
  return Array.from({length: count}, (_, i) => palette[i % palette.length]);
}
function wheelGradient(items) {
  const colors = colorsFor(items.length);
  const step = 360 / items.length;
  return `conic-gradient(${items.map((_, i) => `${colors[i]} ${i*step}deg ${(i+1)*step}deg`).join(",")})`;
}
function initWheel() {
  const wheel = $("#wheel");
  const output = $("#wheelResult");
  const input = $("#wheelItems");
  const removeWinner = $("#removeWinner");
  const soundToggle = $("#wheelSound");
  const shareStatus = $("#wheelShareStatus");
  let rotation = 0;
  let spinning = false;
  const winners = [];
  const renderWinnerHistory=()=>$("#wheelHistory").textContent=winners.length>1?"Recent: "+winners.join(" · "):"";
  const history = [];
  const storageKey = "randomEverythingWheel";

  const loadStored = () => {
    const params = new URLSearchParams(location.search);
    const shared = params.get("items");
    if (shared) {
      input.value = shared;
      removeWinner.checked = params.get("remove") === "1";
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.items) input.value = saved.items;
      if (typeof saved?.remove === "boolean") removeWinner.checked = saved.remove;
      if (typeof saved?.sound === "boolean") soundToggle.checked = saved.sound;
      if (Array.isArray(saved?.history)) history.push(...saved.history.slice(0,10));
    } catch {}
  };
  const saveStored = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        items: input.value,
        remove: removeWinner.checked,
        sound: soundToggle.checked,
        history: history.slice(0,10)
      }));
    } catch {}
  };
  const renderLabels = items => {
    wheel.innerHTML = "";
    if (items.length < 2) return;
    const step = 360 / items.length;
    const size = items.length > 18 ? 9 : items.length > 12 ? 10 : items.length > 8 ? 11 : 12;
    items.forEach((item,i) => {
      const angle = i * step + step / 2;
      const rad = angle * Math.PI / 180;
      const label = document.createElement("span");
      label.className = "wheel-label";
      label.textContent = item;
      label.title = item;
      label.style.left = `${50 + Math.sin(rad) * 31}%`;
      label.style.top = `${50 - Math.cos(rad) * 31}%`;
      const flip = angle > 90 && angle < 270 ? 180 : 0;
      label.style.transform = `translate(-50%,-50%) rotate(${angle + flip}deg)`;
      label.style.fontSize = size + "px";
      wheel.appendChild(label);
    });
  };
  const sync = () => {
    const items = parseItems(input.value);
    wheel.style.background = items.length > 1 ? wheelGradient(items) : "#e8f3ff";
    renderLabels(items);
    saveStored();
  };
  const audioTone = (freq=440,duration=.06,volume=.035) => {
    if (!soundToggle.checked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx(), osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq; gain.gain.value = volume;
      osc.connect(gain); gain.connect(ctx.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
      osc.onended = () => ctx.close();
    } catch {}
  };
  const spinSound = () => {
    if (!soundToggle.checked) return;
    [0,180,380,610,870,1160,1480,1830,2200,2580,2920].forEach((t,i)=>
      setTimeout(()=>audioTone(240 + i*14,.045,.02),t)
    );
  };
  const celebrate = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer=document.createElement("div");layer.className="confetti-layer";
    const chars=["✦","●","■","▲"];
    for(let i=0;i<54;i++){
      const piece=document.createElement("i");piece.textContent=chars[i%chars.length];
      piece.style.left=(10+randomFloat()*80)+"%";
      piece.style.setProperty("--drift",(randomFloat()*160-80)+"px");
      piece.style.setProperty("--delay",(randomFloat()*.28)+"s");
      piece.style.setProperty("--spin",(randomFloat()*540+180)+"deg");
      piece.style.color=colorsFor(8)[i%8];
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);setTimeout(()=>layer.remove(),1900);
  };

  const renderHistory=()=>{
    const el=$("#wheelHistory");
    el.textContent=history.length?"Recent winners: "+history.slice(0,8).join(" · "):"";
  };
  loadStored();renderHistory();
  input.addEventListener("input", sync);
  removeWinner.addEventListener("change", saveStored);
  soundToggle.addEventListener("change", saveStored);

  $("#copyWheelResult").addEventListener("click",e=>copyText(output.textContent,e.currentTarget));

  $("#copyWheelWinner").addEventListener("click",e=>copyText(output.textContent,e.currentTarget));

  $("#shareWheel").addEventListener("click", async e => {
    const items = parseItems(input.value);
    if (!items.length) {
      shareStatus.textContent = "Add at least one choice first.";
      return;
    }
    const u = new URL(location.href);
    u.search = "";
    u.searchParams.set("items", items.join("\n"));
    if (removeWinner.checked) u.searchParams.set("remove","1");
    await copyText(u.toString(), e.currentTarget);
    shareStatus.textContent = "Share link copied.";
    setTimeout(()=>shareStatus.textContent="",1800);
  });

  $("#spin").addEventListener("click", () => {
    if (spinning) return;
    const items = parseItems(input.value);
    if (items.length < 2) {
      output.textContent = "Add at least two choices";
      return;
    }
    spinning = true;
    $("#spin").disabled = true;
    const winnerIndex = Math.floor(randomFloat() * items.length);
    const step = 360 / items.length;
    const targetCenter = winnerIndex * step + step / 2;
    const normalized = ((rotation % 360) + 360) % 360;
    const desired = (360 - targetCenter) % 360;
    const delta = (desired - normalized + 360) % 360;
    rotation += 360 * (5 + Math.floor(randomFloat() * 3)) + delta;
    wheel.style.transform = `rotate(${rotation}deg)`;
    output.textContent = "Spinning…";
    spinSound();
    setTimeout(() => {
      const winner = items[winnerIndex];
      output.textContent = winner;
      history.unshift(winner);history.splice(10);renderHistory();saveStored();
      $("#spin").textContent = "Spin again";
      audioTone(660,.16,.055);setTimeout(()=>audioTone(880,.18,.05),120);
      celebrate();
      if (removeWinner.checked) {
        items.splice(winnerIndex,1);
        input.value = items.join("\n");
        sync();
      }
      spinning = false;
      $("#spin").disabled = false;
    }, 3250);
  });
  sync();
}

function renderGroups(container, groups, label="Group") {
  container.innerHTML = groups.map((group, i) =>
    `<section class="team"><h3>${label} ${i+1}</h3><ul>${group.map(n => `<li>${escapeHtml(n)}</li>`).join("")}</ul></section>`
  ).join("");
}
function groupsToText(groups,label="Group"){
  return groups.map((group,i)=>`${label} ${i+1}: ${group.join(", ")}`).join("\n");
}
function renderEditableTeams(container,groups,onMove){
  container.innerHTML=groups.map((team,i)=>`<section class="team editable-team" data-team="${i}"><h3>Team ${i+1}</h3><ul>${team.map((name,j)=>`<li class="team-member" draggable="true" data-team="${i}" data-member="${j}">${escapeHtml(name)}</li>`).join("")}</ul></section>`).join("");
  container.querySelectorAll(".team-member").forEach(li=>li.addEventListener("dragstart",ev=>{
    ev.dataTransfer.setData("text/plain",JSON.stringify({team:Number(li.dataset.team),member:Number(li.dataset.member)}));
    li.classList.add("dragging");
  }));
  container.querySelectorAll(".team-member").forEach(li=>li.addEventListener("dragend",()=>li.classList.remove("dragging")));
  container.querySelectorAll(".editable-team").forEach(team=>{
    team.addEventListener("dragover",ev=>{ev.preventDefault();team.classList.add("dragover")});
    team.addEventListener("dragleave",()=>team.classList.remove("dragover"));
    team.addEventListener("drop",ev=>{
      ev.preventDefault();team.classList.remove("dragover");
      try{const src=JSON.parse(ev.dataTransfer.getData("text/plain"));onMove(src.team,src.member,Number(team.dataset.team))}catch{}
    });
  });
}
function initTeams() {
  let latest=[];
  const mode=$("#teamMode"),value=$("#teamCount"),label=$("#teamValueLabel");
  const syncMode=()=>{
    const bySize=mode.value==="size";
    label.textContent=bySize?"People per team":"Number of teams";
    value.min=bySize?"1":"2";
  };
  const render=()=>{
    renderEditableTeams($("#teamsResult"),latest,(fromTeam,memberIndex,toTeam)=>{
      if(fromTeam===toTeam)return;
      const [person]=latest[fromTeam].splice(memberIndex,1);if(!person)return;
      latest[toTeam].push(person);latest=latest.filter(t=>t.length);render();
    });
    const total=latest.reduce((n,t)=>n+t.length,0);
    $("#teamSummary").textContent=latest.length?`${total} people · ${latest.length} teams · sizes ${latest.map(t=>t.length).join(" / ")} · drag names to adjust`:"";
    ["#reshuffleTeams","#copyTeams","#spinTeams"].forEach(sel=>$(sel).disabled=!latest.length);
  };
  const build=()=>{
    const names=parseItems($("#names").value),raw=Math.max(1,Number(value.value)||2);
    if(names.length<2){
      latest=[];
      $("#teamsResult").innerHTML="<div class='team'><h3>Add at least two names</h3></div>";
      $("#teamSummary").textContent="";
      ["#reshuffleTeams","#copyTeams","#spinTeams"].forEach(sel=>$(sel).disabled=true);
      return;
    }
    const count=mode.value==="size"?Math.ceil(names.length/raw):Math.max(2,Math.min(Math.trunc(raw),names.length));
    latest=Array.from({length:Math.max(1,count)},()=>[]);
    shuffle(names).forEach((person,index)=>latest[index%latest.length].push(person));render();
  };
  mode.addEventListener("change",syncMode);syncMode();
  $("#makeTeams").addEventListener("click",build);
  $("#reshuffleTeams").addEventListener("click",build);
  $("#copyTeams").addEventListener("click",ev=>latest.length&&copyText(groupsToText(latest,"Team"),ev.currentTarget));
  $("#spinTeams").addEventListener("click",()=>latest.length&&(location.href=wheelLink(latest.map((_,i)=>`Team ${i+1}`))));
}

const pictionary = {
  word: {
    animals: {
      easy: ["cat","dog","rabbit","fish","duck","horse","frog","mouse","turtle","sheep"],
      medium: ["dolphin","penguin","giraffe","octopus","kangaroo","jellyfish","raccoon","peacock","hamster","seahorse"],
      hard: ["chameleon","platypus","narwhal","armadillo","porcupine","axolotl","mongoose","wolverine","cassowary","pangolin"]
    },
    food: {
      easy: ["apple","pizza","cake","banana","cookie","carrot","donut","burger","grapes","sandwich"],
      medium: ["avocado","cupcake","popcorn","spaghetti","pancake","sushi","waffle","pretzel","taco","croissant"],
      hard: ["ratatouille","soufflé","charcuterie","gnocchi","tiramisu","baklava","kimchi","paella","risotto","tempura"]
    },
    places: {
      easy: ["beach","school","park","farm","zoo","store","house","garden","pool","library"],
      medium: ["airport","museum","stadium","lighthouse","castle","campsite","aquarium","subway","harbor","waterfall"],
      hard: ["observatory","archipelago","catacomb","amphitheater","monastery","greenhouse","shipyard","planetarium","embassy","vineyard"]
    },
    actions: {
      easy: ["run","jump","dance","sleep","wave","swim","laugh","read","sing","cook"],
      medium: ["whisper","juggle","skate","sneeze","stretch","climb","balance","knit","salute","tiptoe"],
      hard: ["negotiate","daydream","eavesdrop","procrastinate","improvise","meditate","investigate","camouflage","apologize","celebrate"]
    },
    objects: {
      easy: ["book","hat","chair","phone","clock","key","ball","lamp","shoe","spoon"],
      medium: ["backpack","headphones","telescope","skateboard","umbrella","flashlight","typewriter","binoculars","suitcase","thermometer"],
      hard: ["metronome","periscope","hourglass","compass","abacus","stethoscope","kaleidoscope","sextant","phonograph","microscope"]
    },
    people: {
      easy: ["teacher","doctor","chef","baby","farmer","singer","king","queen","pilot","artist"],
      medium: ["detective","firefighter","magician","astronaut","photographer","lifeguard","scientist","barista","mechanic","referee"],
      hard: ["archaeologist","ventriloquist","choreographer","meteorologist","cartographer","blacksmith","conductor","ambassador","paleontologist","illusionist"]
    }
  },
  phrase: {
    animals: {
      easy: ["cat in a box","dog chasing a ball","duck in the rain","fish in a bowl","rabbit eating a carrot","horse jumping a fence","frog on a lily pad","mouse with cheese","turtle at the beach","sheep on a hill"],
      medium: ["penguin on vacation","dolphin jumping through a hoop","giraffe wearing a scarf","octopus playing drums","kangaroo carrying groceries","jellyfish at a party","raccoon opening a trash can","peacock showing its feathers","hamster on a wheel","seahorse in a race"],
      hard: ["chameleon changing colors","platypus solving a mystery","narwhal at a birthday party","armadillo rolling downhill","porcupine getting a haircut","axolotl wearing sunglasses","mongoose guarding a treasure","wolverine reading a map","cassowary crossing a road","pangolin doing yoga"]
    },
    food: {
      easy: ["eating ice cream","birthday cake with candles","making a sandwich","cutting a pizza","peeling a banana","sharing cookies","drinking hot chocolate","popping popcorn","making pancakes","packing a lunch"],
      medium: ["burning the toast","spaghetti on a white shirt","sushi on a conveyor belt","waffle tower falling over","avocado on toast","taco spilling everywhere","croissant at breakfast","giant bowl of ramen","picnic with cupcakes","pretzel shaped like a heart"],
      hard: ["soufflé collapsing in the oven","chef plating ratatouille","sharing a charcuterie board","rolling homemade gnocchi","decorating tiramisu","making baklava layers","fermenting kimchi","cooking paella outdoors","stirring mushroom risotto","frying tempura vegetables"]
    },
    places: {
      easy: ["day at the beach","walking to school","picnic in the park","feeding animals on a farm","visiting the zoo","shopping at a store","cleaning the house","watering the garden","swimming at the pool","reading in the library"],
      medium: ["missing a flight at the airport","getting lost in a museum","cheering in a stadium","climbing a lighthouse","exploring an old castle","camping in the rain","sleeping beside an aquarium","waiting for the subway","boats in a busy harbor","hiking to a waterfall"],
      hard: ["stargazing at an observatory","island hopping through an archipelago","exploring an underground catacomb","performing in an amphitheater","visiting a mountain monastery","plants inside a greenhouse","repairing a ship at the shipyard","watching stars in a planetarium","meeting at an embassy","harvesting grapes in a vineyard"]
    },
    actions: {
      easy: ["riding a bike","flying a kite","reading a book","playing soccer","washing the car","opening a present","building a snowman","jumping in puddles","walking the dog","brushing your teeth"],
      medium: ["missing the bus","winning a race","taking a selfie","singing in the shower","chasing a butterfly","stuck in traffic","building a sandcastle","juggling three balls","walking on the moon","trying to balance on one foot"],
      hard: ["thinking outside the box","walking on thin ice","breaking the ice","spilling the beans","hitting the road","time flying by","reading between the lines","barking up the wrong tree","pulling an all-nighter","trying to multitask"]
    },
    objects: {
      easy: ["balloon tied to a chair","book under a pillow","hat blown by the wind","phone with a cracked screen","clock striking midnight","key stuck in a lock","ball bouncing downstairs","lamp beside a bed","shoe full of water","spoon in a cereal bowl"],
      medium: ["backpack full of bricks","headphones tangled in a pocket","telescope pointed at the moon","skateboard under a couch","umbrella turning inside out","flashlight with dead batteries","typewriter missing a key","binoculars at a birdwatching trip","suitcase that will not close","thermometer in a snowstorm"],
      hard: ["metronome keeping a strange rhythm","periscope above the water","hourglass almost empty","compass pointing the wrong way","abacus in a math contest","stethoscope around a statue","kaleidoscope full of stars","sextant on a pirate ship","phonograph playing an old record","microscope showing a tiny world"]
    },
    people: {
      easy: ["teacher writing on a board","doctor checking a heartbeat","chef flipping a pancake","baby taking first steps","farmer driving a tractor","singer on a stage","king wearing a crown","queen waving from a balcony","pilot flying a plane","artist painting a portrait"],
      medium: ["detective following footprints","firefighter rescuing a cat","magician pulling a rabbit from a hat","astronaut planting a flag","photographer chasing the perfect shot","lifeguard blowing a whistle","scientist mixing a potion","barista making latte art","mechanic changing a tire","referee showing a red card"],
      hard: ["archaeologist uncovering a fossil","ventriloquist arguing with a puppet","choreographer teaching a dance","meteorologist tracking a storm","cartographer drawing a fantasy map","blacksmith forging a sword","conductor leading an orchestra","ambassador giving a speech","paleontologist assembling a skeleton","illusionist escaping from a locked box"]
    }
  }
};

function initPictionary() {
  const output = $("#wordResult");
  const typeEl = $("#pictionaryType"), diffEl = $("#difficulty"), catEl = $("#pictionaryCategory"), countEl = $("#promptCountSelect");
  const promptMeta = $("#promptCount");
  const decks = new Map(), roundHistory=[];
  let timerId = null, remaining = 60, currentPrompts=[];

  const poolFor = () => {
    const type = typeEl?.value || "word", difficulty = diffEl?.value || "easy", category = catEl?.value || "all";
    const categories = category === "all" ? Object.keys(pictionary[type]) : [category];
    return categories.flatMap(cat => (pictionary[type][cat]?.[difficulty] || []).map(text => ({text,category:cat})));
  };
  const deckKey = () => `${typeEl?.value||"word"}|${diffEl?.value||"easy"}|${catEl?.value||"all"}`;
  const getDeck = () => {
    const key=deckKey(),pool=poolFor();
    let deck=decks.get(key);
    if(!deck?.length) { deck=shuffle(pool); decks.set(key,deck); }
    return deck;
  };
  const totalBuiltIn = Object.values(pictionary).reduce((sum,typeMap)=>
    sum + Object.values(typeMap).reduce((a,catMap)=>a + Object.values(catMap).reduce((b,arr)=>b+arr.length,0),0),0
  );
  const updateMeta = () => {
    const pool=poolFor(),deck=decks.get(deckKey());
    const left=deck?.length ?? pool.length;
    promptMeta.textContent=`${totalBuiltIn} prompts built in · ${pool.length} match these filters · ${left} left before repeats`;
  };
  const renderHistory=()=>{
    const box=$("#pictionaryHistory");
    box.innerHTML=history.map((set,i)=>`<button type="button" class="history-row" data-pic-history="${i}">${escapeHtml(set.join(" · "))}</button>`).join("");
    box.querySelectorAll("[data-pic-history]").forEach(btn=>btn.addEventListener("click",()=>copyText(history[Number(btn.dataset.picHistory)].join("\n"),btn)));
  };
  const draw = () => {
    const pool=poolFor();
    if(!pool.length){output.textContent="No prompts match these filters";return}
    const requested=Math.max(1,Math.min(Number(countEl?.value||1),pool.length));
    const picks=[];
    while(picks.length<requested){
      const deck=getDeck();
      if(!deck.length)continue;
      picks.push(deck.pop());
    }
    currentPrompts=picks.map(p=>p.text);
    if(picks.length===1) output.textContent=picks[0].text;
    else output.innerHTML=`<div class="prompt-stack">${picks.map((p,i)=>`<div><span>${i+1}</span>${escapeHtml(p.text)}</div>`).join("")}</div>`;
    roundHistory.unshift(currentPrompts.join(" / "));roundHistory.splice(5);
    $("#promptHistory").textContent=roundHistory.length>1?"Recent rounds: "+roundHistory.slice(1).join(" · "):"";
    updateMeta();
  };
  const resetDeck = () => { decks.delete(deckKey()); draw(); };

  const formatTime=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const syncTimer = () => $("#timerDisplay").textContent=formatTime(remaining);
  const beep = () => {
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext,ctx=new AudioCtx(),osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.frequency.value=720;gain.gain.value=.05;osc.connect(gain);gain.connect(ctx.destination);osc.start();
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.35);osc.stop(ctx.currentTime+.35);osc.onended=()=>ctx.close();
    }catch{}
  };
  const resetTimer = () => {
    clearInterval(timerId);timerId=null;remaining=Number($("#timerSeconds").value||60);syncTimer();$("#startTimer").textContent="Start timer";
  };
  $("#startTimer").addEventListener("click",()=>{
    if(timerId){clearInterval(timerId);timerId=null;$("#startTimer").textContent="Resume";return}
    if(remaining<=0)remaining=Number($("#timerSeconds").value||60);
    $("#startTimer").textContent="Pause";
    timerId=setInterval(()=>{
      remaining--;syncTimer();
      if(remaining<=0){clearInterval(timerId);timerId=null;$("#startTimer").textContent="Start timer";beep();output.classList.add("timer-done");setTimeout(()=>output.classList.remove("timer-done"),700)}
    },1000);
  });
  $("#resetTimer").addEventListener("click",resetTimer);
  $("#timerSeconds").addEventListener("change",resetTimer);
  $("#newWord").addEventListener("click",draw);
  $("#copyPrompts").addEventListener("click",ev=>copyText(currentPrompts.join("\n"),ev.currentTarget));
  $("#resetPrompts").addEventListener("click",resetDeck);
  [typeEl,diffEl,catEl,countEl].forEach(el=>el?.addEventListener("change",()=>{
    if(el!==countEl) decks.delete(deckKey());
    draw();
  }));
  remaining=Number($("#timerSeconds").value||60);syncTimer();draw();updateMeta();
}

function initNumber() {
  const output=$("#numberResult"),historyEl=$("#numberHistory"),history=[];
  let current=[];
  const renderHistory=()=>{
    historyEl.innerHTML=history.map((set,i)=>`<button type="button" class="history-row" data-history="${i}">${escapeHtml(set.join(", "))}</button>`).join("");
    historyEl.querySelectorAll("[data-history]").forEach(btn=>btn.addEventListener("click",()=>copyText(history[Number(btn.dataset.history)].join(", "),btn)));
  };
  const generate=()=>{
    let min=Number($("#minNumber").value),max=Number($("#maxNumber").value);
    let count=Math.max(1,Math.min(1000,Math.trunc(Number($("#numberCount").value))||1));
    const decimals=Math.max(0,Math.min(6,Number($("#decimalPlaces").value)||0)),scale=10**decimals;
    if(!Number.isFinite(min)||!Number.isFinite(max)){output.textContent="Enter valid numbers";return}
    if(min>max)[min,max]=[max,min];
    const minI=Math.ceil(min*scale),maxI=Math.floor(max*scale);
    if(minI>maxI){output.textContent="Range is too small for that precision";return}
    let ints=[];
    if($("#uniqueNumbers").checked){
      const range=maxI-minI+1;
      if(range>1000000){output.textContent="Use a smaller range for unique values";return}
      count=Math.min(count,range);
      const pool=Array.from({length:range},(_,i)=>minI+i);
      ints=shuffle(pool).slice(0,count);
    }else{
      ints=Array.from({length:count},()=>randomInt(minI,maxI));
    }
    current=ints.map(v=>v/scale);
    if($("#sortNumbers").checked)current.sort((a,b)=>a-b);
    const shown=current.map(v=>decimals?v.toFixed(decimals):String(v));
    output.textContent=shown.join(", ");
    history.unshift(shown);history.splice(5);renderHistory();
  };
  $("#generateNumber").addEventListener("click",generate);
  $("#lottoPreset").addEventListener("click",()=>{
    $("#minNumber").value=1;$("#maxNumber").value=45;$("#numberCount").value=6;$("#decimalPlaces").value=0;
    $("#uniqueNumbers").checked=true;$("#sortNumbers").checked=true;generate();
  });
  $("#copyNumbers").addEventListener("click",ev=>copyText(output.textContent,ev.currentTarget));
  $("#downloadNumbers").addEventListener("click",()=>{
    if(!current.length)return;
    const blob=new Blob([output.textContent+"\n"],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="random-numbers.txt";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  generate();
}

const firstNames = ["Avery","Mia","Noah","Liam","Emma","Lucas","Sofia","Leo","Chloe","Ethan","Maya","Theo","Ella","Owen","Lily","Kai","Nora","Milo","Zoe","Finn","Ivy","Aria","Jude","Ruby","Ezra","Luna","Alex","Sam","Taylor","Jordan","Riley","Casey","Jamie","Morgan","Quinn","Rowan","Skyler","Parker","Reese","Cameron","Amelia","Olivia","Isla","Grace","Hazel","Violet","Lucy","Stella","Claire","Alice","Eva","Naomi","Elena","Iris","Wren","Maeve","June","Rose","Nina","Lena","Henry","Jack","Oliver","Elijah","Mateo","Julian","Asher","Miles","Felix","Silas","Caleb","Eli","Oscar","Arthur","Hugo","Max","Cole","Dean","Nico","Remy","Drew","Blake","Charlie","Logan","Micah","Sage","Emery","Dakota","Harper","Sydney","Bailey","Ariel","Robin","Jesse","Shawn","Devon","Toby","Mason","Evan","Ian","Adam","Aaron","Dylan","Wyatt","Roman","Louis","Simon","Ben","Luke"];
const lastNames = ["Anderson","Bennett","Brooks","Carter","Clark","Collins","Cooper","Davis","Evans","Foster","Gray","Green","Hall","Hayes","Hill","Howard","James","Kelly","Lee","Lewis","Martin","Miller","Moore","Morgan","Parker","Reed","Rivera","Scott","Smith","Stone","Taylor","Thomas","Turner","Walker","Ward","White","Wilson","Wright","Young","King","Adams","Allen","Bailey","Baker","Bell","Brown","Campbell","Cook","Cox","Diaz","Edwards","Fisher","Flores","Garcia","Gomez","Gonzalez","Griffin","Harris","Hughes","Jackson","Jenkins","Johnson","Jones","Kim","Lopez","Martinez","Mitchell","Murphy","Nelson","Nguyen","Ortiz","Patel","Perez","Perry","Phillips","Price","Ramirez","Roberts","Robinson","Rodriguez","Rogers","Ross","Russell","Sanchez","Sanders","Stewart","Sullivan","Thompson","Torres","Washington","Watson","Williams","Wood","Barnes","Coleman","Powell","Long","Patterson","Henderson","Bryant","Alexander"];
function initName() {
  const output=$("#nameResult"),meta=$("#namePoolMeta"),history=[];
  const renderHistory=()=>{
    const box=$("#nameHistory");
    box.innerHTML=history.map((set,i)=>`<button type="button" class="history-row" data-name-history="${i}">${escapeHtml(set.join(" · "))}</button>`).join("");
    box.querySelectorAll("[data-name-history]").forEach(btn=>btn.addEventListener("click",()=>copyText(history[Number(btn.dataset.nameHistory)].join("\n"),btn)));
  };
  const generate=()=>{
    const count=Math.max(1,Math.min(20,Math.trunc(Number($("#nameCount").value))||1)),style=$("#nameStyle")?.value||"full";
    const names=new Set(),maxUnique=style==="first"?firstNames.length:style==="last"?lastNames.length:firstNames.length*lastNames.length,target=Math.min(count,maxUnique);
    while(names.size<target){
      if(style==="first")names.add(sample(firstNames));
      else if(style==="last")names.add(sample(lastNames));
      else names.add(`${sample(firstNames)} ${sample(lastNames)}`);
    }
    const result=[...names];output.textContent=result.join(" · ");
    history.unshift(result);history.splice(5);renderHistory();
    meta.textContent=`${firstNames.length} first names · ${lastNames.length} last names · ${(firstNames.length*lastNames.length).toLocaleString()} full-name combinations`;
  };
  $("#generateName").addEventListener("click",generate);
  $("#nameStyle")?.addEventListener("change",generate);
  $("#copyNames").addEventListener("click",e=>copyText(output.textContent.replaceAll(" · ","\n"),e.currentTarget));
  generate();
}

const randomWords = {
  noun: ["anchor","apple","beacon","bridge","candle","castle","cloud","comet","crystal","door","forest","garden","harbor","island","jacket","key","lantern","mirror","ocean","paper","river","rocket","shadow","signal","star","stone","tower","train","window","wing","planet","meadow","bottle","camera","pocket","pencil","blanket","button","forest","helmet","market","museum","puzzle","ribbon","saddle","screen","shelter","ticket","tunnel","wallet","basket","feather","hammer","ladder","magnet","pillow","statue","temple","village","whistle","branch","desert","engine","fountain","garage","island","kitten","notebook","orchard","parade","quartz","station","thunder","valley","zipper","canyon","diamond","festival","glacier","horizon","library"],
  verb: ["build","catch","climb","dance","drift","explore","float","gather","glow","imagine","jump","listen","mix","open","paint","race","remember","roll","search","share","sketch","spin","travel","wander","whisper","write","zoom","balance","create","discover","bounce","carry","chase","collect","compare","crawl","design","dream","escape","fold","follow","giggle","grab","hide","hop","invent","launch","march","notice","pack","pour","reach","repair","sail","shake","slide","solve","splash","stretch","swing","trace","trade","unpack","visit","wave","wonder","arrange","breathe","celebrate","deliver","examine","forgive","glance","measure","protect","rescue","scatter","translate","uncover","welcome"],
  adjective: ["bright","calm","clever","cozy","curious","gentle","golden","happy","hidden","icy","lucky","messy","quiet","rapid","round","shiny","silent","soft","strange","sunny","tiny","wild","witty","brave","crisp","dreamy","fresh","playful","simple","vivid","ancient","bouncy","cloudy","dusty","fancy","fuzzy","glossy","graceful","hungry","jolly","kind","lively","misty","narrow","polite","proud","rough","sleepy","smooth","spicy","stormy","striped","tasty","thirsty","twisted","warm","wooden","young","zany","bitter","careful","delicate","eager","fragile","giant","hollow","jagged","massive","modern","mysterious","ordinary","peaceful","powerful","remote","rusty","shallow","sparkling","steady","uneven"]
};
function initWord() {
  const output=$("#randomWordResult"),meta=$("#wordPoolMeta"),decks=new Map(),history=[];
  const poolFor=()=>{
    const category=$("#wordCategory").value,length=$("#wordLength").value,start=($("#wordStartsWith").value||"").trim().toLowerCase();
    let pool=category==="all"?[...randomWords.noun,...randomWords.verb,...randomWords.adjective]:[...randomWords[category]];
    if(length==="short")pool=pool.filter(w=>w.length<=5);
    if(length==="medium")pool=pool.filter(w=>w.length>=6&&w.length<=8);
    if(length==="long")pool=pool.filter(w=>w.length>=9);
    if(start)pool=pool.filter(w=>w.toLowerCase().startsWith(start));
    return [...new Set(pool)];
  };
  const key=()=>`${$("#wordCategory").value}|${$("#wordLength").value}|${($("#wordStartsWith").value||"").trim().toLowerCase()}`;
  const getDeck=()=>{
    const k=key(),pool=poolFor();let deck=decks.get(k);
    if(!deck?.length){deck=shuffle(pool);decks.set(k,deck)}
    return deck;
  };
  const updateMeta=()=>{
    const pool=poolFor(),deck=decks.get(key());
    meta.textContent=`${pool.length} words match · ${deck?.length??pool.length} left before repeats`;
  };
  const renderHistory=()=>{
    const box=$("#wordHistory");
    box.innerHTML=history.map((set,i)=>`<button type="button" class="history-row" data-word-history="${i}">${escapeHtml(set.join(" · "))}</button>`).join("");
    box.querySelectorAll("[data-word-history]").forEach(btn=>btn.addEventListener("click",()=>copyText(history[Number(btn.dataset.wordHistory)].join("\n"),btn)));
  };
  const generate=()=>{
    const pool=poolFor();if(!pool.length){output.textContent="No words match these filters";updateMeta();return}
    const count=Math.min(Math.max(1,Math.min(20,Math.trunc(Number($("#wordCount").value))||1)),pool.length),picks=[];
    while(picks.length<count)picks.push(getDeck().pop());
    output.textContent=picks.join(" · ");history.unshift([...picks]);history.splice(5);renderHistory();updateMeta();
  };
  $("#generateWord").addEventListener("click",generate);
  $("#copyWords").addEventListener("click",e=>copyText(output.textContent.replaceAll(" · ","\n"),e.currentTarget));
  $("#resetWordDeck").addEventListener("click",()=>{decks.delete(key());generate()});
  $("#wordCategory").addEventListener("change",generate);
  $("#wordLength").addEventListener("change",generate);
  $("#wordStartsWith").addEventListener("input",generate);
  generate();
}

function initGroups() {
  let latest=[];
  const build=()=>{
    const items=parseItems($("#groupItems").value),maxSize=Math.max(1,Math.trunc(Number($("#groupSize").value))||2),container=$("#groupsResult");
    if(items.length<2){container.innerHTML="<div class='team'><h3>Add at least two items</h3></div>";latest=[];return}
    const groupCount=Math.ceil(items.length/maxSize),shuffled=shuffle(items);
    latest=Array.from({length:groupCount},()=>[]);
    shuffled.forEach((item,index)=>latest[index%groupCount].push(item));
    renderGroups(container,latest,"Group");
    $("#groupSummary").textContent=`${items.length} items · ${latest.length} groups · sizes ${latest.map(g=>g.length).join(" / ")}`;
    $("#reshuffleGroups").disabled=false;$("#copyGroups").disabled=false;
  };
  $("#makeGroups").addEventListener("click",build);
  $("#reshuffleGroups").addEventListener("click",build);
  $("#copyGroups").addEventListener("click",e=>latest.length&&copyText(groupsToText(latest,"Group"),e.currentTarget));
}

function initYesNo() {
  const output=$("#yesNoResult"),historyEl=$("#yesNoHistory"),label=$("#yesNoLabel"),coin=$("#yesNoCoin"),answers=[];
  let flipping=false,lastAnswer="";
  const render=()=>{
    const yes=answers.filter(a=>a==="Yes").length;
    const no=answers.filter(a=>a==="No").length;
    const maybe=answers.filter(a=>a==="Maybe").length;
    const tally=$("#yesNoMaybe").checked?`Yes ${yes} / No ${no} / Maybe ${maybe}`:`Yes ${yes} / No ${no}`;
    historyEl.textContent=answers.length?`Recent: ${answers.slice(0,8).join(" · ")} · ${tally}`:"";
  };
  const beep=()=>{
    if(!$("#yesNoSound").checked)return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext,ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.frequency.value=lastAnswer==="Maybe"?420:540;gain.gain.value=.045;osc.connect(gain);gain.connect(ctx.destination);osc.start();
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.16);osc.stop(ctx.currentTime+.16);osc.onended=()=>ctx.close();
    }catch{}
  };
  const resetCoin=()=>{
    const faces=coin.querySelectorAll("span");
    if(faces[0])faces[0].textContent="YES";
    if(faces[1])faces[1].textContent="NO";
    coin.classList.remove("maybe-result");
  };
  $("#answerYesNo").addEventListener("click",()=>{
    if(flipping)return;
    flipping=true;$("#answerYesNo").disabled=true;resetCoin();
    const options=$("#yesNoMaybe").checked?["Yes","No","Maybe"]:["Yes","No"];
    const answer=sample(options),question=$("#yesNoQuestion").value.trim();
    coin.classList.remove("flip-yes","flip-no","flip-maybe");void coin.offsetWidth;
    coin.classList.add(answer==="Yes"?"flip-yes":answer==="No"?"flip-no":"flip-maybe");
    output.textContent="Deciding…";label.textContent=question||"Answer";
    setTimeout(()=>{
      lastAnswer=answer;
      if(answer==="Maybe"){coin.querySelectorAll("span").forEach(face=>face.textContent="MAYBE");coin.classList.add("maybe-result")}
      output.textContent=answer;answers.unshift(answer);answers.splice(20);render();beep();
      output.classList.remove("answer-pop");requestAnimationFrame(()=>output.classList.add("answer-pop"));
      $("#answerYesNo").textContent="Again";$("#answerYesNo").disabled=false;flipping=false;
    },760);
  });
  $("#copyYesNo").addEventListener("click",ev=>{
    const question=$("#yesNoQuestion").value.trim();
    copyText(question&&lastAnswer?`${question} — ${lastAnswer}`:(lastAnswer||output.textContent),ev.currentTarget);
  });
  $("#yesNoMaybe").addEventListener("change",render);
  $("#resetYesNo").addEventListener("click",()=>{
    answers.length=0;lastAnswer="";render();output.textContent="Ask, then tap";label.textContent="Answer";$("#answerYesNo").textContent="Flip for an answer";resetCoin();
  });
}

function addBottomToolTabs() {
  const topTabs = document.querySelector(".tool-tabs");
  const adSlot = document.querySelector(".ad-slot");
  if (!topTabs || !adSlot || document.querySelector(".more-tools")) return;

  const section = document.createElement("section");
  section.className = "more-tools";

  const label = document.createElement("div");
  label.className = "more-tools-label";
  label.textContent = "Try another random tool";

  const bottomTabs = topTabs.cloneNode(true);
  bottomTabs.classList.add("bottom-tabs");
  bottomTabs.setAttribute("aria-label", "More random tools");

  section.append(label, bottomTabs);
  adSlot.insertAdjacentElement("afterend", section);
}

addBottomToolTabs();

const tool = document.body.dataset.tool;
if (tool === "color") initColor();
if (tool === "choice") initChoice();
if (tool === "wheel") initWheel();
if (tool === "teams") initTeams();
if (tool === "pictionary") initPictionary();
if (tool === "number") initNumber();
if (tool === "name") initName();
if (tool === "word") initWord();
if (tool === "groups") initGroups();
if (tool === "yesno") initYesNo();


function addSiteTrustLinks() {
  const footer = document.querySelector(".footer");
  if (!footer || footer.querySelector(".footer-trust-links")) return;
  const nav = document.createElement("nav");
  nav.className = "footer-trust-links";
  nav.setAttribute("aria-label", "Site information");
  nav.innerHTML = '<a href="https://everytinytool.com/">Every Tiny Tool</a><a href="https://everytinytool.com/about/">About</a><a href="https://everytinytool.com/privacy/">Privacy</a><a href="https://everytinytool.com/contact/">Contact</a>';
  footer.appendChild(nav);
}
addSiteTrustLinks();
