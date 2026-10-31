import { SHARKS, CATALOGUE_ORDER } from './sharks.js';
import { QUESTIONS, scoreAnswers } from './questions.js';
import { ZONES } from './zones.js';
import { mountBubble } from './bubble.js';
import { mountCursor } from './cursor.js';
import { mountSound, playSound } from './sound.js';
import { mountOcean } from './ocean.js';
import { CARD_CUSTOMIZER_DATA } from './card-customizer-data.js';

const app=document.querySelector('#app'), dialog=document.querySelector('#shark-dialog');
const state={page:'home',index:0,answers:[],order:[],result:null,name:sessionStorage.getItem('sharkName')||'',completed:false,completionId:null,hover:null};
state.customization={theme:'navy',border:'star',stickers:[],activeTab:'color',selectedSticker:null};
let revealTimeout=null;
let cardPreviewRevision=0;

mountBubble(document.querySelector('#site-bubble'),{size:69,src:'assets/bubble.png',muted:true,ariaLabel:'Go to home page',onBurst:()=>setPage('home')});
mountCursor();
mountSound();
mountOcean();

const escape=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setPage(page){
 if(revealTimeout&&page!=='scanning'){clearTimeout(revealTimeout);revealTimeout=null;}
 state.page=page; history.replaceState(null,'',`#${page}`); render();
}
function frame(inner,cls=''){return `<section class="panel ${cls}"><div class="panel__inner">${inner}</div></section>`;}

function nav(){
 document.querySelectorAll('.nav__link').forEach(a=>{
  a.classList.toggle('is-active',a.dataset.page===state.page);
  if(a.dataset.page===state.page)a.setAttribute('aria-current','page');
  else a.removeAttribute('aria-current');
 });
}

function render(){
 nav();
 if(['what','why','who','where'].includes(state.page)) return renderInfo(state.page);
 if(state.page==='scanning')return renderScanning();
 if(state.page==='card')return renderCard();
 if(state.page==='result')return renderResult();
 if(state.page==='quiz')return renderQuiz();
 return renderHome();
}

function renderHome(){
 app.innerHTML=frame(`<h1 class="home-title">WHATSHARKAMI.ORG</h1><p class="home-lead">answer some questions and find a shark that matches you!</p><div class="home-row"><form class="home-copy" id="start-form"><label class="home-prompt" for="start-name">enter your name to get started!</label><div class="name-form"><input id="start-name" maxlength="24" autocomplete="given-name" placeholder="your name" value="${escape(state.name)}"/></div></form><img class="mascot" src="assets/mascot.png" alt="Pixel shark mascot"/></div>`);

 const input=app.querySelector('#start-name');

 input.addEventListener('input',()=>{
  state.name=input.value.slice(0,24);
  sessionStorage.setItem('sharkName',state.name);
 });

 app.querySelector('#start-form').addEventListener('submit',e=>{
  e.preventDefault();
  state.name=input.value.trim().slice(0,24);
  sessionStorage.setItem('sharkName',state.name);
  state.index=0;
  state.answers=[];
  state.order=[];
  state.completed=false;
  state.completionId=newQuizId();
  setPage('quiz');
 });
}

function shuffle(){
 const values=[0,1,2,3];
 for(let i=values.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [values[i],values[j]]=[values[j],values[i]];
 }
 return values;
}

function renderQuiz(){
 const q=QUESTIONS[state.index];

 if(!q){
  return beginReveal();
 }

 if(!state.order.length)state.order=shuffle();

 app.innerHTML=frame(`<h1 class="quiz-head">MAKE YOUR CHOICES</h1><div class="progress"><span>QUESTION ${state.index+1} OF 10</span><div class="segments" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${state.index+1}" aria-label="Question ${state.index+1} of 10">${QUESTIONS.map((_,i)=>`<i class="${i<=state.index?'is-on':''}"></i>`).join('')}</div></div><h2 class="question" id="question-text">${escape(q.text)}</h2><div class="answers" role="group" aria-labelledby="question-text">${state.order.map((n,i)=>`<button class="answer" data-answer="${n}"><b>${'ABCD'[i]}</b><span>${escape(q.answers[n].text)}</span></button>`).join('')}</div><div class="quiz-controls"><button class="text-button" data-action="back">← BACK</button><button class="text-button" data-action="restart">START OVER</button></div>`,'panel--quiz');

 app.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
  state.answers[state.index]=Number(b.dataset.answer);
  state.index++;
  state.order=[];
  render();
 });

 const back=app.querySelector('[data-action="back"]');
 if(back)back.onclick=()=>{
  if(state.index){
   state.index--;
   state.order=[];
   render();
  }else setPage('home');
 };

 app.querySelector('[data-action="restart"]').onclick=()=>restart();
}

function beginReveal(){
 state.result=scoreAnswers(state.answers);
 state.page='scanning';
 countCompletion();
 renderScanning();
 const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?250:2100;
 revealTimeout=window.setTimeout(()=>{
  revealTimeout=null;
  if(state.page==='scanning')setPage('result');
 },duration);
}

async function renderScanning(){
 app.innerHTML=frame(`<div class="scan-screen" role="status" aria-label="Preparing your Shark ID"><div class="scan-card" aria-hidden="true"><div class="scan-card-preview"></div><div class="scan-beam"></div></div><div class="scan-progress" aria-hidden="true"><i></i></div></div>`,'panel--scanning');
 const slot=app.querySelector('.scan-card-preview');
 try{
  const card=await createSharkCardCanvas({template:true});
  if(!slot?.isConnected||state.page!=='scanning')return;
  card.className='scan-card-image';
  slot.replaceChildren(card);
 }catch(error){console.error('Could not render the Shark ID scan preview.',error);}
}

function restart(){
 if(revealTimeout){clearTimeout(revealTimeout);revealTimeout=null;}
 state.index=0;
 state.answers=[];
 state.order=[];
 state.result=null;
 state.completed=false;
 state.completionId=newQuizId();
 state.page='quiz';
 render();
}

async function counterRpc(name,params={}){
 const cfg=window.SHARK_COUNTER;
 if(!cfg?.url||!cfg?.anonKey)return null;

 const response=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{
  method:'POST',
  headers:{
   apikey:cfg.anonKey,
   Authorization:`Bearer ${cfg.anonKey}`,
   'Content-Type':'application/json'
  },
  body:JSON.stringify(params)
 });

 if(!response.ok)throw new Error('Counter unavailable');

 const value=await response.json();
 return Number(value);
}

function newQuizId(){
 return crypto.randomUUID?.()||
 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
  const r=Math.random()*16|0;
  return (c==='x'?r:(r&0x3|0x8)).toString(16);
 });
}


async function countCompletion(){
 console.log('[COUNTER] Function called');
 console.log('[COUNTER] Current state:', {
  completed: state.completed,
  page: state.page,
  index: state.index,
  completionId: state.completionId
 });

 if(state.completed){
  console.log('[COUNTER] Already completed. Skipping.');
  return;
 }

 state.completed=true;

 const id=state.completionId||newQuizId();
 state.completionId=id;

 console.log('[COUNTER] Sending request:', id);
 console.log('[COUNTER] Config:', window.SHARK_COUNTER);

 try{
  const count=await counterRpc('complete_quiz',{
   p_session_id:id
  });

  console.log('[COUNTER] Supabase response:', count);

  if(Number.isFinite(count)){
   localStorage.setItem('sharksMatched',String(count));
  }
 }catch(error){
  console.error('[COUNTER] Request failed:',error);
 }
}


function renderResult(){
 playSound('fanfare');
 const primary=SHARKS[state.result?.primary||'thresher'];
 const secondary=SHARKS[state.result?.secondary||'hammerhead'];

 app.innerHTML=frame(`<h1 class="page-title">YOUR SHARK IS...</h1><div class="accent" aria-hidden="true"><i></i><i></i><i></i></div><p class="page-body result-subtitle">You’re a <strong>${escape(primary.name.replace(' Shark',''))}</strong> with <strong>${escape(secondary.name.replace(' Shark',''))}</strong> energy!</p><div class="result-layout"><div class="result-preview result-preview--stamp" style="--shark-color:${ZONES[primary.id].color}"><img src="${primary.image}" alt="Illustration of a ${primary.name}"/><span>YOUR SHARK</span><b>${escape(primary.title)}</b><small>SECONDARY SHARK · ${escape(secondary.name)}</small></div><div class="name-panel"><label for="visitor-name">WHAT SHOULD YOUR SHARK ID SAY?</label><input id="visitor-name" maxlength="24" autocomplete="given-name" placeholder="Your name" value="${escape(state.name)}"/><button class="pixel-button" data-action="make-card">GET MY SHARK ID</button><p class="secondary-line">Secondary shark: <b>${escape(secondary.title)}</b></p><button class="text-button" data-action="retake">↻ TAKE THE QUIZ AGAIN</button></div></div>`,'panel--result');

 app.querySelector('#visitor-name').oninput=e=>{
  state.name=e.target.value.slice(0,24);
  sessionStorage.setItem('sharkName',state.name);
 };

 app.querySelector('[data-action="make-card"]').onclick=()=>{
  state.name=app.querySelector('#visitor-name').value.trim().slice(0,24)||'SHARK FAN';
  sessionStorage.setItem('sharkName',state.name);
  setPage('card');
 };

 app.querySelector('[data-action="retake"]').onclick=restart;
}

async function renderCard(){
 const s=SHARKS[state.result.primary];
 if(!state.name){state.name='SHARK FAN';sessionStorage.setItem('sharkName',state.name);}
 app.innerHTML=frame(`<div class="card-customizer-layout"><div class="card-preview-column"><div class="card-id-stage"><div class="card-preview-wrap"><p class="card-preview-loading">PRINTING YOUR SHARK ID...</p></div></div><div class="card-actions" aria-label="Shark ID actions"><button class="card-pill-button" data-action="download" aria-label="Download Shark ID" title="Download Shark ID"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6v12h6L16 24 7 15h6zM5 25h22v4H5z"/></svg><span>download</span></button><button class="card-pill-button" data-action="share" aria-label="Share Shark ID" title="Share Shark ID"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 2h12v12h-5V9L14 20l-4-4L21 5h-3zM4 9h12v5H9v13h14v-7h5v12H4z"/></svg><span>share</span></button><button class="text-button card-retake" data-action="retake">↻ TAKE THE QUIZ AGAIN</button></div></div>${renderCustomizerPanel()}</div>`,'panel--id');

 app.querySelector('[data-action="download"]').onclick=downloadCard;
 app.querySelector('[data-action="share"]').onclick=shareCard;
 app.querySelector('[data-action="retake"]').onclick=restart;
 bindCustomizerControls();
 await refreshCardPreview(true);
}

function renderCustomizerPanel(){
 const theme=CARD_CUSTOMIZER_DATA.themes.find(item=>item.id===state.customization.theme)||CARD_CUSTOMIZER_DATA.themes[0];
 const tab=state.customization.activeTab;
 const tabButton=(id,label)=>`<button type="button" role="tab" id="custom-tab-${id}" aria-selected="${tab===id}" aria-controls="custom-panel-${id}" data-custom-tab="${id}">${label}</button>`;
 const panels={
  color:`<div class="customizer-swatches">${CARD_CUSTOMIZER_DATA.themes.map(item=>`<button type="button" class="theme-swatch ${theme.id===item.id?'is-selected':''}" data-theme="${item.id}" aria-label="${item.label} theme" aria-pressed="${theme.id===item.id}" style="--swatch:${item.border}"><span></span><b>${item.label}</b></button>`).join('')}</div>`,
  border:`<div class="customizer-shapes">${CARD_CUSTOMIZER_DATA.borders.map(item=>`<button type="button" class="shape-choice ${state.customization.border===item.id?'is-selected':''}" data-border="${item.id}" aria-label="Use ${item.label} border" aria-pressed="${state.customization.border===item.id}"><span class="shape-mask" data-asset="assets/borders/border-${item.id}.png" style="--mask-color:${theme.border}"><canvas width="40" height="40" aria-hidden="true"></canvas><span class="asset-placeholder">${item.label}</span></span><b>${item.label}</b></button>`).join('')}</div>`,
  stickers:`<div class="customizer-stickers">${CARD_CUSTOMIZER_DATA.stickers.map(item=>`<button type="button" class="sticker-choice" data-sticker="${item.id}" aria-label="Add ${item.label} sticker" ${state.customization.stickers.length>=6?'disabled':''}><span class="sticker-thumb" data-asset="assets/stickers/sticker-${item.id}.png" style="--sticker-color:${item.color}"><img src="assets/stickers/sticker-${item.id}.png" alt="" draggable="false"/><span class="asset-placeholder">${item.label}</span></span><b>${item.label}</b></button>`).join('')}</div><p class="sticker-limit" aria-live="polite">${state.customization.stickers.length} of 6 stickers</p>`,
 };
 return `<aside class="card-customizer" aria-label="Shark ID customization"><div class="customizer-heading"><button type="button" class="customizer-reset" data-custom-reset aria-label="Reset card customizations">Reset</button></div><div class="customizer-tabs" role="tablist" aria-label="Card customization options">${tabButton('color','Color')}${tabButton('border','Border shape')}${tabButton('stickers','Stickers')}</div><section class="customizer-panel" id="custom-panel-${tab}" role="tabpanel" aria-labelledby="custom-tab-${tab}">${panels[tab]||panels.color}</section></aside>`;
}

function bindCustomizerControls(){
 app.querySelectorAll('[data-custom-tab]').forEach(button=>button.onclick=()=>{
  state.customization.activeTab=button.dataset.customTab;renderCustomizer();
 });
 app.querySelectorAll('[data-custom-tab]').forEach(button=>button.onkeydown=e=>{
  const tabs=[...app.querySelectorAll('[data-custom-tab]')],index=tabs.indexOf(button);
  const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
  if(next>=0){e.preventDefault();tabs[next].click();app.querySelector(`[data-custom-tab="${tabs[next].dataset.customTab}"]`)?.focus();}
 });
 app.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{
  state.customization.theme=button.dataset.theme;renderCustomizer();refreshCardPreview();
 });
 app.querySelectorAll('[data-border]').forEach(button=>button.onclick=()=>{
  state.customization.border=button.dataset.border;renderCustomizer();refreshCardPreview();
 });
 app.querySelectorAll('[data-sticker]').forEach(button=>button.onclick=()=>addSticker(button.dataset.sticker));
 app.querySelector('[data-custom-reset]').onclick=()=>{
  state.customization={theme:'navy',border:'star',stickers:[],activeTab:'color',selectedSticker:null};
  renderCustomizer();refreshCardPreview();
 };
 app.querySelectorAll('.shape-mask').forEach(thumb=>{
  const canvas=thumb.querySelector('canvas');
  loadImageAsset(thumb.dataset.asset).then(image=>{
   if(!thumb.isConnected)return;
   if(!image){thumb.classList.add('is-missing');return;}
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,40,40);ctx.drawImage(image,0,0,40,40);
   ctx.globalCompositeOperation='source-in';ctx.fillStyle=getComputedStyle(thumb).getPropertyValue('--mask-color').trim();ctx.fillRect(0,0,40,40);
  });
 });
 app.querySelectorAll('.sticker-thumb').forEach(thumb=>{
  const img=thumb.querySelector('img');
  img.addEventListener('error',()=>thumb.classList.add('is-missing'),{once:true});
 });
}

function renderCustomizer(){
 const old=app.querySelector('.card-customizer');if(!old)return;
 old.outerHTML=renderCustomizerPanel();bindCustomizerControls();
}

function addSticker(kind){
 if(state.customization.stickers.length>=6)return;
 const index=state.customization.stickers.length;
 const size=48;
 const item={id:`sticker-${Date.now()}-${index}`,kind,x:snapCardValue(150+index*66),y:snapCardValue(165+index*48),size};
 state.customization.stickers.push(item);state.customization.selectedSticker=item.id;
 renderStickerLayer();renderCustomizer();refreshCardPreview();
}

function snapCardValue(value){return Math.round(value/6)*6;}
function clampStickerSize(value){return [48,72,96,120,144].reduce((best,size)=>Math.abs(size-value)<Math.abs(best-value)?size:best,48);}
function selectedSticker(){return state.customization.stickers.find(item=>item.id===state.customization.selectedSticker);}
function updateSticker(item,changes={}){
 const focus=describeStickerFocus();
 Object.assign(item,changes);
 item.size=clampStickerSize(item.size);
 item.x=Math.max(90,Math.min(snapCardValue(1110-item.size),snapCardValue(item.x)));
 item.y=Math.max(90,Math.min(snapCardValue(740-item.size),snapCardValue(item.y)));
 renderStickerLayer();renderCustomizer();refreshCardPreview();
 restoreStickerFocus(focus,item.id);
}
function describeStickerFocus(){
 const active=document.activeElement;
 if(active?.dataset?.stickerMove)return{type:'move',value:active.dataset.stickerMove};
 if(active?.dataset?.stickerSize)return{type:'size',value:active.dataset.stickerSize};
 if(active?.dataset?.placement)return{type:'placement',value:active.dataset.placement};
 return null;
}
function restoreStickerFocus(focus,id){
 if(!focus)return;
 requestAnimationFrame(()=>{
  const selector=focus.type==='move'?`[data-sticker-move="${focus.value}"]`:focus.type==='size'?`[data-sticker-size="${focus.value}"]`:`[data-placement="${id}"]`;
  app.querySelector(selector)?.focus();
 });
}
function moveSelectedSticker(direction){
 const item=selectedSticker();if(!item)return;
 const delta={left:[-6,0],right:[6,0],up:[0,-6],down:[0,6]}[direction];
 updateSticker(item,{x:item.x+delta[0],y:item.y+delta[1]});
}
function resizeSelectedSticker(delta){const item=selectedSticker();if(item)updateSticker(item,{size:item.size+delta});}
function deleteSelectedSticker(){
 const item=selectedSticker();if(!item)return;
 state.customization.stickers=state.customization.stickers.filter(sticker=>sticker!==item);state.customization.selectedSticker=null;
 renderStickerLayer();renderCustomizer();refreshCardPreview();
}

async function refreshCardPreview(animate=false){
 const slot=app.querySelector('.card-preview-wrap');if(!slot)return;
 const revision=++cardPreviewRevision;
 const image=await createSharkCardCanvas();
 if(!slot.isConnected||revision!==cardPreviewRevision)return;
 image.className=`card-preview-img${animate?'':' card-preview-img--live'}`;image.setAttribute('role','img');
 image.setAttribute('aria-label',`Shark ID for ${state.name}, matched with ${SHARKS[state.result.primary].name}`);
 slot.replaceChildren(image,document.createElement('div'));
 const layer=slot.lastElementChild;layer.className='card-sticker-layer';
 renderStickerLayer();
}

function renderStickerLayer(){
 const layer=app.querySelector('.card-sticker-layer');if(!layer)return;
 layer.innerHTML=state.customization.stickers.map(item=>{
  const sticker=CARD_CUSTOMIZER_DATA.stickers.find(entry=>entry.id===item.kind)||{label:item.kind,color:'#CFC2F7'};
  const selected=state.customization.selectedSticker===item.id;
  return `<div class="placed-sticker-group" data-sticker-group="${item.id}" style="left:${item.x/12}%;top:${item.y/7.7}%;width:${item.size/12}%;height:${item.size/7.7}%"><button type="button" class="placed-sticker ${selected?'is-selected':''}" data-placement="${item.id}" aria-label="${sticker.label} sticker. Drag to move. Arrow keys move, plus and minus resize, Delete removes." style="--sticker-color:${sticker.color}"><img src="assets/stickers/sticker-${item.kind}.png" alt="" draggable="false"/><span class="asset-placeholder">${sticker.label}</span></button>${selected?`<button type="button" class="sticker-handle sticker-delete-handle" data-sticker-remove="${item.id}" aria-label="Remove ${sticker.label} sticker">×</button><button type="button" class="sticker-handle sticker-resize-handle" data-sticker-resize="${item.id}" aria-label="Resize ${sticker.label} sticker">↘</button>`:''}</div>`;
 }).join('');
 layer.querySelectorAll('.placed-sticker').forEach(button=>{
  button.addEventListener('error',()=>button.classList.add('is-missing'));
  const img=button.querySelector('img');img.addEventListener('error',()=>button.classList.add('is-missing'),{once:true});
  button.onclick=()=>{state.customization.selectedSticker=button.dataset.placement;renderStickerLayer();renderCustomizer();app.querySelector(`[data-placement="${button.dataset.placement}"]`)?.focus();};
  button.onkeydown=e=>{
   const item=state.customization.stickers.find(sticker=>sticker.id===button.dataset.placement);if(!item)return;
   const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];
   if(direction){e.preventDefault();state.customization.selectedSticker=item.id;moveSelectedSticker(direction);}
   else if(e.key==='+'||e.key==='='){e.preventDefault();state.customization.selectedSticker=item.id;resizeSelectedSticker(24);}
   else if(e.key==='-'||e.key==='_'){e.preventDefault();state.customization.selectedSticker=item.id;resizeSelectedSticker(-24);}
   else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();state.customization.selectedSticker=item.id;deleteSelectedSticker();}
  };
  button.onpointerdown=e=>{
   if(e.button!==0)return;
   const item=state.customization.stickers.find(sticker=>sticker.id===button.dataset.placement);if(!item)return;
   state.customization.selectedSticker=item.id;button.setPointerCapture(e.pointerId);
   const origin={x:e.clientX,y:e.clientY,stickerX:item.x,stickerY:item.y};
   button.onpointermove=move=>{
    if(!button.hasPointerCapture(move.pointerId))return;
    const bounds=layer.getBoundingClientRect();
    item.x=snapCardValue(origin.stickerX+(move.clientX-origin.x)*1200/bounds.width);
    item.y=snapCardValue(origin.stickerY+(move.clientY-origin.y)*770/bounds.height);
    item.x=Math.max(90,Math.min(snapCardValue(1110-item.size),snapCardValue(item.x)));item.y=Math.max(90,Math.min(snapCardValue(740-item.size),snapCardValue(item.y)));
    button.parentElement.style.left=`${item.x/12}%`;button.parentElement.style.top=`${item.y/7.7}%`;
   };
   button.classList.add('is-selected');app.querySelectorAll('.placed-sticker').forEach(sticker=>{if(sticker!==button)sticker.classList.remove('is-selected');});renderCustomizer();
   button.onpointerup=button.onpointercancel=()=>{if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);button.onpointermove=null;renderStickerLayer();renderCustomizer();refreshCardPreview();};
   e.preventDefault();
  };
 });
 layer.querySelectorAll('[data-sticker-resize]').forEach(button=>button.onclick=()=>{
  const item=state.customization.stickers.find(sticker=>sticker.id===button.dataset.stickerResize);if(item){state.customization.selectedSticker=item.id;resizeSelectedSticker(24);}
 });
 layer.querySelectorAll('[data-sticker-remove]').forEach(button=>button.onclick=()=>{
  const item=state.customization.stickers.find(sticker=>sticker.id===button.dataset.stickerRemove);if(item){state.customization.selectedSticker=item.id;deleteSelectedSticker();}
 });
}

async function createSharkCardCanvas({template=false}={}){
 await document.fonts.ready;
 const canvas=document.createElement('canvas');
 canvas.width=1200;
 canvas.height=770;
 const ctx=canvas.getContext('2d');
 ctx.imageSmoothingEnabled=false;
 const s=SHARKS[state.result.primary];
 const theme=CARD_CUSTOMIZER_DATA.themes.find(item=>item.id===state.customization.theme)||CARD_CUSTOMIZER_DATA.themes[0];
 const navy=theme.text,border=theme.border,cream='#fbf9ff',blue=theme.tint;
 const card={x:70,y:70,w:1060,h:680},footerY=650;
 // Leave the canvas outside the card fully transparent.
 ctx.fillStyle='rgba(19,55,94,.18)';steppedRect(ctx,card.x,card.y+12,card.w,card.h,24);ctx.fill();
 ctx.strokeStyle=border;ctx.lineWidth=20;steppedRect(ctx,card.x+10,card.y+10,card.w-20,card.h-20,22);ctx.stroke();
 ctx.fillStyle=cream;steppedRect(ctx,card.x+18,card.y+18,card.w-36,card.h-36,18);ctx.fill();
 ctx.strokeStyle=border;ctx.lineWidth=4;steppedRect(ctx,card.x+21,card.y+21,card.w-42,card.h-42,16);ctx.stroke();

 // Header and membership copy.
 ctx.fillStyle=navy;ctx.beginPath();ctx.arc(600,114,12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=blue;ctx.beginPath();ctx.arc(600,114,8,0,Math.PI*2);ctx.fill();
 const borderChoice=CARD_CUSTOMIZER_DATA.borders.find(item=>item.id===state.customization.border)||CARD_CUSTOMIZER_DATA.borders[0];
 const borderImage=await loadImageAsset(`assets/borders/border-${borderChoice.id}.png`);
 // Keep the reference card's original decoration: two corner marks and one
 // short row of small marks between the certificate copy and member fields.
 drawBorderDecoration(ctx,borderImage,130,150,44,borderChoice.label,border);
 drawBorderDecoration(ctx,borderImage,1070,150,44,borderChoice.label,border);
 // Keep the entire heading inside the left column so it never collides with the portrait.
 const headingX=415;
 ctx.textAlign='center';ctx.fillStyle=navy;
 ctx.font='600 40px Pixelify Sans';ctx.fillText('SHARK CLUB CARD',headingX,198);
 ctx.font='19px Pixelify Sans';ctx.fillText('SPECIAL IDENTITY CARD',headingX,234);
 ctx.font='12px Pixelify Sans';ctx.fillText('as an authorized member of',headingX,254);
 ctx.font='600 25px Pixelify Sans';ctx.fillText('The Shark Keeper Club',headingX,287);
 ctx.font='11px Pixelify Sans';
 ctx.fillText('THIS CARD CERTIFIES THAT THIS PERSON IS A PERMANENT MEMBER OF',headingX,313);
 ctx.fillText('THE SHARK CLUB AND MUST CARRY THEIR SHARK TO PROVE IT.',headingX,330);

 for(let x=132;x<690;x+=38)drawBorderDecoration(ctx,borderImage,x,366,16,borderChoice.label,border);

 // Name, match, and traits.
 ctx.textAlign='left';ctx.fillStyle=navy;ctx.font='15px Pixelify Sans';
 ctx.fillText('NAME',132,401);ctx.fillText('YOUR SHARK',424,401);
 drawCardField(ctx,132,412,275,46,border,cream);drawCardField(ctx,424,412,275,46,border,cream);
 ctx.font='20px Pixelify Sans';
 if(template){ctx.fillStyle='#8796ab';ctx.fillText('Type name here',147,442);}
 else fitText(ctx,state.name,147,442,245);
 if(!template)fitText(ctx,s.name,439,442,245);
 ctx.fillStyle=navy;ctx.font='15px Pixelify Sans';ctx.fillText('PERSONALITY TRAITS',132,487);
 const traitColors=['#bdf0cf','#f7c6dc','#cfc2f7'];
 s.traits.forEach((trait,i)=>{
  const x=132+i*190;
  ctx.fillStyle=traitColors[i%traitColors.length];ctx.fillRect(x,500,176,42);
  ctx.strokeStyle=border;ctx.lineWidth=3;ctx.strokeRect(x,500,176,42);
  if(!template){ctx.textAlign='center';ctx.font='19px Pixelify Sans';ctx.fillStyle=navy;fitText(ctx,trait,x+88,527,160);}
 });

 ctx.textAlign='left';ctx.fillStyle=navy;ctx.font='15px Pixelify Sans';ctx.fillText('ABOUT THE SHARK',132,575);
 drawCardField(ctx,132,585,567,60,border,cream);
 if(!template){ctx.font='14px Pixelify Sans';wrapText(ctx,s.about,146,608,540,17,2);}

 // Portrait and barcode.
 const portrait={x:745,y:218,w:300,h:300};
 ctx.fillStyle=cream;ctx.fillRect(portrait.x,portrait.y,portrait.w,portrait.h);
 ctx.strokeStyle=border;ctx.lineWidth=5;ctx.strokeRect(portrait.x,portrait.y,portrait.w,portrait.h);
 ctx.clearRect(portrait.x+10,portrait.y+10,portrait.w-20,portrait.h-20);
 ctx.fillStyle=blue;ctx.fillRect(portrait.x+10,portrait.y+10,portrait.w-20,portrait.h-20);
 if(!template){
  try{
   const img=new Image();
   img.src=s.image;
   await img.decode();
   const inset=20,scale=Math.min((portrait.w-inset*2)/img.width,(portrait.h-inset*2)/img.height);
   const w=img.width*scale,h=img.height*scale;
   ctx.drawImage(img,portrait.x+(portrait.w-w)/2,portrait.y+(portrait.h-h)/2,w,h);
  }catch{}
 }
 ctx.textAlign='left';ctx.fillStyle=navy;ctx.font='12px Pixelify Sans';
 ctx.fillText(template?'MEMBER ID NO. 00000-014':`MEMBER ID NO. ${s.id.toUpperCase()}-${String(state.name.length+14).padStart(3,'0')}`,745,544);
 drawBarcode(ctx,745,554,300,42,template?'00000-014':`${state.name}-${s.id}`,navy);

 ctx.save();steppedRect(ctx,card.x+22,card.y+22,card.w-44,card.h-44,16);ctx.clip();
 ctx.fillStyle=border;ctx.fillRect(card.x,footerY,card.w,card.y+card.h-footerY);ctx.restore();
 ctx.textAlign='left';ctx.fillStyle=cream;ctx.font='600 25px Pixelify Sans';ctx.fillText('a life time expiry',112,690);
 ctx.font='16px Pixelify Sans';ctx.fillText('must be shared with all our friends',112,713);
 ctx.beginPath();ctx.fillStyle=theme.tint;ctx.arc(670,690,33,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=cream;ctx.lineWidth=2;ctx.stroke();
 ctx.textAlign='center';ctx.fillStyle=navy;ctx.font='12px Pixelify Sans';ctx.fillText('ONE OF 14',670,694);
 ctx.fillStyle=cream;ctx.fillRect(745,668,300,44);ctx.fillStyle=navy;
 ctx.font='15px Pixelify Sans';ctx.fillText('ALL YOU NEED IS A SHARK',895,696);ctx.textAlign='left';

 if(!template){
  for(const item of state.customization.stickers){
   const sticker=CARD_CUSTOMIZER_DATA.stickers.find(entry=>entry.id===item.kind)||{label:item.kind,color:'#CFC2F7'};
   const image=await loadImageAsset(`assets/stickers/sticker-${item.kind}.png`);
   if(image){ctx.drawImage(image,item.x,item.y,item.size,item.size);}
   else drawStickerPlaceholder(ctx,item,sticker,navy);
  }
 }

 return canvas;
}

async function downloadCard(){
 const canvas=await createSharkCardCanvas();
 canvas.toBlob(blob=>{
  if(!blob)return;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='my-shark-id.png';
  a.click();
  window.setTimeout(()=>URL.revokeObjectURL(a.href),1500);
 });
}

function drawCardField(ctx,x,y,width,height,border,fill){
 ctx.save();
 ctx.fillStyle=fill;
 ctx.fillRect(x,y,width,height);
 ctx.strokeStyle=border;
 ctx.lineWidth=3;
 ctx.strokeRect(x,y,width,height);
 ctx.restore();
}

const imageAssetCache=new Map();
function loadImageAsset(src){
 if(imageAssetCache.has(src))return imageAssetCache.get(src);
 const pending=new Promise(resolve=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src;
 });
 imageAssetCache.set(src,pending);return pending;
}

function drawBorderDecoration(ctx,image,x,y,size,label,color){
 if(image){
  const mask=document.createElement('canvas');mask.width=mask.height=size;
  const maskCtx=mask.getContext('2d');maskCtx.imageSmoothingEnabled=false;
  maskCtx.drawImage(image,0,0,size,size);maskCtx.globalCompositeOperation='source-in';maskCtx.fillStyle=color;maskCtx.fillRect(0,0,size,size);
  ctx.drawImage(mask,x-size/2,y-size/2,size,size);return;
 }
 const glyph={star:'★',heart:'♥',bubble:'◉',fish:'◆',shell:'◖',wave:'≈',sparkle:'✦',button:'◎'}[label.toLowerCase()]||'◆';
 ctx.save();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(10,size*.82)}px Pixelify Sans`;ctx.fillText(glyph,x,y);ctx.restore();
}

function drawStickerPlaceholder(ctx,item,definition,borderColor){
 ctx.save();ctx.fillStyle=definition.color;ctx.fillRect(item.x,item.y,item.size,item.size);
 ctx.strokeStyle=borderColor;ctx.lineWidth=3;ctx.strokeRect(item.x+1.5,item.y+1.5,item.size-3,item.size-3);
 ctx.fillStyle=borderColor;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(9,Math.min(15,item.size/4))}px Pixelify Sans`;
 ctx.fillText(definition.label.toUpperCase().slice(0,8),item.x+item.size/2,item.y+item.size/2,item.size-6);ctx.restore();
}

function steppedRect(ctx,x,y,width,height,step=16){
 ctx.beginPath();
 ctx.moveTo(x+step,y);ctx.lineTo(x+width-step,y);ctx.lineTo(x+width-step,y+step/2);ctx.lineTo(x+width-step/2,y+step/2);ctx.lineTo(x+width-step/2,y+step);ctx.lineTo(x+width,y+step);
 ctx.lineTo(x+width,y+height-step);ctx.lineTo(x+width-step/2,y+height-step);ctx.lineTo(x+width-step/2,y+height-step/2);ctx.lineTo(x+width-step,y+height-step/2);ctx.lineTo(x+width-step,y+height);
 ctx.lineTo(x+step,y+height);ctx.lineTo(x+step,y+height-step/2);ctx.lineTo(x+step/2,y+height-step/2);ctx.lineTo(x+step/2,y+height-step);ctx.lineTo(x,y+height-step);
 ctx.lineTo(x,y+step);ctx.lineTo(x+step/2,y+step);ctx.lineTo(x+step/2,y+step/2);ctx.lineTo(x+step,y+step/2);ctx.closePath();
}

function fitText(ctx,text,x,y,maxWidth,fontSize=18){
 let size=fontSize;
 while(size>11){ctx.font=`${size}px Pixelify Sans`;if(ctx.measureText(text).width<=maxWidth)break;size-=1;}
 ctx.fillText(text,x,y);
}

function drawBarcode(ctx,x,y,width,height,seed,color='#173d68'){
 let offset=0;ctx.fillStyle=color;
 for(let i=0;i<seed.length*5&&offset<width;i++){
  const code=seed.charCodeAt(i%seed.length),bar=(code>>(i%7))&1,barWidth=(i%4===0)?3:2;
  if(bar)ctx.fillRect(x+offset,y,barWidth,height);
  offset+=barWidth+2;
 }
}

function drawStar(ctx,x,y,r,color='#13375e'){
 ctx.save();
 ctx.translate(x,y);
 ctx.beginPath();
 ctx.fillStyle=color;
 for(let i=0;i<10;i++){
  const a=-Math.PI/2+i*Math.PI/5;
  const rad=i%2?r*.45:r;
  ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
 }
 ctx.closePath();
 ctx.fill();
 ctx.restore();
}

function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=Infinity){
 let line='';
 let lines=0;
 for(const word of text.split(' ')){
  const test=line+word+' ';
  if(ctx.measureText(test).width>maxWidth&&line){
   if(lines>=maxLines-1){ctx.fillText(`${line.trimEnd()}…`,x,y);return;}
   ctx.fillText(line,x,y);
   line=word+' ';
   y+=lineHeight;
   lines++;
  }else line=test;
 }
 ctx.fillText(line,x,y);
}

async function shareCard(){
 const url=new URL(location.href);
 url.hash='card';
 url.searchParams.set('shark',state.result.primary);
 url.searchParams.set('name',state.name);
 url.searchParams.set('theme',state.customization.theme);
 url.searchParams.set('border',state.customization.border);
 url.searchParams.set('stickers',btoa(JSON.stringify(state.customization.stickers.map(({kind,x,y,size})=>({kind,x,y,size})))));
 const data={
  title:'My Shark ID',
  text:`I’m ${SHARKS[state.result.primary].title}! Find your shark:`,
  url:url.toString()
 };

 if(navigator.share){
  try{
   await navigator.share(data);
   return;
  }catch{}
 }

 try{
  await navigator.clipboard.writeText(data.url);
  alert('Quiz link copied!');
 }catch{
  prompt('Copy this quiz link:',data.url);
 }
}

function applySharedCardFromUrl(){
 const params=new URLSearchParams(location.search),shark=params.get('shark');
 if(!shark||!SHARKS[shark])return false;
 const theme=params.get('theme'),border=params.get('border');
 if(CARD_CUSTOMIZER_DATA.themes.some(item=>item.id===theme))state.customization.theme=theme;
 if(CARD_CUSTOMIZER_DATA.borders.some(item=>item.id===border))state.customization.border=border;
 state.name=(params.get('name')||'SHARK FAN').slice(0,24);
 state.result={primary:shark,secondary:shark};state.page='card';
 try{
  const incoming=JSON.parse(atob(params.get('stickers')||'[]'));
  if(Array.isArray(incoming))state.customization.stickers=incoming.slice(0,6).filter(item=>CARD_CUSTOMIZER_DATA.stickers.some(entry=>entry.id===item.kind)&&Number.isFinite(item.x)&&Number.isFinite(item.y)&&Number.isFinite(item.size)).map((item,index)=>{
   const size=clampStickerSize(item.size);
   return{id:`shared-${index}`,kind:item.kind,x:Math.max(90,Math.min(snapCardValue(1110-size),snapCardValue(item.x))),y:Math.max(90,Math.min(snapCardValue(740-size),snapCardValue(item.y))),size};
  });
 }catch{state.customization.stickers=[];}
 return true;
}

function renderInfo(page){
 if(page==='what')return renderWhat();
 if(page==='why')return renderWhy();
 if(page==='who')return renderWho();
 renderWhere();
}

function renderWhat(){
 const count=Number(localStorage.getItem('sharksMatched')||0);

 app.innerHTML=frame(`<h1 class="page-title">WHAT IS THIS?</h1><div class="accent" aria-hidden="true"><i></i><i></i><i></i></div><p class="page-body">This is a website where you answer some questions, and get a shark that matches your personality!<br/>You get a personalized shark ID that you can download and share with your friends :D</p><div class="steps"><div class="step"><div class="step__num">1</div><h3>ANSWER</h3><p>10 quick, fun questions</p></div><div class="step"><div class="step__num">2</div><h3>MEET</h3><p>the shark that is you</p></div><div class="step"><div class="step__num">3</div><h3>SHARE</h3><p>download your Shark ID</p></div></div><div class="counter"><div class="live"><i></i> LIVE</div><div class="counter__label">SHARKS MATCHED SO FAR</div><div class="digits" aria-live="polite">${String(count).replace(/\B(?=(\d{3})+(?!\d))/g,',').split('').map(d=>d===','?'<span>,</span>':`<b>${d}</b>`).join('')}</div></div>`);

 refreshCounter();
}

async function refreshCounter(){
 const digits=app.querySelector('.digits');
 if(!digits)return;

 let count=Number(localStorage.getItem('sharksMatched')||0);

 try{
  const remote=await counterRpc('get_count');
  if(Number.isFinite(remote)){
   count=remote;
   localStorage.setItem('sharksMatched',String(count));
  }
 }catch{}

 if(!digits.isConnected)return;

 const next=String(count).replace(/\B(?=(\d{3})+(?!\d))/g,',');
 if(digits.textContent!==next){
  digits.innerHTML=next.split('').map(d=>d===','?'<span>,</span>':`<b>${d}</b>`).join('');
 }
}

window.setInterval(()=>{
 if(state.page==='what'&&!document.hidden)refreshCounter();
},60000);

function renderWhy(){
 app.innerHTML=frame(`<h1 class="page-title">WHY IS THIS?</h1><div class="accent" aria-hidden="true"><i></i><i></i><i></i></div><div class="stats"><article class="stat"><span class="pill pill--pink">SHARKS KILLED</span><div class="stat__num">70 MILLION</div><p>by people each year (estimated)</p></article><div class="vs">VS</div><article class="stat"><span class="pill pill--mint">HUMANS ATTACKED</span><div class="stat__num">80</div><p>by sharks each year</p></article></div><div class="banners"><div class="banner banner--ladder">a ladder is more likely to kill you than a shark is.</div><div class="banner banner--dino">sharks have been here even before the dinosaurs, keeping the ecosystem in check.</div></div>`);
}

function renderWho(){
 app.innerHTML=frame(`<h1 class="page-title">WHO IS THIS?</h1><div class="accent" aria-hidden="true"><i></i><i></i><i></i></div><p class="subtitle">a catalogue for sharks. 14 of them, and one of them is you.</p><div class="catalogue">${CATALOGUE_ORDER.map(id=>{
  const s=SHARKS[id];
  return `<button class="tile ${state.result?.primary===id?'is-yours':''}" data-shark="${id}" aria-label="Learn about ${escape(s.name)}" style="--shark-color:${ZONES[id].color}"><span class="tile__art"><img src="${s.image}" alt=""/></span><span>${escape(s.name.replace(' Shark','').toUpperCase())}</span>${state.result?.primary===id?'<small>YOUR SHARK</small>':''}</button>`
 }).join('')}</div>`);

 app.querySelectorAll('[data-shark]').forEach(b=>b.onclick=()=>openShark(b.dataset.shark));
}

function openShark(id){
 const s=SHARKS[id];

 dialog.innerHTML=`<button class="dialog-close" aria-label="Close">×</button><img class="dialog-art" src="${s.image}" alt="${escape(s.name)}"/><h2 id="dialog-title">${escape(s.name)}</h2><h3>${escape(s.nickname)}</h3><div class="traits">${s.traits.map(t=>`<span class="trait">${escape(t)}</span>`).join('')}</div><p>${escape(s.about)}</p><p><b>FOUND IN</b><br/>${escape(s.found)}</p>`;

 dialog.showModal();
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
}

function renderWhere(){
 app.innerHTML=frame(`<h1 class="page-title">WHERE ARE THEY?</h1><p class="subtitle">hover over a glowing spot to meet the sharks that live there</p><div class="map-scroll"><div class="map-wrap" role="group" aria-label="Map showing where the 14 shark species are found"><img src="assets/map-land.svg" alt="Pixel map of the world"/>${CATALOGUE_ORDER.map(id=>{
  const s=SHARKS[id],z=ZONES[id];
  return `<button class="map-hotspot" data-shark="${id}" aria-label="${escape(s.name)}. ${escape(s.found)}" style="left:${z.x}%;top:${z.y}%;--spot:${z.color};--diameter:${z.radius*2}%"></button>`
 }).join('')}<aside class="map-card" aria-live="polite"></aside></div></div>`);

 const wrap=app.querySelector('.map-wrap');
 const card=app.querySelector('.map-card');

 const show=id=>{
  const s=SHARKS[id];
  card.style.setProperty('--spot',ZONES[id].color);
  card.innerHTML=`<img src="${s.image}" alt="Pixel art ${escape(s.name)}"/><div><h3>${escape(s.name)}</h3><p class="nick">${escape(s.nickname)}</p><p>${escape(s.found)}</p></div>`;
  wrap.classList.add('is-hovering');
 };

 app.querySelectorAll('[data-shark]').forEach(b=>{
  b.onpointerenter=()=>show(b.dataset.shark);
  b.onfocus=()=>show(b.dataset.shark);
  b.onclick=()=>show(b.dataset.shark);
 });

 wrap.onpointerleave=()=>wrap.classList.remove('is-hovering');
}

document.querySelectorAll('.nav__link').forEach(a=>a.addEventListener('click',e=>{
 e.preventDefault();
 setPage(a.dataset.page);
}));

window.addEventListener('hashchange',()=>{
 const p=location.hash.slice(1);
 if(['what','why','who','where','quiz','home'].includes(p))setPage(p);
});

document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&dialog.open)dialog.close();
 if(e.altKey&&e.key==='ArrowLeft'&&state.index>0){
  state.index--;
  state.order=[];
  renderQuiz();
 }
});

const hash=location.hash.slice(1);
if(!applySharedCardFromUrl()&&['what','why','who','where'].includes(hash))state.page=hash;
render();

/* Pixel-stepped corners: remember each box's original border paint and width
   (the CSS then redraws the border as a ring so the stepped corners stay continuous). */
const PX_BOXES = '.sound-toggle, .answer, .pixel-button, .field-box, .trait, .about-box, .id-photo, .tile__art';
function liftPixelBoxes() {
  document.querySelectorAll('.panel:not([data-ring]):not(.panel--id)').forEach((p) => {
    const cs = getComputedStyle(p);
    p.style.setProperty('--ring-image', cs.backgroundImage);
    p.style.setProperty('--ring-color', cs.backgroundColor);
    p.style.setProperty('--ring', cs.paddingTop);
    p.setAttribute('data-ring', '');
  });
  document.querySelectorAll(`${PX_BOXES}`).forEach((el) => {
    if (el.hasAttribute('data-px')) return;
    const cs = getComputedStyle(el);
    const bw = parseFloat(cs.borderTopWidth);
    if (!bw) return;
    el.style.setProperty('--bc', cs.borderTopColor);
    el.style.setProperty('--bw', `${bw}px`);
    el.setAttribute('data-px', '');
  });
}
new MutationObserver(liftPixelBoxes).observe(document.body, { childList: true, subtree: true });
liftPixelBoxes();
