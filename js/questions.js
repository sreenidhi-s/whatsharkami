import { CATALOGUE_ORDER } from './sharks.js';
const q=(text,answers)=>({text,answers:answers.map(([text,a,b])=>({text,sharks:[a,b]}))});
export const QUESTIONS=[
q("It's movie night and you've got the remote. What are we watching?",[['Something hilarious I can quote for weeks','spinner','cookiecutter'],['Big action, chases, and heroes','tiger','greatwhite'],["A mystery where I'm guessing the twist from minute one",'thresher','wobbegong'],["A feel-good favorite I've already watched five times",'nurse','tangerine']]),
q('What matters most to you in a friend?', [['They show up, no matter what','lemon','whale'],['They make me laugh until it hurts','cookiecutter','tangerine'],['They get my weirdness and love it','goblin','epaulette'],["They're up for anything, anytime",'hammerhead','spinner']]),
q('You get one superpower. Which one?',[['Invisibility','wobbegong','greenland'],['Seeing three moves ahead of everyone','thresher','greatwhite'],['Calming anyone down with one sentence','whale','nurse'],['Making everyone around me instantly happy','tangerine','hammerhead']]),
q('Pick a favorite animal:',[['Octopus','epaulette','goblin'],['Golden retriever','lemon','hammerhead'],['Tortoise','greenland','nurse'],['Eagle','greatwhite','thresher']]),
q('Dream environment?',[['A snowy cabin, fireplace on, nowhere to be','greenland','whale'],['A sunny beach at golden hour','tangerine','epaulette'],["A wild jungle nobody's mapped yet",'tiger','epaulette'],['A buzzing city full of neon lights','hammerhead','cookiecutter']]),
q("When there's a conflict, you usually...",[['Say it straight, right now','greatwhite','tiger'],['Step back, make a plan, then make my move','thresher','wobbegong'],['Calm everyone down and find the middle ground','whale','lemon'],['Crack a joke to break the tension','cookiecutter','spinner']]),
q('Where would you live if you could pick anywhere?',[['A cozy house in a small town where everyone knows me','nurse','lemon'],['Somewhere new every year','epaulette','tiger'],['A quirky old place full of oddities, like a lighthouse','goblin','wobbegong'],['A penthouse right in the middle of it all','spinner','greatwhite']]),
q("What's your biggest fear?",[['Being left out of the group','lemon','hammerhead'],['Getting stuck doing the same thing forever','epaulette','thresher'],['Being totally ordinary','goblin','tangerine'],['Being put on the spot with everyone staring','wobbegong','greenland']]),
q('What makes you feel most proud?',[['Helping someone through a rough time','whale','lemon'],['Pulling off something everyone said was impossible','greatwhite','cookiecutter'],["Making something that's completely mine",'tangerine','goblin'],['Sticking with something for years and finally winning','greenland','thresher']]),
q('Your ideal hangout is...', [['Pajamas, blankets, and takeout at home','nurse','whale'],['A big group night with loud music','hammerhead','spinner'],['A midnight snack run and long random talks','cookiecutter','goblin'],['A corner cafe seat with a great view for people-watching','wobbegong','greenland']]),
].map(item=>({...item,answers:item.answers.map((a,i)=>({letter:'ABCD'[i],...a}))}));

// Choice indices refer to original answer order. The first shark receives +2, the second +1.
export function scoreAnswers(answers){
 const scores=Object.fromEntries(CATALOGUE_ORDER.map(id=>[id,{points:0,twos:0,last:-1}]));
 answers.forEach((choice,i)=>{if(!Number.isInteger(choice)||choice<0||choice>3||!QUESTIONS[i])return;const [a,b]=QUESTIONS[i].answers[choice].sharks;scores[a].points+=2;scores[a].twos++;scores[a].last=i;scores[b].points++;scores[b].last=i;});
 const ranking=CATALOGUE_ORDER.map((id,index)=>({id,index,...scores[id]})).sort((a,b)=>b.points-a.points||b.twos-a.twos||b.last-a.last||a.index-b.index);
 return {primary:ranking[0].id,secondary:ranking[1].id,scores};
}
