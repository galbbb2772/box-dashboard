const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
const pct=(v,d=2)=>v==null?"—":(Number(v)*100).toFixed(d)+"%";
const num=(v,d=2)=>v==null?"—":Number(v).toFixed(d);
function badge(s){
  const x=String(s||"").toUpperCase();
  let c="info";
  if(x.includes("PASS")||x.includes("FROZEN")||x==="HOLDOUT"||x==="RECOVERED")c="good";
  if(x.includes("PENDING")||x.includes("AWAIT")||x==="RESEARCH"||x==="RECONSTRUCT"||x==="SHADOW")c="warn";
  if(x.includes("FAIL")||x.includes("REJECT")||x.includes("DO_NOT"))c="bad";
  return '<span class="status '+c+'">'+s+'</span>';
}
function table(rows,cols){
  return '<table><thead><tr>'+cols.map(c=>'<th>'+c[0]+'</th>').join('')+'</tr></thead><tbody>'+
  rows.map(r=>'<tr>'+cols.map(c=>'<td>'+c[1](r)+'</td>').join('')+'</tr>').join('')+
  '</tbody></table>';
}
(async()=>{
 const [d,rf,rflive]=await Promise.all([fetch("data/summary.json?ts="+Date.now()).then(r=>r.json()),fetch("data/robust_forward.json?ts="+Date.now()).then(r=>r.json()),fetch("data/robust_forward_live.json?ts="+Date.now()).then(r=>r.json())]);
 $("#asof").textContent="PUBLIC · "+d.as_of;
 $("#topCards").innerHTML=[
  ["Production",d.production_strategy||"NONE","No Box strategy promoted yet"],
  ["Formalized",d.counts.formalized,"Migrated / registered lines"],
  ["Research lines",d.counts.reconstruct,"Recovered / tracked lineages"],
  ["Forward",d.counts.forward,"Frozen challengers"],
  ["Holdout",d.counts.holdout,"Evidence packages"],
  ["Source",d.source_window,"Public-safe aggregate view"]
 ].map(x=>'<div class="card"><div class="label">'+x[0]+'</div><div class="value">'+x[1]+'</div><div class="small">'+x[2]+'</div></div>').join("");


 const chartLayout={
   paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",
   font:{color:"#cad5e7"},margin:{l:52,r:18,t:30,b:44},
   hovermode:"x unified",legend:{orientation:"h",y:1.12,x:0},
   dragmode:"pan",
   xaxis:{gridcolor:"#182235"},
   yaxis:{gridcolor:"#182235",fixedrange:true}
 };
 const plotConfig={
   responsive:true,
   displaylogo:false,
   displayModeBar:false,
   scrollZoom:true,
   doubleClick:"reset"
 };
 const laneLabel=(lane)=>lane.id+" · "+lane.name.replace(/^\+\s*/,"");
 const laneTraces=(valueFn,mode="lines+markers")=>rflive.lanes.map(lane=>({
   x:lane.series.map(r=>r.date),
   y:lane.series.map(valueFn),
   name:laneLabel(lane),
   type:"scatter",
   mode,
   line:{width:2},
   marker:{size:5},
   hovertemplate:"%{x}<br>%{fullData.name}<br>%{y:.4f}<extra></extra>"
 }));

 const allDates=[...new Set(rflive.lanes.flatMap(l=>l.series.map(r=>r.date)))].sort();
 const dateMs=allDates.map(x=>Date.parse(x+"T00:00:00Z")).filter(Number.isFinite);
 const boundaryMs=Date.parse(rflive.official_signal_boundary+"T00:00:00Z");
 const dataMin=dateMs.length?dateMs[0]:boundaryMs;
 const dataMax=dateMs.length?dateMs[dateMs.length-1]:boundaryMs;
 const oneDay=86400000;
 // Plotly cannot scale an axis whose lower and upper bounds are identical.
 // Until a second Forward observation arrives, render a narrow padded window
 // around the freeze boundary. Once more dates exist, hard bounds become the
 // actual saved Forward interval.
 const hardMin=(dataMax>dataMin)?dataMin:(dataMin-oneDay);
 const hardMax=(dataMax>dataMin)?dataMax:(dataMax+oneDay);
 const minVisible=Math.max(1,Math.min(Number(rflive.min_visible_points||10),Math.max(1,dateMs.length)));
 const toIso=(ms)=>new Date(ms).toISOString().slice(0,10);
 function parseRangeValue(v,fallback){
   const t=Date.parse(String(v));
   return Number.isFinite(t)?t:fallback;
 }
 function clampRange(a,b){
   let lo=parseRangeValue(a,hardMin);
   let hi=parseRangeValue(b,hardMax);
   if(lo>hi){const z=lo;lo=hi;hi=z}
   lo=Math.max(hardMin,lo);
   hi=Math.min(hardMax,hi);
   if(hi<=lo){
     const center=Math.min(hardMax,Math.max(hardMin,(lo+hi)/2||dataMin));
     lo=Math.max(hardMin,center-oneDay/2);
     hi=Math.min(hardMax,center+oneDay/2);
     if(hi<=lo){lo=hardMin;hi=hardMax}
   }
   if(dateMs.length>=minVisible && minVisible>1){
     const visible=dateMs.filter(t=>t>=lo&&t<=hi).length;
     if(visible<minVisible){
       const center=(lo+hi)/2;
       let nearest=0,best=Infinity;
       dateMs.forEach((t,i)=>{const q=Math.abs(t-center);if(q<best){best=q;nearest=i}});
       let s=Math.max(0,nearest-Math.floor((minVisible-1)/2));
       s=Math.min(s,dateMs.length-minVisible);
       lo=dateMs[s];
       hi=dateMs[s+minVisible-1];
       if(hi<=lo){lo=Math.max(hardMin,lo-oneDay/2);hi=Math.min(hardMax,hi+oneDay/2)}
     }
   }
   return [toIso(lo),toIso(hi)];
 }
 const initialRange=[toIso(hardMin),toIso(hardMax)];
 // Bounds are enforced in plotly_relayout rather than minallowed/maxallowed so
 // the dashboard works consistently on the pinned Plotly build and mobile.
 const xaxisBase={...chartLayout.xaxis,range:initialRange};

 const equityTraces=laneTraces(r=>Number(r.equity));
 const ddTraces=laneTraces(r=>Number(r.drawdown_pct));
 const capitalTraces=laneTraces(r=>100000*Number(r.equity));

 Plotly.newPlot("equityChart",equityTraces,{
   ...chartLayout,
   xaxis:{...xaxisBase,title:"U.S. market date"},
   yaxis:{...chartLayout.yaxis,title:"Normalized equity"}
 },plotConfig);
 Plotly.newPlot("drawdownChart",ddTraces,{
   ...chartLayout,
   xaxis:{...xaxisBase,title:"U.S. market date"},
   yaxis:{...chartLayout.yaxis,title:"Drawdown %",ticksuffix:"%"}
 },plotConfig);
 Plotly.newPlot("capitalChart",capitalTraces,{
   ...chartLayout,
   xaxis:{...xaxisBase,title:"U.S. market date"},
   yaxis:{...chartLayout.yaxis,title:"Account value",tickprefix:"$"}
 },plotConfig);

 let syncing=false;
 const chartIds=["equityChart","drawdownChart","capitalChart"];
 function setRange(range){
   if(syncing)return;
   syncing=true;
   Promise.all(chartIds.map(id=>Plotly.relayout(id,{"xaxis.range":range})))
     .finally(()=>{syncing=false});
 }
 function resetCharts(){
   setRange([toIso(hardMin),toIso(hardMax)]);
   $$(".rangebtn").forEach(b=>b.classList.toggle("active",b.dataset.range==="ALL"));
 }
 function handleRelayout(ev){
   if(syncing)return;
   if(ev["xaxis.autorange"]){
     resetCharts(); return;
   }
   const a=ev["xaxis.range[0]"],b=ev["xaxis.range[1]"];
   if(a!=null&&b!=null){
     const range=clampRange(a,b);
     setRange(range);
     $$(".rangebtn").forEach(x=>x.classList.remove("active"));
   }
 }
 chartIds.forEach(id=>{
   const el=document.getElementById(id);
   if(el&&el.on)el.on("plotly_relayout",handleRelayout);
 });
 $$(".rangebtn[data-range]").forEach(btn=>btn.addEventListener("click",()=>{
   const key=btn.dataset.range;
   if(key==="ALL"){resetCharts();return}
   const days=key==="1M"?30:90;
   const range=clampRange(toIso(dataMax-days*oneDay),toIso(dataMax));
   setRange(range);
   $$(".rangebtn").forEach(x=>x.classList.toggle("active",x===btn));
 }));
 const resetBtn=$("#resetForwardCharts");
 if(resetBtn)resetBtn.addEventListener("click",resetCharts);

 const latestRows=rflive.lanes.map(lane=>{
   const s=lane.series||[];
   const last=s[s.length-1]||{equity:1,drawdown_pct:0,gross_exposure_pct:0,open_positions:0,closed_trades_cum:0,date:rflive.official_signal_boundary};
   const mdd=s.length?Math.min(...s.map(r=>Number(r.drawdown_pct)||0)):0;
   return {id:lane.id,name:lane.name,role:lane.role,last,mdd};
 });
 $("#performanceSnapshot").innerHTML='<div class="metricgrid">'+latestRows.map(x=>
   '<div class="metric"><span class="small">'+x.id+' · '+x.role+'</span><b>'+((Number(x.last.equity)-1)*100).toFixed(2)+'%</b>'+
   '<span class="small">MDD '+x.mdd.toFixed(2)+'% · Gross '+Number(x.last.gross_exposure_pct||0).toFixed(1)+'% · '+x.last.date+'</span></div>'
 ).join('')+'</div>';
 $("#benchmarkNote").innerHTML='<b>Prospective Forward only</b><br>Signal boundary: '+rflive.official_signal_boundary+
   ' · earliest entry: '+rflive.earliest_official_entry+
   ' · last processed: '+(rflive.last_processed_market_date||"waiting for first close")+
   '.<br><span class="small">All six lanes start from normalized equity 1.0000 and share the same untouched market observations.</span>';

 $("#periodComparison").innerHTML=table(rf.lanes,[
   ["Lane",r=>r.id],
   ["Role",r=>r.role||"—"],
   ["BOX system",r=>r.name],
   ["Research-forward return",r=>Number(r.research_forward_return_pct).toFixed(2)+"%"],
   ["Forward Max DD",r=>Number(r.research_forward_mdd_pct).toFixed(2)+"%"],
   ["Forward Sharpe",r=>r.research_forward_sharpe==null?"—":Number(r.research_forward_sharpe).toFixed(2)]
 ]);

 $("#strategyTable").innerHTML=table(d.strategies,[
  ["ID",r=>r.id],["Strategy",r=>r.name],["Role",r=>r.role],["Status",r=>badge(r.status)],["Evidence",r=>r.evidence]
 ]);

 const t=d.simple_core.transport;
 $("#transportMetrics").innerHTML=
  '<div class="metricgrid">'+[
   ["Top300 Return",pct(t.top300.total_return)],["Top300 Max DD",pct(t.top300.max_drawdown)],
   ["Top300 Sharpe",num(t.top300.sharpe)],["Top300 Trades",t.top300.completed_trades],
   ["Top500 Return",pct(t.top500.total_return)],["Top500 Max DD",pct(t.top500.max_drawdown)],
   ["Top500 Sharpe",num(t.top500.sharpe)],["Top500 Trades",t.top500.completed_trades]
  ].map(x=>'<div class="metric"><span class="small">'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>';

 const max=Math.max(t.top300.total_return,t.top500.total_return);
 $("#universeBars").innerHTML=[
  ["Top300",t.top300.total_return,pct(t.top300.total_return)],
  ["Top500",t.top500.total_return,pct(t.top500.total_return)]
 ].map(x=>'<div class="barrow"><span>'+x[0]+'</span><div class="bar"><span style="width:'+Math.max(3,x[1]/max*100)+'%"></span></div><b>'+x[2]+'</b></div>').join("")+
 '<div class="note section">Transport holdout currently favors Top300 on return and Sharpe despite lower average exposure. This is evidence, not a production decision.</div>';

 const g=d.gap_retest;
 $("#gapEvidence").innerHTML=
   '<div class="value">'+g.primary_passed+'/'+g.primary_total+'</div>'+
   '<div class="small">Primary holdout checks passed</div>'+
   '<div class="section">'+badge(g.all_passed?"HOLDOUT PASS":"PARTIAL")+'</div>'+
   '<div class="section note">Gap Retest-Lift is frozen as a challenger. Public dashboard exposes only aggregate holdout evidence; thresholds and raw event details remain private.</div>';

 const f=d.forward;
 $("#forwardCards").innerHTML=[
   ["BOX research-forward",rf.research_forward_start+" → "+rf.research_forward_end,"Preserved diagnostic window"],
   ["Robust lanes",rf.lanes.length,"FWD-01 through FWD-06"],
   ["Pure prospective",rf.pure_prospective_signal_boundary,"Untouched Forward boundary"],
   ["Earliest entry",rf.earliest_pure_prospective_entry,"Pure prospective execution"]
 ].map(x=>'<div class="card"><div class="label">'+x[0]+'</div><div class="value" style="font-size:19px">'+x[1]+'</div><div class="small">'+x[2]+'</div></div>').join("");

 const robustTraces=[{
   x:rf.lanes.map(x=>x.id),
   y:rf.lanes.map(x=>x.research_forward_return_pct),
   text:rf.lanes.map(x=>x.name),
   type:"bar",
   hovertemplate:"%{x}<br>%{text}<br>Research-forward return: %{y:.2f}%<extra></extra>"
 }];
 Plotly.newPlot("robustForwardChart",robustTraces,{
   ...chartLayout,
   yaxis:{...chartLayout.yaxis,title:"Return % · 2026-04-01 → 2026-10-09",ticksuffix:"%"},
   xaxis:{...chartLayout.xaxis,title:"BOX cumulative lane"}
 },{responsive:true,displaylogo:false});

 $("#robustForwardTable").innerHTML=table(rf.lanes,[
   ["Lane",r=>r.id],
   ["Role",r=>r.role||"—"],
   ["BOX system",r=>r.name],
   ["Research-forward return",r=>Number(r.research_forward_return_pct).toFixed(2)+"%"],
   ["Forward Max DD",r=>Number(r.research_forward_mdd_pct).toFixed(2)+"%"],
   ["Forward Sharpe",r=>r.research_forward_sharpe==null?"—":Number(r.research_forward_sharpe).toFixed(2)],
   ["Combined ending x",r=>r.combined_ending_x==null?"—":Number(r.combined_ending_x).toFixed(2)+"x"],
   ["Evidence",r=>r.evidence]
 ]);
 $("#robustForwardBoundaryNote").innerHTML=
   '<b>BOX only.</b> Research-forward figures above use the preserved '+rf.research_forward_start+
   ' → '+rf.research_forward_end+' BOX window. The +10%/+11% figures belong here.<br>'+
   '<span class="small">'+rf.note+'</span>';
 $("#prospectiveBoundary").textContent=rf.pure_prospective_signal_boundary;
 $("#v4DisplayStart").textContent=rf.research_forward_start;

 const rp=d.recovered_programs||{};
 $("#recoveredPrograms").innerHTML=[
   rp.geometry_rc1 ? {
     title:"Geometry V3 RC1",
     status:rp.geometry_rc1.status,
     end:rp.geometry_rc1.historical_ending_multiple,
     mdd:rp.geometry_rc1.historical_max_drawdown_pct,
     pf:rp.geometry_rc1.historical_pf,
     trades:rp.geometry_rc1.closed_trades,
     rows:rp.geometry_rc1.true_prospective_rows_recovered,
     reconstructed:rp.geometry_rc1.reconstructed_oos_candidates||0,
     official:rp.geometry_rc1.official_live_rows||0,
     liveStart:rp.geometry_rc1.operational_live_signal_start||"—",
     market:rp.geometry_rc1.post_freeze_market_sessions_recovered||0,
     latest:rp.geometry_rc1.latest_recovered_market_date||"—",
     scanner:rp.geometry_rc1.scanner_status||"—",
     calibration:rp.geometry_rc1.scanner_calibration||"—",
     replay:rp.geometry_rc1.independent_replay_recovered ? "Exact replay engine recovered" : "Replay engine pending"
   } : null,
   rp.cross_scale_v1 ? {
     title:"Cross-Scale Episode V1",
     status:rp.cross_scale_v1.status,
     end:rp.cross_scale_v1.historical_ending_multiple,
     mdd:rp.cross_scale_v1.historical_max_drawdown_pct,
     pf:rp.cross_scale_v1.historical_pf,
     trades:null,
     rows:rp.cross_scale_v1.true_prospective_rows_recovered,
     reconstructed:rp.cross_scale_v1.reconstructed_oos_candidates||0,
     official:rp.cross_scale_v1.official_live_rows||0,
     liveStart:rp.cross_scale_v1.operational_live_signal_start||"—",
     market:rp.cross_scale_v1.post_freeze_market_sessions_recovered||0,
     latest:rp.cross_scale_v1.latest_recovered_market_date||"—",
     scanner:rp.cross_scale_v1.scanner_status||"—",
     calibration:rp.cross_scale_v1.scanner_calibration||"—",
     replay:"Append-only Forward guard recovered"
   } : null
 ].filter(Boolean).map(x=>
   '<div class="card">'+
   '<div class="label">'+x.title+'</div>'+
   '<div class="section">'+badge(x.status)+'</div>'+
   '<div class="metricgrid section">'+
     '<div class="metric"><span class="small">Historical ending</span><b>'+num(x.end,3)+'×</b></div>'+
     '<div class="metric"><span class="small">Historical Max DD</span><b>'+num(x.mdd,2)+'%</b></div>'+
     '<div class="metric"><span class="small">Trade PF</span><b>'+num(x.pf,2)+'</b></div>'+
     '<div class="metric"><span class="small">Official live rows</span><b>'+x.official+'</b></div>'+
     '<div class="metric"><span class="small">Reconstructed OOS</span><b>'+x.reconstructed+'</b></div>'+
     '<div class="metric"><span class="small">Post-freeze market sessions</span><b>'+x.market+'</b></div>'+
   '</div>'+
   '<div class="small section">'+x.replay+(x.trades!=null?' · '+x.trades+' closed historical trades':'')+
   '<br>Scanner: '+x.scanner+'<br>Calibration: '+x.calibration+'<br>Live signal start: '+x.liveStart+' · market through '+x.latest+'</div>'+
   '</div>'
 ).join("");

 $("#researchTable").innerHTML=table(d.reconstruct,[
   ["ID",r=>r.id],["Research line",r=>r.name],["Status",r=>badge(r.status)],["Next action",r=>r.next]
 ]);

 $("#gapTail").innerHTML=
  '<div class="value">'+d.gap_tail.passed_checks+'/'+d.gap_tail.total_checks+'</div>'+
  '<div class="small">Gap Tail factor checks passed</div>'+
  '<div class="section">'+badge(d.gap_tail.decision)+'</div>'+
  '<div class="section note">'+d.gap_tail.public_note+'</div>';

 $$(".tab").forEach(b=>b.onclick=()=>{
   $$(".tab").forEach(x=>x.classList.remove("active"));
   $$(".panel").forEach(x=>x.classList.remove("active"));
   b.classList.add("active");
   $("#"+b.dataset.tab).classList.add("active");
 });
})().catch(err=>{
 document.body.insertAdjacentHTML("beforeend",'<div class="wrap" style="color:#ff7d89">Dashboard load error: '+String(err)+'</div>');
});
