(function(root){
 const intervals=[1,2,4,7,15,30].map(d=>d*86400000);
 const aliases={'二十四节气':['24 solar terms','twenty-four solar terms','the twenty-four solar terms'],'京剧':['beijing opera'],'皮影戏':['shadow play'],'春节':['chinese new year'],'剪纸':['paper cutting','papercutting'],'地铁':['subway','metro'],'公共交通':['public transport'],'电子商务':['electronic commerce'],'金融科技':['financial technology'],'垃圾分类':['waste sorting','rubbish sorting'],'网络安全':['cyber security'],'城市化':['urbanisation'],'全球化':['globalisation'],'老龄化社会':['ageing society'],'共享单车':['shared bicycles','shared bike'],'新能源汽车':['new energy vehicle','NEV'],'高铁':['high speed rail','high-speed rail'],'民生':["peoples livelihood"],'生物技术':['biotech'],'环境友好':['environmentally friendly'],'一带一路':['belt and road initiative']};
 function normalize(s){return s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[–—‐‑-]/g,' ').replace(/[.,!?;:()]/g,' ').replace(/\s+/g,' ').trim().replace(/^the\s+/,'');}
 function answers(w){let a=w.en;let par=a.match(/\s*\(([^)]+)\)\s*$/); let base=par?a.slice(0,par.index):a; return [...new Set([base,...base.split('/'),...(par?[par[1],a]:[]),...(aliases[w.zh]||[])].map(normalize))];}
 function correct(w,s){return !!normalize(s)&&answers(w).includes(normalize(s));}
 function unique(words){return words.filter((w,i)=>words.findIndex(x=>x.zh===w.zh)===i)}
 function schedule(old,ok,now){const level=ok?Math.min((old?.level??-1)+1,intervals.length-1):0;return {level,due:now+(ok?intervals[level]:600000),seen:true};}
 const api={normalize,answers,correct,unique,schedule}; if(typeof module!=='undefined')module.exports=api;else root.WordCore=api;
})(typeof window==='undefined'?globalThis:window);
