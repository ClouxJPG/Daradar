/* Radar Cleaner - Чистка радара: только легенда РГМЦ, инпейнтинг артефактов, таймлайн */

(function(){
    "use strict";
    
    const LEGEND = [
        '#9caab1','#a2c6ff','#46ff93','#00c25a','#009800','#ffff80',
        '#3e88ff','#0138ff','#000074','#ffaa7f','#ff557f','#ff0000',
        '#cc6600','#884400','#5f0000','#ffaaff','#ff55ff','#c700c7','#3f3f5f'
    ];
    
    const RGB = LEGEND.map(h=>{
        const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
        return {r,g,b};
    });
    
    const BG = {r:177,g:177,b:177};
    const TOL = 20;
    
    let S = {
        on: false, rid: null, frames: [], idx: 0, 
        canvas: null, overlay: null, radar: null
    };
    
    function dist(a,b){
        const dr=a.r-b.r, dg=a.g-b.g, db=a.b-b.b;
        return Math.sqrt(dr*dr+dg*dg+db*db);
    }
    
    function ok(r,g,b){
        for(let i=0;i<RGB.length;i++) if(dist({r,g,b}, RGB[i])<=TOL) return true;
        return dist({r,g,b}, BG)<=TOL;
    }
    
    function best(r,g,b){
        let m = RGB[0], d = Infinity;
        for(let i=0;i<RGB.length;i++){
            const x = dist({r,g,b}, RGB[i]);
            if(x<d){d=x; m=RGB[i];}
        }
        return m;
    }
    
    function clean(w,h,data){
        const mask = new Uint8Array(w*h);
        
        for(let i=0;i<data.length;i+=4){
            if(!ok(data[i],data[i+1],data[i+2]) || data[i+3]<200){
                mask[i/4]=1;
            }
        }
        
        for(let it=0;it<4;it++){
            for(let y=0;y<h;y++){
                for(let x=0;x<w;x++){
                    const idx = y*w+x;
                    if(!mask[idx]) continue;
                    
                    let sr=0, sg=0, sb=0, cnt=0;
                    for(let dy=-4;dy<=4;dy++){
                        for(let dx=-4;dx<=4;dx++){
                            const nx=x+dx, ny=y+dy;
                            if(nx<0||nx>=w||ny<0||ny>=h) continue;
                            const nidx = ny*w+nx;
                            if(!mask[nidx]){
                                const i = nidx*4;
                                sr+=data[i]; sg+=data[i+1]; sb+=data[i+2];
                                cnt++;
                            }
                        }
                    }
                    
                    if(cnt>0){
                        const b = best(sr/cnt,sg/cnt,sb/cnt);
                        const i = idx*4;
                        data[i]=b.r; data[i+1]=b.g; data[i+2]=b.b; data[i+3]=255;
                        mask[idx]=0;
                    }
                }
            }
        }
    }
    
    async function get(url){
        const r = await fetch(url);
        return r.ok ? r : null;
    }
    
    async function load(){
        const r = await get('/api/radars');
        return r ? await r.json() : [];
    }
    
    async function frames(rid){
        const r = await get('/api/frames/'+rid);
        return r ? await r.json() : [];
    }
    
    async function img(rid, ts){
        return '/api/img/'+rid+'/'+ts+'?p=4&m=S';
    }
    
    function draw(url, cb){
        const im = new Image();
        im.crossOrigin='anonymous';
        im.onload=()=>{
            const c = document.createElement('canvas');
            c.width=im.width; c.height=im.height;
            const ctx = c.getContext('2d', {willReadFrequently:true});
            ctx.drawImage(im,0,0);
            const d = ctx.getImageData(0,0,c.width,c.height);
            clean(c.width,c.height,d.data);
            ctx.putImageData(d,0,0);
            cb(c.toDataURL('image/png'));
        };
        im.onerror=()=>cb(null);
        im.src=url;
    }
    
    function bounds(){
        if(!S.radar) return [[55,37],[56,38]];
        const lat = S.radar.lat || 55;
        const lon = S.radar.lon || 37;
        const km = S.radar.range_km || 250;
        const dlat = km/111.32, dlon = km/(111.32*Math.cos(lat*Math.PI/180));
        return [[lat-dlat, lon-dlon], [lat+dlat, lon+dlon]];
    }
    
    function render(){
        if(!S.on || !S.frames.length) return;
        
        const url = '/api/img/'+S.rid+'/'+S.frames[S.idx]+'?p=4&m=S';
        draw(url, (dataUrl)=>{
            if(!dataUrl || !window.map) return;
            
            if(S.overlay) window.map.removeLayer(S.overlay);
            S.overlay = L.imageOverlay(dataUrl, bounds(), {opacity:0.95, zIndex:500});
            S.overlay.addTo(window.map);
            
            const h = document.getElementById('hrs');
            if(h){
                Array.from(h.children).forEach((e,i)=>e.classList.toggle('c',i===S.idx));
            }
        });
    }
    
    function timeline(){
        const h = document.getElementById('hrs');
        if(!h) return;
        h.innerHTML='';
        S.frames.forEach((ts,i)=>{
            const e = document.createElement('div');
            e.textContent = String(i+1).padStart(2,'0');
            e.className = i===S.idx?'c':'';
            e.onclick=()=>{S.idx=i; render();};
            h.appendChild(e);
        });
    }
    
    async function on(rid){
        if(S.on && S.rid===rid){off(); return;}
        
        S.on = true;
        S.rid = rid;
        S.idx = 0;
        
        const btn = document.querySelector('[data-m="S"]');
        if(btn) btn.classList.add('on');
        
        const list = await load();
        S.radar = list.find(r=>r.id===rid) || list[0];
        
        S.frames = await frames(rid);
        if(!S.frames.length){
            const msg = document.getElementById('msg');
            if(msg) msg.textContent='Нет кадров';
            return;
        }
        
        timeline();
        render();
    }
    
    function off(){
        S.on = false;
        S.rid = null;
        S.frames = [];
        S.idx = 0;
        
        if(S.overlay && window.map){
            window.map.removeLayer(S.overlay);
            S.overlay = null;
        }
        
        const btn = document.querySelector('[data-m="S"]');
        if(btn) btn.classList.remove('on');
        
        const h = document.getElementById('hrs');
        if(h) h.innerHTML = '';
    }
    
    function init(){
        const btn = document.querySelector('[data-m="S"]');
        if(!btn){setTimeout(init,100); return;}
        
        btn.addEventListener('click', async()=>{
            const list = await load();
            if(list.length) on(list[0].id);
        });
        
        document.addEventListener('keydown', e=>{
            if(!S.on || !S.frames.length) return;
            if(e.key==='ArrowRight'){S.idx=(S.idx+1)%S.frames.length; render();}
            if(e.key==='ArrowLeft'){S.idx=(S.idx-1+S.frames.length)%S.frames.length; render();}
        });
    }
    
    if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded', init);
    }else{
        init();
    }
})();
