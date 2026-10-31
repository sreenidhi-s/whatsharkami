import { SHARKS, CATALOGUE_ORDER } from './sharks.js';
import { QUESTIONS, scoreAnswers } from './questions.js';
import { ZONES } from './zones.js';
import { mountBubble } from './bubble.js';
import { mountCursor } from './cursor.js';
import { mountSound, playSound } from './sound.js';
import { mountOcean } from './ocean.js';

const app=document.querySelector('#app'), dialog=document.querySelector('#shark-dialog');
const state={page:'home',index:0,answers:[],order:[],result:null,name:sessionStorage.getItem('sharkName')||'',completed:false,completionId:null,hover:null};
let revealTimeout=null;

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
 app.innerHTML=frame(`<div class="card-id-stage"><div class="card-preview-wrap"><p class="card-preview-loading">PRINTING YOUR SHARK ID...</p></div></div><div class="card-actions" aria-label="Shark ID actions"><button class="card-pill-button" data-action="download" aria-label="Download Shark ID" title="Download Shark ID"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6v12h6L16 24 7 15h6zM5 25h22v4H5z"/></svg><span>download</span></button><button class="card-pill-button" data-action="share" aria-label="Share Shark ID" title="Share Shark ID"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 2h12v12h-5V9L14 20l-4-4L21 5h-3zM4 9h12v5H9v13h14v-7h5v12H4z"/></svg><span>share</span></button><button class="text-button card-retake" data-action="retake">↻ TAKE THE QUIZ AGAIN</button></div>`,'panel--id');

 app.querySelector('[data-action="download"]').onclick=downloadCard;
 app.querySelector('[data-action="share"]').onclick=shareCard;
 app.querySelector('[data-action="retake"]').onclick=restart;

 const image=await createSharkCardCanvas();
 image.className='card-preview-img';
 image.setAttribute('role','img');
 image.setAttribute('aria-label',`Shark ID for ${state.name}, matched with ${s.name}`);
 const slot=app.querySelector('.card-preview-wrap');
 if(slot?.isConnected)slot.replaceChildren(image);
}

async function createSharkCardCanvas({template=false}={}){
 await document.fonts.ready;
 const canvas=document.createElement('canvas');
 canvas.width=1200;
 canvas.height=770;
 const ctx=canvas.getContext('2d');
 ctx.imageSmoothingEnabled=false;
 const s=SHARKS[state.result.primary];
 const navy='#173d68',cream='#fbf9ff',blue='#dcecfb';
 const card={x:70,y:70,w:1060,h:680},footerY=650;
 // Leave the canvas outside the card fully transparent.
 ctx.fillStyle='rgba(19,55,94,.18)';steppedRect(ctx,card.x,card.y+12,card.w,card.h,24);ctx.fill();
 const borderGradient=ctx.createLinearGradient(card.x,card.y,card.x+card.w,card.y+card.h);
 borderGradient.addColorStop(0,'#bdf0cf');borderGradient.addColorStop(.48,'#f7c6dc');borderGradient.addColorStop(1,'#cfc2f7');
 ctx.strokeStyle=borderGradient;ctx.lineWidth=20;steppedRect(ctx,card.x+10,card.y+10,card.w-20,card.h-20,22);ctx.stroke();
 ctx.fillStyle=cream;steppedRect(ctx,card.x+18,card.y+18,card.w-36,card.h-36,18);ctx.fill();
 ctx.strokeStyle=navy;ctx.lineWidth=4;steppedRect(ctx,card.x+21,card.y+21,card.w-42,card.h-42,16);ctx.stroke();

 // Header and membership copy.
 ctx.fillStyle=navy;ctx.beginPath();ctx.arc(600,114,12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=blue;ctx.beginPath();ctx.arc(600,114,8,0,Math.PI*2);ctx.fill();
 drawStar(ctx,130,150,22);drawStar(ctx,1070,150,22);
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

 const starColors=['#f3b7d4','#b9e5c7',navy,'#b9e5c7','#f3b7d4'];
 for(let x=132,i=0;x<690;x+=38,i++){ctx.fillStyle=starColors[i%starColors.length];drawStar(ctx,x,366,6);}

 // Name, match, and traits.
 ctx.textAlign='left';ctx.fillStyle=navy;ctx.font='15px Pixelify Sans';
 ctx.fillText('NAME',132,401);ctx.fillText('YOUR SHARK',424,401);
 drawCardField(ctx,132,412,275,46,navy,cream);drawCardField(ctx,424,412,275,46,navy,cream);
 ctx.font='20px Pixelify Sans';
 if(template){ctx.fillStyle='#8796ab';ctx.fillText('Type name here',147,442);}
 else fitText(ctx,state.name,147,442,245);
 if(!template)fitText(ctx,s.name,439,442,245);
 ctx.font='15px Pixelify Sans';ctx.fillText('PERSONALITY TRAITS',132,487);
 const traitColors=['#bdf0cf','#f7c6dc','#cfc2f7'];
 s.traits.forEach((trait,i)=>{
  const x=132+i*190;
  ctx.fillStyle=traitColors[i%traitColors.length];ctx.fillRect(x,500,176,42);
  ctx.strokeStyle=navy;ctx.lineWidth=3;ctx.strokeRect(x,500,176,42);
  if(!template){ctx.textAlign='center';ctx.font='19px Pixelify Sans';ctx.fillStyle=navy;fitText(ctx,trait,x+88,527,160);}
 });

 ctx.textAlign='left';ctx.fillStyle=navy;ctx.font='15px Pixelify Sans';ctx.fillText('ABOUT THE SHARK',132,575);
 drawCardField(ctx,132,585,567,60,navy,cream);
 if(!template){ctx.font='14px Pixelify Sans';wrapText(ctx,s.about,146,608,540,17,2);}

 // Portrait and barcode.
 const portrait={x:745,y:218,w:300,h:300};
 ctx.fillStyle=cream;ctx.fillRect(portrait.x,portrait.y,portrait.w,portrait.h);
 ctx.strokeStyle=navy;ctx.lineWidth=5;ctx.strokeRect(portrait.x,portrait.y,portrait.w,portrait.h);
 ctx.clearRect(portrait.x+10,portrait.y+10,portrait.w-20,portrait.h-20);
 ctx.fillStyle='rgba(189,221,247,.58)';ctx.fillRect(portrait.x+10,portrait.y+10,portrait.w-20,portrait.h-20);
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
 drawBarcode(ctx,745,554,300,42,template?'00000-014':`${state.name}-${s.id}`);

 ctx.save();steppedRect(ctx,card.x+22,card.y+22,card.w-44,card.h-44,16);ctx.clip();
 ctx.fillStyle=navy;ctx.fillRect(card.x,footerY,card.w,card.y+card.h-footerY);ctx.restore();
 ctx.textAlign='left';ctx.fillStyle=cream;ctx.font='600 25px Pixelify Sans';ctx.fillText('a life time expiry',112,690);
 ctx.font='16px Pixelify Sans';ctx.fillText('must be shared with all our friends',112,713);
 ctx.beginPath();ctx.fillStyle='#cfc2f7';ctx.arc(670,690,33,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=cream;ctx.lineWidth=2;ctx.stroke();
 ctx.textAlign='center';ctx.fillStyle=navy;ctx.font='12px Pixelify Sans';ctx.fillText('ONE OF 14',670,694);
 ctx.fillStyle=cream;ctx.fillRect(745,668,300,44);ctx.fillStyle=navy;
 ctx.font='15px Pixelify Sans';ctx.fillText('ALL YOU NEED IS A SHARK',895,696);ctx.textAlign='left';

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

function drawBarcode(ctx,x,y,width,height,seed){
 let offset=0;ctx.fillStyle='#173d68';
 for(let i=0;i<seed.length*5&&offset<width;i++){
  const code=seed.charCodeAt(i%seed.length),bar=(code>>(i%7))&1,barWidth=(i%4===0)?3:2;
  if(bar)ctx.fillRect(x+offset,y,barWidth,height);
  offset+=barWidth+2;
 }
}

function drawStar(ctx,x,y,r){
 ctx.save();
 ctx.translate(x,y);
 ctx.beginPath();
 ctx.fillStyle='#13375e';
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
 const data={
  title:'My Shark ID',
  text:`I’m ${SHARKS[state.result.primary].title}! Find your shark:`,
  url:location.href.split('#')[0]
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
if(['what','why','who','where'].includes(hash))state.page=hash;
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
