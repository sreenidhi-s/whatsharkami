// Map zone centers use percentage coordinates on the exported 100 x 52 pixel map.
const entries=[
['thresher',3,40.4,3.0,'#8CC7F7'],['hammerhead',8,61.5,3.0,'#B8A6F2'],
['whale',72,84.6,3.2,'#739EE6'],['nurse',41,61.5,2.2,'#9EE6C2'],
['lemon',27,40.4,2.5,'#FFE680'],['cookiecutter',96,51.9,3.0,'#F7A6CC'],
['epaulette',79,75,2.0,'#BFE673'],['greenland',33,19.2,3.2,'#99D9E0'],
['spinner',33,69.2,3.0,'#FF9E99'],['tangerine',23,50,1.9,'#FFAD59'],
['greatwhite',51,86.5,3.0,'#E68CBF'],['tiger',96,76.9,2.4,'#59C7BF'],
['goblin',95,30.8,3.0,'#D999F2'],['wobbegong',95,88.5,2.4,'#D9BF8C'],
];
export const ZONES=Object.fromEntries(entries.map(([id,x,y,radius,color])=>[id,{x,y,radius,color}]));
