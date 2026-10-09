(function(){
const LEGEND=[
'#9caab1','#a2c6ff','#46ff93','#00c25a','#009800','#ffff80',
'#3e88ff','#0138ff','#000074','#ffaa7f','#ff557f','#ff0000',
'#cc6600','#884400','#5f0000','#ffaaff','#ff55ff','#c700c7','#3f3f5f'
];
const PAL=LEGEND.map(h=>({r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}));
const BG={r:177,g:177,b:177};
const TOL=20;
const st={on:0,rid:null,radar:null,frames:[],idx:0,ov:null};

function dist(a,b){return Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2)}
function isLegend(r,g,b){
const p={r,g,b};
for(let i=0;i<PAL.length;i++)if(dist(p,PAL[i])<=TOL)return 1;
return dist(p,BG)<=TOL;
}
function best(r,g,b){let w=PAL[0],d=1e9;const p={r,g,b};for(let i=0;i<PAL.length;i++){const x=dist(p,PAL[i]);if(x<d){d=x;w=PAL[i]}}return w}
function clean(data,w,h){
const m=new Uint8Array(w*h);
for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];if(a<180||!isLegend(r,g,b))m[i/4]=1}
for(let p=0;p<4;p++){for(let y=0;y<h;y++){for(let x=0;x<w;x++){const idx=y*w+x;if(!m[idx])continue;
let sr=0,sg=0,sb=0,c=0;for(let dy=-4;dy<=4;dy++){for(let dx=-4;dx<=4;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const nidx=ny*w+nx;if(!m[nidx]){const q=nidx*4;sr+=data[q];sg+=data[q+1];sb+=data[q+2];c++}}}
if(c>0){const q=best(sr/c,sg/c,sb/c);const z=idx*4;data[z]=q.r;data[z+1]=q.g;data[z+2]=q.b;data[z+3]=255;m[idx]=0}}}
}
for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];const q=best(r,g,b);data[i]=q.r;data[i+1]=q.g;data[i+2]=q.b;data[i+3]=255}
}
function render(url,cb){
const img=new Image();img.crossOrigin='anonymous';img.onload=function(){
const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d',{willReadFrequently:1});x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height);clean(d.data,c.width,c.height);x.putImageData(d,0,0);cb(c.toDataURL('image/png'))};img.onerror=()=>cb(null);img.src=url};
function bounds(r){if(!r)return[[55,37],[56,38]];const lat=r.lat||55,lon=r.lon||37,km=r.range_km||250,dlat=km/111.32,dlon=km/(111.32*Math.cos(lat*Math.PI/180));return[[lat-dlat,lon-dlon],[lat+dlat,lon+dlon]]}
async function json(u){try{const r=await fetch(u,{cache:'no-store'});return r.ok?await r.json():[]}catch{return[]}}
function timeline(){
const h=document.getElementById('hrs');if(!h)return;h.innerHTML='';st.frames.forEach((ts,i)=>{
const el=document.createElement('div');el.textContent=String(i+1).padStart(2,'0');el.title=ts;el.className=i===st.idx?'c':'';el.style.cursor='pointer';el.addEventListener('click',()=>{st.idx=i;frame()});h.appendChild(el)});
}
function update(){
const h=document.getElementById('hrs');if(!h)return;Array.from(h.children).forEach((el,i)=>{el.classList.toggle('c',i===st.idx)});
}
function frame(){
if(!st.on||!st.rid||!st.frames.length)return;
const m=window.map||null;if(!m){setTimeout(frame,150);return}
const ts=st.frames[st.idx];const url='/api/img/'+st.rid+'/'+ts+'?p=4&m=S';render(url,function(dataUrl){
if(!dataUrl)return;if(st.ov)m.removeLayer(st.ov);st.ov=L.imageOverlay(dataUrl,bounds(st.radar),{opacity:.98,interactive:0,zIndex:500});st.ov.addTo(m);update()});
}
function off(){
st.on=0;st.idx=0;const m=window.map;if(m&&st.ov){m.removeLayer(st.ov);st.ov=null}
const btn=document.querySelector('[data-m="S"]');if(btn)btn.classList.remove('on');
const h=document.getElementById('hrs');if(h)h.innerHTML='';
}
async function on(rid){
const list=await json('/api/radars');const radar=list.find(r=>String(r.id)===String(rid))||list[0];if(!radar)return;
st.radar=radar;st.rid=String(radar.id);st.frames=await json('/api/frames/'+st.rid);st.idx=0;st.on=1;
const btn=document.querySelector('[data-m="S"]');if(btn)btn.classList.add('on');
if(!st.frames.length)return;timeline();frame();
}
function bind(){
const btn=document.querySelector('[data-m="S"]');if(!btn){setTimeout(bind,100);return}
btn.addEventListener('click',async function(){
if(st.on){off();return}
const m=window.map;if(!m){setTimeout(bind,100);return}
const list=await json('/api/radars');if(!list.length)return;on(String(list[0].id))
});
document.addEventListener('keydown',function(e){
if(!st.on||!st.frames.length)return;
if(e.key==='ArrowRight'){st.idx=(st.idx+1)%st.frames.length;frame()}
if(e.key==='ArrowLeft'){st.idx=(st.idx-1+st.frames.length)%st.frames.length;frame()}
});
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',bind,{once:1})}else{bind()}
})();