import { useState, useEffect, useRef, useCallback } from "react";

const G = "#006a4e", GL = "#e8f4f0", GOLD = "#b8860b";

const SURVEY_META = {
  RS: { label: "RS জরিপ | Revisional Survey", badge: { bg:"#e8f4e8", color:"#1a6b1a", border:"#1a6b1a" }, full:"Revisional Survey (RS)" },
  CS: { label: "CS জরিপ | Cadastral Survey", badge: { bg:"#e8e8f8", color:"#1a1a8b", border:"#1a1a8b" }, full:"Cadastral Survey (CS)" },
  BS: { label: "BS জরিপ | Bangladesh Survey", badge: { bg:"#f8f0e8", color:"#8b4a1a", border:"#8b4a1a" }, full:"Bangladesh Survey (BS)" },
  SA: { label: "SA জরিপ | State Acquisition", badge: { bg:"#f8e8e8", color:"#8b1a1a", border:"#8b1a1a" }, full:"State Acquisition Survey (SA)" },
};

const SCALE_PRESETS = {
  "16_1mile": { px: (16/5280)*96, label: "১৬\" = ১ মাইল (RS/CS মৌজা)", barFt: 100 },
  "32_1mile": { px: (32/5280)*96, label: "৩২\" = ১ মাইল (বিস্তারিত)", barFt: 50 },
  "8_1mile":  { px: (8/5280)*96,  label: "৮\" = ১ মাইল (থানা/উপজেলা)", barFt: 200 },
  "4_1mile":  { px: (4/5280)*96,  label: "৪\" = ১ মাইল (জেলা)", barFt: 500 },
  "1_500":    { px: 1.92, label: "১:৫০০ (মেট্রিক)", barFt: 50 },
  "1_1000":   { px: 0.96, label: "১:১০০০ (মেট্রিক)", barFt: 100 },
  "1_2000":   { px: 0.48, label: "১:২০০০ (মেট্রিক)", barFt: 200 },
  "1_5000":   { px: 0.192, label: "১:৫০০০ (মেট্রিক)", barFt: 500 },
  "link":     { px: 0.96, label: "১\" = ১ চেইন (লিংক)", barFt: 66 },
  "custom":   { px: 3.44, label: "কাস্টম", barFt: 100 },
};

const SHAPE_DEFAULTS = {
  quad:   [ {label:"উত্তর",ft:120,ang:270}, {label:"পূর্ব",ft:100,ang:0}, {label:"দক্ষিণ",ft:120,ang:90}, {label:"পশ্চিম",ft:100,ang:180} ],
  tri:    [ {label:"বাহু ক",ft:150,ang:270}, {label:"বাহু খ",ft:130,ang:60}, {label:"বাহু গ",ft:110,ang:180} ],
  irr:    [ {label:"উত্তর",ft:100,ang:270}, {label:"উত্তর-পূর্ব",ft:80,ang:330}, {label:"পূর্ব",ft:90,ang:45}, {label:"দক্ষিণ",ft:110,ang:120}, {label:"পশ্চিম",ft:95,ang:200} ],
  lshape: [ {label:"উত্তর-১",ft:80,ang:270}, {label:"পূর্ব-১",ft:60,ang:0}, {label:"দক্ষিণ-১",ft:40,ang:90}, {label:"পূর্ব-২",ft:60,ang:0}, {label:"দক্ষিণ-২",ft:40,ang:90}, {label:"পশ্চিম",ft:120,ang:180} ],
};

const DEFAULT_CHOU = [
  { dir:"উত্তর", val:"রাস্তা / পাকা রাস্তা" },
  { dir:"দক্ষিণ", val:"নিজ জমি / ফসলি জমি" },
  { dir:"পূর্ব",  val:"পার্শ্ববর্তী মালিকের জমি" },
  { dir:"পশ্চিম", val:"সরকারি খাল / নদী" },
];

let _id = 0;
const uid = () => ++_id;

const inp = { width:"100%", padding:"6px 8px", border:"1px solid #d0dbd6", borderRadius:5, fontFamily:"inherit", fontSize:12, background:"#fff", color:"#222" };
const lbl = { display:"block", fontSize:10, fontWeight:700, color:"#555", marginBottom:3 };

export default function SurveyTool() {
  const [surveyType, setSurveyType] = useState("RS");
  const [shape, setShape] = useState("quad");
  const [scaleKey, setScaleKey] = useState("16_1mile");
  const [zoom, setZoom] = useState(SCALE_PRESETS["16_1mile"].px * 3);
  const [sides, setSides] = useState(SHAPE_DEFAULTS.quad.map(s => ({...s, id:uid(), links:0})));
  const [chous, setChous] = useState(DEFAULT_CHOU.map(c => ({...c, id:uid()})));
  const [area, setArea] = useState({ ft2:0, sqm:0, sha:0, katha:0, bigha:0 });

  const [f, setF] = useState({
    hTitle:"ডিজিটাল ভূমি জরিপ ও নকশা কেন্দ্র",
    hPhone:"+৮৮০-১৭০০-০০০০০", hReg:"REG-২০২৬", hLic:"LIC-DHAKA",
    khatianNo:"খতিয়ান: ২৪৫", dagNo:"দাগ: ১০৫",
    moujaName:"চকবাজার", upojelaName:"কোতোয়ালী", jelaName:"ঢাকা", bibhagName:"ঢাকা বিভাগ",
    srvYear:"২০২৪", ownerDetails:"মালিক: মো: আব্দুল করিম, পিতা: মৃত রহিম উদ্দিন, গ্রাম: চকবাজার।",
  });

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  const fld = (k) => (v) => setF(p => ({...p, [k]: typeof v === "string" ? v : v.target.value}));

  const loadShape = useCallback((sh) => {
    setShape(sh);
    setSides(SHAPE_DEFAULTS[sh].map(s => ({...s, id:uid(), links: +(s.ft/66*100).toFixed(3)})));
  }, []);

  const applyScale = useCallback((key) => {
    setScaleKey(key);
    const px = Math.max(SCALE_PRESETS[key].px * 3, 0.5);
    setZoom(px);
  }, []);

  const updateSide = (id, key, val) => setSides(prev => prev.map(s => {
    if (s.id !== id) return s;
    if (key === "ft")    return {...s, ft: +val, links: +(+val/66*100).toFixed(3)};
    if (key === "links") return {...s, links: +val, ft: +(+val*66/100).toFixed(2)};
    return {...s, [key]: val};
  }));
  const delSide = (id) => setSides(prev => prev.filter(s => s.id !== id));
  const addSide = ()   => setSides(prev => [...prev, {id:uid(), label:"নতুন বাহু", ft:0, links:0, ang:0}]);

  const updateChou = (id, key, val) => setChous(prev => prev.map(c => c.id===id ? {...c,[key]:val} : c));
  const delChou   = (id) => setChous(prev => prev.filter(c => c.id !== id));
  const addChou   = ()   => setChous(prev => [...prev, {id:uid(), dir:"দিক", val:"মালিকের নাম"}]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const W = wrap.clientWidth || 600;
    const H = wrap.clientHeight || 380;
    canvas.width  = W * 2;
    canvas.height = H * 2;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    const sc = zoom;

    let pts = [{x:0, y:0}], cx=0, cy=0;
    sides.forEach(s => {
      const rad = s.ang * Math.PI / 180;
      cx += (s.ft||0) * Math.cos(rad) * sc;
      cy += (s.ft||0) * Math.sin(rad) * sc;
      pts.push({x:cx, y:cy});
    });

    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const ox = (W-(maxX-minX))/2 - minX;
    const oy = (H-(maxY-minY))/2 - minY;

    ctx.clearRect(0,0,W,H);

    ctx.save(); ctx.strokeStyle="#e0ede8"; ctx.lineWidth=0.5;
    const gs = Math.max(50*sc, 20);
    for (let x=0; x<W; x+=gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<H; y+=gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(pts[0].x+ox, pts[0].y+oy);
    pts.slice(1).forEach(p => ctx.lineTo(p.x+ox, p.y+oy));
    ctx.closePath();
    ctx.fillStyle = "rgba(0,106,78,0.07)"; ctx.fill();
    ctx.strokeStyle = G; ctx.lineWidth = 2.5; ctx.stroke();

    sides.forEach((s, i) => {
      const p1 = pts[i], p2 = pts[i+1];
      if (!p2 || !s.ft) return;
      const mx = (p1.x+p2.x)/2+ox, my = (p1.y+p2.y)/2+oy;
      const ang = Math.atan2(p2.y-p1.y, p2.x-p1.x);
      ctx.save(); ctx.strokeStyle=G; ctx.lineWidth=1.5;
      [p1,p2].forEach(p => {
        const px=p.x+ox, py=p.y+oy;
        ctx.beginPath();
        ctx.moveTo(px-Math.sin(ang)*5, py+Math.cos(ang)*5);
        ctx.lineTo(px+Math.sin(ang)*5, py-Math.cos(ang)*5);
        ctx.stroke();
      });
      ctx.restore();
      ctx.save();
      ctx.translate(mx, my); ctx.rotate(ang);
      if (ang > Math.PI/2 || ang < -Math.PI/2) ctx.rotate(Math.PI);
      ctx.font = "bold 11px Arial";
      ctx.fillStyle = "#003d2e"; ctx.textAlign = "center";
      ctx.fillText(`${s.label} (${s.ft}ft)`, 0, -6);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(p2.x+ox, p2.y+oy, 3.5, 0, Math.PI*2);
      ctx.fillStyle = G; ctx.fill();
    });

    let a = 0;
    for (let i=0; i<pts.length-1; i++)
      a += pts[i].x*pts[i+1].y - pts[i+1].x*pts[i].y;
    const ft2 = Math.abs(a)/2 / (sc*sc);
    setArea({ ft2, sqm:ft2*0.0929, sha:ft2/435.6, katha:ft2/720, bigha:ft2/14400 });
  }, [sides, zoom]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const h = () => draw();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [draw]);

  const today = new Date().toLocaleDateString("bn-BD", {year:"numeric", month:"long", day:"numeric"});
  const m = SURVEY_META[surveyType];
  const sc = SCALE_PRESETS[scaleKey] || SCALE_PRESETS.custom;
  const barPx = Math.min(sc.barFt * zoom, 110);

  const S = {
    root:     { display:"flex", fontFamily:"'Hind Siliguri', sans-serif", background:"#e8ede9", minHeight:"100vh", fontSize:13 },
    panel:    { width:460, minWidth:460, background:"#fff", height:"100vh", position:"sticky", top:0, overflowY:"auto", boxShadow:"3px 0 18px rgba(0,106,78,.13)", flexShrink:0 },
    pHead:    { background:G, color:"#fff", padding:"13px 18px", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8, position:"sticky", top:0, zIndex:10 },
    pBody:    { padding:"14px 16px" },
    secTitle: { fontSize:10, fontWeight:700, color:G, textTransform:"uppercase", letterSpacing:1, margin:"14px 0 8px", paddingBottom:4, borderBottom:`2px solid ${GL}` },
    row2:     { display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 },
    row3:     { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:8 },
    preview:  { flex:1, padding:24, display:"flex", justifyContent:"center", alignItems:"flex-start" },
    a4:       { width:"210mm", minHeight:"297mm", background:"#fff", padding:"8mm 10mm", boxShadow:"0 4px 30px rgba(0,0,0,.18)", display:"flex", flexDirection:"column" },
    tabBtn:   (a) => ({ flex:1, padding:"7px 0", border:`2px solid ${a?G:"#ddd"}`, borderRadius:6, background:a?G:"#f5f5f5", color:a?"#fff":"#777", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit" }),
    shapeBtn: (a) => ({ padding:"7px 4px", border:`2px solid ${a?G:"#ddd"}`, borderRadius:6, background:a?GL:"#f9f9f9", color:a?G:"#555", cursor:"pointer", fontWeight:600, fontSize:11, textAlign:"center", fontFamily:"inherit" }),
    addBtn:   { width:"100%", padding:"7px 0", background:GL, color:G, border:`1.5px dashed ${G}`, borderRadius:6, cursor:"pointer", fontWeight:700, fontSize:12, marginBottom:6, fontFamily:"inherit" },
    delBtn:   { width:26, height:26, background:"#fff", color:"#c0392b", border:"1px solid #e0c0c0", borderRadius:5, cursor:"pointer", fontWeight:900, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
    drawBtn:  { width:"100%", padding:10, background:G, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontWeight:700, fontSize:13, marginTop:8, fontFamily:"inherit" },
    printBtn: { width:"100%", padding:11, background:"#1a1a1a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontWeight:700, fontSize:13, marginTop:6, fontFamily:"inherit" },
    resetBtn: { width:"100%", padding:7, background:"#fff", color:"#999", border:"1px solid #ddd", borderRadius:6, cursor:"pointer", fontSize:11, marginTop:4, fontFamily:"inherit" },
  };

  return (
    <div style={S.root}>
      <div style={S.panel}>
        <div style={S.pHead}>🗺 বাংলাদেশ ভূমি জরিপ — নকশা কনফিগারেশন</div>
        <div style={S.pBody}>

          <div style={S.secTitle}>📋 জরিপের ধরন</div>
          <div style={{display:"flex", gap:6, marginBottom:12}}>
            {["RS","CS","BS","SA"].map(t => (
              <button key={t} style={S.tabBtn(surveyType===t)} onClick={()=>setSurveyType(t)}>{t} জরিপ</button>
            ))}
          </div>

          <div style={S.secTitle}>🏛 প্রতিষ্ঠানের তথ্য</div>
          <div style={{marginBottom:8}}><label style={lbl}>প্রতিষ্ঠানের নাম</label><input style={inp} value={f.hTitle} onChange={fld("hTitle")} /></div>
          <div style={S.row3}>
            <div><label style={lbl}>মোবাইল</label><input style={inp} value={f.hPhone} onChange={fld("hPhone")} /></div>
            <div><label style={lbl}>রেজিস্ট্রেশন</label><input style={inp} value={f.hReg} onChange={fld("hReg")} /></div>
            <div><label style={lbl}>লাইসেন্স</label><input style={inp} value={f.hLic} onChange={fld("hLic")} /></div>
          </div>

          <div style={S.secTitle}>📄 জমির রেকর্ড তথ্য</div>
          <div style={S.row2}>
            <div><label style={lbl}>খতিয়ান নং</label><input style={inp} value={f.khatianNo} onChange={fld("khatianNo")} /></div>
            <div><label style={lbl}>দাগ নং</label><input style={inp} value={f.dagNo} onChange={fld("dagNo")} /></div>
          </div>
          <div style={S.row3}>
            <div><label style={lbl}>মৌজা</label><input style={inp} value={f.moujaName} onChange={fld("moujaName")} /></div>
            <div><label style={lbl}>উপজেলা</label><input style={inp} value={f.upojelaName} onChange={fld("upojelaName")} /></div>
            <div><label style={lbl}>জেলা</label><input style={inp} value={f.jelaName} onChange={fld("jelaName")} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={lbl}>বিভাগ</label><input style={inp} value={f.bibhagName} onChange={fld("bibhagName")} /></div>
            <div><label style={lbl}>জরিপ বর্ষ</label><input style={inp} value={f.srvYear} onChange={fld("srvYear")} /></div>
          </div>
          <div style={{marginBottom:8}}><label style={lbl}>মালিকের বিস্তারিত</label>
            <textarea style={{...inp, resize:"vertical"}} rows={2} value={f.ownerDetails} onChange={fld("ownerDetails")} />
          </div>

          <div style={S.secTitle}>📐 স্কেল সিস্টেম</div>
          <div style={{background:GL, border:"1px solid #b5d9ce", borderRadius:6, padding:10, marginBottom:8}}>
            <label style={{...lbl, color:G}}>প্রিসেট স্কেল</label>
            <select style={inp} value={scaleKey} onChange={e=>applyScale(e.target.value)}>
              <option value="custom">কাস্টম</option>
              <optgroup label="সরকারি স্কেল">
                <option value="16_1mile">16 ইঞ্চি = 1 মাইল (RS/CS)</option>
                <option value="32_1mile">32 ইঞ্চি = 1 মাইল</option>
                <option value="8_1mile">8 ইঞ্চি = 1 মাইল</option>
                <option value="4_1mile">4 ইঞ্চি = 1 মাইল</option>
              </optgroup>
              <optgroup label="মেট্রিক">
                <option value="1_500">1:500</option>
                <option value="1_1000">1:1000</option>
                <option value="1_2000">1:2000</option>
                <option value="1_5000">1:5000</option>
              </optgroup>
              <option value="link">1 ইঞ্চি = 1 চেইন</option>
            </select>
            <div style={{fontSize:10, color:"#558878", marginTop:5}}>{sc.label} | px/ft: {zoom.toFixed(2)}</div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={lbl}>ফাইন-টিউন: {zoom.toFixed(2)}</label>
            <input type="range" min={0.5} max={150} step={0.01} value={zoom} style={{width:"100%"}}
              onChange={e=>{ setZoom(+e.target.value); setScaleKey("custom"); }} />
          </div>

          <div style={S.secTitle}>🔷 জমির আকৃতি</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:10}}>
            {[["quad","▭","চতুর্ভুজ"],["tri","△","ত্রিভুজ"],["irr","⬠","অনিয়মিত"],["lshape","⌐","L-আকৃতি"]].map(([k,icon,name])=>(
              <button key={k} style={S.shapeBtn(shape===k)} onClick={()=>loadShape(k)}>
                <span style={{fontSize:18, display:"block", marginBottom:3}}>{icon}</span>{name}
              </button>
            ))}
          </div>

          <div style={S.secTitle}>📏 বাহুর মাপ</div>
          <div style={{display:"grid", gridTemplateColumns:"26px 1.4fr 0.8fr 0.8fr 0.8fr 28px", gap:4, fontSize:9, fontWeight:700, color:"#888", textAlign:"center", marginBottom:4}}>
            <span>#</span><span>নাম</span><span>ফুট★</span><span>লিংক</span><span>কোণ°</span><span></span>
          </div>
          {sides.map((s,i)=>(
            <div key={s.id} style={{display:"grid", gridTemplateColumns:"26px 1.4fr 0.8fr 0.8fr 0.8fr 28px", gap:4, marginBottom:5, alignItems:"center"}}>
              <div style={{width:26,height:26,background:G,color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{i+1}</div>
              <input style={{...inp,padding:"5px 6px",fontSize:11}} value={s.label} onChange={e=>updateSide(s.id,"label",e.target.value)} />
              <input style={{...inp,padding:"5px 4px",fontSize:11,textAlign:"center",background:"#f0f8ff"}} type="number" value={s.ft} onChange={e=>updateSide(s.id,"ft",e.target.value)} />
              <input style={{...inp,padding:"5px 4px",fontSize:11,textAlign:"center",background:"#fffde8"}} type="number" value={s.links} onChange={e=>updateSide(s.id,"links",e.target.value)} />
              <input style={{...inp,padding:"5px 4px",fontSize:11,textAlign:"center",background:"#f0f4ff"}} type="number" value={s.ang} onChange={e=>updateSide(s.id,"ang",e.target.value)} />
              <button style={S.delBtn} onClick={()=>delSide(s.id)}>✕</button>
            </div>
          ))}
          <button style={S.addBtn} onClick={addSide}>+ বাহু যোগ করুন</button>

          <div style={S.secTitle}>🧭 চৌহদ্দি</div>
          <div style={{display:"grid", gridTemplateColumns:"0.8fr 1.5fr 28px", gap:4, fontSize:9, fontWeight:700, color:"#888", marginBottom:4}}>
            <span>দিক</span><span>সীমান্তবর্তী</span><span></span>
          </div>
          {chous.map(c=>(
            <div key={c.id} style={{display:"grid", gridTemplateColumns:"0.8fr 1.5fr 28px", gap:4, marginBottom:5, alignItems:"center"}}>
              <input style={{...inp,padding:"5px 6px",fontSize:11}} value={c.dir} onChange={e=>updateChou(c.id,"dir",e.target.value)} />
              <input style={{...inp,padding:"5px 6px",fontSize:11}} value={c.val} onChange={e=>updateChou(c.id,"val",e.target.value)} />
              <button style={S.delBtn} onClick={()=>delChou(c.id)}>✕</button>
            </div>
          ))}
          <button style={S.addBtn} onClick={addChou}>+ চৌহদ্দি যোগ করুন</button>

          <div style={S.secTitle}>⚙️ কার্যক্রম</div>
          <button style={S.drawBtn} onClick={draw}>🔄 নকশা রিফ্রেশ</button>
          <button style={S.printBtn} onClick={()=>window.print()}>🖨️ প্রিন্ট / PDF</button>
          <button style={S.resetBtn} onClick={()=>{ if(window.confirm("সব রিসেট করবেন?")){ loadShape("quad"); setChous(DEFAULT_CHOU.map(c=>({...c,id:uid()}))); }}}>↩ রিসেট</button>
        </div>
      </div>

      <div style={S.preview}>
        <div style={S.a4}>
          <div style={{textAlign:"center", paddingBottom:8, marginBottom:8, borderBottom:`3px double ${G}`}}>
            <span style={{display:"inline-block", padding:"2px 10px", borderRadius:3, fontSize:10, fontWeight:700, letterSpacing:1, border:`1.5px solid ${m.badge.border}`, background:m.badge.bg, color:m.badge.color, marginBottom:4}}>{m.label}</span>
            <div style={{fontFamily:"serif", color:G, fontSize:20, fontWeight:700, marginBottom:2}}>{f.hTitle}</div>
            <div style={{fontSize:10, color:"#555", fontWeight:600}}>মোবাইল: {f.hPhone} | {f.hReg} | {f.hLic}</div>
          </div>

          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", fontSize:10, marginBottom:6, background:"#f5faf8", border:"1px solid #d0e8df", borderRadius:4, overflow:"hidden"}}>
            {[["খতিয়ান নং",f.khatianNo],["দাগ নং",f.dagNo],["জরিপ বর্ষ",f.srvYear],["তারিখ",today]].map(([l,v])=>(
              <div key={l} style={{padding:"5px 7px", borderRight:"1px solid #d0e8df"}}>
                <span style={{color:G, fontSize:9, display:"block"}}>{l}</span>
                <span style={{color:"#222", fontSize:10, fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:6, padding:"4px 8px", background:G, borderRadius:4}}>
            {[["মৌজা",f.moujaName],["উপজেলা",f.upojelaName],["জেলা",f.jelaName],["বিভাগ",f.bibhagName]].map(([l,v],i)=>(
              <span key={l} style={{color:"#fff", fontSize:10, fontWeight:700}}>{i>0?"| ":""}{l}: <span style={{color:"#b8ffdf"}}>{v}</span></span>
            ))}
          </div>

          <div style={{fontSize:11, fontWeight:600, marginBottom:7, padding:"4px 7px", background:"#fffde8", borderLeft:`3px solid ${GOLD}`, color:"#333"}}>{f.ownerDetails}</div>

          <div ref={wrapRef} style={{flexGrow:1, border:"1.5px solid #333", background:"#fff", position:"relative", overflow:"hidden", minHeight:280}}>
            <canvas ref={canvasRef} style={{width:"100%", height:"100%", display:"block"}} />
            <div style={{position:"absolute",top:8,right:10,background:"#fff",border:`1.5px solid ${G}`,color:G,fontWeight:900,fontSize:12,padding:"2px 6px",borderRadius:3}}>N ↑</div>
            <div style={{position:"absolute",bottom:8,left:10,background:"rgba(255,255,255,.9)",padding:"3px 6px",border:"1px solid #999",fontSize:9,color:"#333"}}>
              <div style={{height:6,background:"linear-gradient(90deg,#000 50%,#fff 50%)",border:"1px solid #000",marginBottom:2,width:barPx}}></div>
              {sc.barFt} ফুট
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8,borderTop:`2px solid ${G}`,paddingTop:8}}>
            <div>
              <div style={{fontSize:12,color:G,fontWeight:700,marginBottom:5}}>চৌহদ্দি ও সীমানা:</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>
                  <th style={{background:G,color:"#fff",padding:"4px 6px",fontSize:10,textAlign:"left"}}>দিক</th>
                  <th style={{background:G,color:"#fff",padding:"4px 6px",fontSize:10,textAlign:"left"}}>সীমান্তবর্তী</th>
                </tr></thead>
                <tbody>
                  {chous.map((c,i)=>(
                    <tr key={c.id}>
                      <td style={{border:"1px solid #d0e8df",padding:"4px 6px",background:i%2?"#f5faf8":"#fff"}}><b>{c.dir}</b></td>
                      <td style={{border:"1px solid #d0e8df",padding:"4px 6px",background:i%2?"#f5faf8":"#fff"}}>{c.val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{background:GL,border:"1px solid #b5d9ce",borderRadius:4,padding:8,marginTop:8,fontSize:11,lineHeight:1.8,fontWeight:600}}>
                <div style={{fontSize:13,fontWeight:700,color:G}}>ক্ষেত্রফল:</div>
                <div>📐 <b>{area.ft2.toFixed(2)}</b> বর্গফুট | <b>{area.sqm.toFixed(2)}</b> বর্গমিটার</div>
                <div>🌾 <b>{area.sha.toFixed(4)}</b> শতাংশ | <b>{area.sha.toFixed(4)}</b> ডেসিমেল</div>
                <div>🏡 <b>{area.katha.toFixed(3)}</b> কাঠা | <b>{area.bigha.toFixed(4)}</b> বিঘা</div>
              </div>
              <div style={{fontSize:9,color:"#777",marginTop:4}}>স্কেল: {sc.label}</div>
            </div>
            <div style={{textAlign:"right",display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:8}}>
              <div style={{border:"2px dashed #bbb",borderRadius:"50%",width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#bbb",textAlign:"center",marginLeft:"auto"}}>অফিস সীল</div>
              <div style={{borderTop:"1.5px solid #333",paddingTop:4,fontSize:10,color:"#555",fontWeight:600,marginTop:30}}>তদন্তকারী সার্ভেয়ারের স্বাক্ষর</div>
              <div style={{borderTop:"1.5px solid #333",paddingTop:4,fontSize:10,color:"#555",fontWeight:600,marginTop:30}}>অনুমোদনকারী কর্মকর্তার স্বাক্ষর</div>
            </div>
          </div>

          <div style={{fontSize:9,color:"#999",textAlign:"center",marginTop:6,borderTop:"1px solid #eee",paddingTop:4}}>
            এই নকশা বাংলাদেশ ভূমি জরিপ অধিদপ্তরের নিয়মানুযায়ী প্রস্তুতকৃত। | {m.full} | মৌজা: {f.moujaName}
          </div>
        </div>
      </div>
    </div>
  );
}