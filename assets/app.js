const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
const pct=(v,d=2)=>v==null?"—":(Number(v)*100).toFixed(d)+"%";
const num=(v,d=2)=>v==null?"—":Number(v).toFixed(d);
function badge(s){
  const x=String(s||"").toUpperCase();
  let c="info";
  if(x.includes("PASS")||x==="FROZEN"||x==="HOLDOUT")c="good";
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
 const [d,p,bm]=await Promise.all([fetch("data/summary.json?ts="+Date.now()).then(r=>r.json()),fetch("data/performance.json?ts="+Date.now()).then(r=>r.json()),fetch("data/benchmarks.json?ts="+Date.now()).then(r=>r.json())]);
 $("#asof").textContent="PUBLIC · "+d.as_of;
 $("#topCards").innerHTML=[
  ["Production",d.production_strategy||"NONE","No Box strategy promoted yet"],
  ["Formalized",d.counts.formalized,"Migrated / registered lines"],
  ["Reconstruct",d.counts.reconstruct,"Historical lines to restore"],
  ["Forward",d.counts.forward,"Frozen challengers"],
  ["Holdout",d.counts.holdout,"Evidence packages"],
  ["Source",d.source_window,"Public-safe aggregate view"]
 ].map(x=>'<div class="card"><div class="label">'+x[0]+'</div><div class="value">'+x[1]+'</div><div class="small">'+x[2]+'</div></div>').join("");


 const chartLayout={
   paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",
   font:{color:"#cad5e7"},margin:{l:52,r:18,t:20,b:44},
   hovermode:"x unified",legend:{orientation:"h",y:1.08,x:0},
   xaxis:{gridcolor:"#182235"},yaxis:{gridcolor:"#182235"}
 };
 Plotly.newPlot("equityChart",[
   {x:p.series.top300.map(x=>x.date),y:p.series.top300.map(x=>x.equity),name:"Simple Core Top300",type:"scatter",mode:"lines"},
   {x:p.series.top500.map(x=>x.date),y:p.series.top500.map(x=>x.equity),name:"Simple Core Top500",type:"scatter",mode:"lines"},
   {x:p.benchmarks.SPY.series.map(x=>x.date),y:p.benchmarks.SPY.series.map(x=>x.equity),name:"SPY",type:"scatter",mode:"lines"},
   {x:p.benchmarks.QQQ.series.map(x=>x.date),y:p.benchmarks.QQQ.series.map(x=>x.equity),name:"QQQ",type:"scatter",mode:"lines"},
   {x:p.benchmarks.DIA.series.map(x=>x.date),y:p.benchmarks.DIA.series.map(x=>x.equity),name:"DIA",type:"scatter",mode:"lines"}
 ],{...chartLayout,yaxis:{...chartLayout.yaxis,title:"Normalized equity"}},{responsive:true,displaylogo:false});
 Plotly.newPlot("drawdownChart",[
   {x:p.drawdown.top300.map(x=>x.date),y:p.drawdown.top300.map(x=>x.drawdown*100),name:"Top300",type:"scatter",mode:"lines"},
   {x:p.drawdown.top500.map(x=>x.date),y:p.drawdown.top500.map(x=>x.drawdown*100),name:"Top500",type:"scatter",mode:"lines"},
   {x:p.benchmarks.SPY.series.map(x=>x.date),y:p.benchmarks.SPY.series.map(x=>x.drawdown*100),name:"SPY",type:"scatter",mode:"lines"},
   {x:p.benchmarks.QQQ.series.map(x=>x.date),y:p.benchmarks.QQQ.series.map(x=>x.drawdown*100),name:"QQQ",type:"scatter",mode:"lines"},
   {x:p.benchmarks.DIA.series.map(x=>x.date),y:p.benchmarks.DIA.series.map(x=>x.drawdown*100),name:"DIA",type:"scatter",mode:"lines"}
 ],{...chartLayout,yaxis:{...chartLayout.yaxis,title:"Drawdown %",ticksuffix:"%"}},{responsive:true,displaylogo:false});
 const m300=Object.fromEntries(p.monthly.top300.map(x=>[x.month,x.return]));
 const m500=Object.fromEntries(p.monthly.top500.map(x=>[x.month,x.return]));
 const mspy=Object.fromEntries(p.benchmarks.SPY.monthly.map(x=>[x.month,x.return]));
 const mqqq=Object.fromEntries(p.benchmarks.QQQ.monthly.map(x=>[x.month,x.return]));
 const mdia=Object.fromEntries(p.benchmarks.DIA.monthly.map(x=>[x.month,x.return]));
 const months=[...new Set([...Object.keys(m300),...Object.keys(m500),...Object.keys(mspy),...Object.keys(mqqq),...Object.keys(mdia)])].sort();
 $("#monthlyTable").innerHTML=table(months.map(m=>({month:m,a:m300[m],b:m500[m],spy:mspy[m],qqq:mqqq[m],dia:mdia[m]})),[
   ["Month",r=>r.month],["Top300",r=>pct(r.a)],["Top500",r=>pct(r.b)],["SPY",r=>pct(r.spy)],["QQQ",r=>pct(r.qqq)],["DIA",r=>pct(r.dia)]
 ]);
 $("#efficiencyTable").innerHTML=table([
   {name:"Simple Core Top300",ret:d.simple_core.transport.top300.total_return,exposure:d.simple_core.transport.top300.avg_exposure,eff:p.efficiency.top300},
   {name:"Simple Core Top500",ret:d.simple_core.transport.top500.total_return,exposure:d.simple_core.transport.top500.avg_exposure,eff:p.efficiency.top500},
   {name:"SPY",ret:p.benchmarks.SPY.total_return,exposure:1,eff:p.efficiency.SPY},
   {name:"QQQ",ret:p.benchmarks.QQQ.total_return,exposure:1,eff:p.efficiency.QQQ},
   {name:"DIA",ret:p.benchmarks.DIA.total_return,exposure:1,eff:p.efficiency.DIA}
 ],[
   ["Series",r=>r.name],["Total return",r=>pct(r.ret)],["Avg exposure",r=>pct(r.exposure)],["Return / exposure",r=>pct(r.eff)]
 ]);
 $("#performanceSnapshot").innerHTML=
   '<div class="metricgrid">'+[
    ["Top300 Total",pct(d.simple_core.transport.top300.total_return)],
    ["Top300 Max DD",pct(d.simple_core.transport.top300.max_drawdown)],
    ["Top300 Sharpe",num(d.simple_core.transport.top300.sharpe)],
    ["Top300 Exposure",pct(d.simple_core.transport.top300.avg_exposure)],
    ["Top500 Total",pct(d.simple_core.transport.top500.total_return)],
    ["Top500 Max DD",pct(d.simple_core.transport.top500.max_drawdown)],
    ["Top500 Sharpe",num(d.simple_core.transport.top500.sharpe)],
    ["Top500 Exposure",pct(d.simple_core.transport.top500.avg_exposure)]
   ].map(x=>'<div class="metric"><span class="small">'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>';
 $("#benchmarkNote").innerHTML='<b>Benchmark price returns</b><br>'+
   ['SPY','QQQ','DIA'].map(s=>s+' '+pct(p.benchmarks[s].total_return)+' · MDD '+pct(p.benchmarks[s].max_drawdown)).join('<br>')+
   '<br><span class="small">2026-04-01 → 2026-10-05 · '+p.benchmark_source+'.</span>';

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
   ["Simple Core",f.simple_core.status,f.simple_core.closed_trades+"/"+f.simple_core.trade_gate+" trades"],
   ["Gap Retest-Lift",f.gap_retest.status,f.gap_retest.closed_trades+" closed trades"],
   ["First eligible",f.simple_core.first_signal_date,"Post-freeze only"],
   ["Promotion gate",f.simple_core.month_gate+" months","AND "+f.simple_core.trade_gate+" closed trades"]
 ].map(x=>'<div class="card"><div class="label">'+x[0]+'</div><div class="value" style="font-size:19px">'+x[1]+'</div><div class="small">'+x[2]+'</div></div>').join("");
 $("#tradeProgress").style.width=Math.min(100,f.simple_core.closed_trades/f.simple_core.trade_gate*100)+"%";
 $("#monthProgress").style.width=Math.min(100,f.simple_core.months_observed/f.simple_core.month_gate*100)+"%";

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
