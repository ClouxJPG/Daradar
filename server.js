// Node 18+, без зависимостей:  node server.js
// Забирает кадры ДМРЛ из источника (url в radars.json), кэширует на диск и отдаёт клиенту с CORS.
import http from 'http';import fs from 'fs';
const R=JSON.parse(fs.readFileSync('radars.json','utf8')),PORT=process.env.PORT||8080,DIR='cache';fs.mkdirSync(DIR,{recursive:true});
const pad=n=>String(n).padStart(2,'0');
const stamp=d=>`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
const parse=t=>new Date(Date.UTC(+t.slice(0,4),t.slice(4,6)-1,+t.slice(6,8),+t.slice(9,11),+t.slice(11,13)));
const srcUrl=(r,t,p)=>{const d=parse(t);return (r.url||process.env.RADAR_URL||'').replace('{id}',r.id).replace('{Y}',d.getUTCFullYear()).replace('{M}',pad(d.getUTCMonth()+1)).replace('{D}',pad(d.getUTCDate())).replace('{h}',pad(d.getUTCHours())).replace('{m}',pad(d.getUTCMinutes())).replace('{p}',p)};
const meta=r=>{const k=r.range_km||250,dl=k/111.32,dn=k/(111.32*Math.cos(r.lat*Math.PI/180));return{id:r.id,name:r.name,lat:r.lat,lon:r.lon,rings:r.rings,bounds:r.bounds||[r.lat-dl,r.lon-dn,r.lat+dl,r.lon+dn]}};
const ok=async u=>{try{let x=await fetch(u,{method:'HEAD'});if(!x.ok)x=await fetch(u,{headers:{Range:'bytes=0-0'}});return x.ok}catch{return false}};
const fcache={};
async function frames(r){const c=fcache[r.id];if(c&&Date.now()-c.t<60000)return c.v;const st=(r.step||10)*60000,n=Math.floor(Date.now()/st)*st,ts=[];for(let i=0;i<(r.count||14);i++)ts.unshift(stamp(new Date(n-i*st)));
const res=await Promise.all(ts.map(async t=>(await ok(srcUrl(r,t,r.product||4)))?t:null)),v=res.filter(Boolean).slice(-12);fcache[r.id]={t:Date.now(),v};return v}
const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
http.createServer(async(q,s)=>{try{const u=new URL(q.url,'http://x'),p=u.pathname.split('/').filter(Boolean);
if(q.method=='OPTIONS'){s.writeHead(204,H);return s.end()}
if(p[1]=='radars'){s.writeHead(200,{...H,'Content-Type':'application/json'});return s.end(JSON.stringify(R.map(meta)))}
const r=R.find(x=>x.id==p[2]);if(!r){s.writeHead(404,H);return s.end()}
if(p[1]=='frames'){s.writeHead(200,{...H,'Content-Type':'application/json'});return s.end(JSON.stringify(await frames(r)))}
if(p[1]=='img'){const t=p[3].replace(/[^0-9_]/g,''),pr=+u.searchParams.get('p')||4,f=`${DIR}/${r.id}_${t}_${pr}.png`;
if(!fs.existsSync(f)){const x=await fetch(srcUrl(r,t,pr));if(!x.ok){s.writeHead(502,H);return s.end()}fs.writeFileSync(f,Buffer.from(await x.arrayBuffer()))}
s.writeHead(200,{...H,'Content-Type':'image/png','Cache-Control':'public,max-age=600'});return fs.createReadStream(f).pipe(s)}
s.writeHead(404,H);s.end()}catch(e){s.writeHead(500,H);s.end(String(e))}}).listen(PORT,()=>console.log('DMRL proxy на :'+PORT));
setInterval(()=>{for(const f of fs.readdirSync(DIR))try{const p=DIR+'/'+f;if(Date.now()-fs.statSync(p).mtimeMs>864e5)fs.unlinkSync(p)}catch{}},36e5);
