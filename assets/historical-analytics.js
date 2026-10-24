/* Auditable historical and interval metrics for BOX six frozen lineages.
 * Reads saved observation points; never modifies equity data or treats research
 * results as independent post-freeze prospective evidence.
 * Benchmark source is existing Massive proxy snapshots ONLY where observed.
 */
(() => {
 "use strict";
 const laneIds=Array.from({length:6},(_,i)=>"FWD-"+String(i+1).padStart(2,"0"));
 const colors=["#7db7ff","#70d9b1","#ffc06b","#be9aff","#fa819c","#8bd3dd"];
 const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
 const YEAR_MS=365.2425*86400000, MIN_POINTS=10;
 const iso=ms=>new Date(ms).toISOString().slice(0,10);
 const ms=date=>Date.parse(date+"T00:00:00Z");
 const esc=x=>String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 const fmt=(x,d=2)=>x===null||x===undefined||!Number.isFinite(Number(x))?"—":Number(x).toFixed(d);
 const percent=(x,d=2)=>x===null||!Number.isFinite(x)?"—":fmt(x,d)+"%";
 const cash=(n)=>n==null?"—":Number(n).toLocaleString("zh-CN");
 const chartLayout={
   paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",
   font:{color:"#d0dbee"},margin:{l:70,r:15,t:25,b:54},
   legend:{orientation:"h",y:1.17,x:0},hovermode:"x unified",dragmode:"pan",
   xaxis:{type:"date",gridcolor:"#273345",title:"美股交易日"},
   yaxis:{gridcolor:"#273345"}
 };
 const chartConfig={responsive:true,displayModeBar:false,displaylogo:false,scrollZoom:false,doubleClick:false};
 let lanes=null, benchmarks=null, allDates=[], range=null, interacting=false, ready=false, lastSelected=null, historicalAudit=null;
 const monthDays={"1M":30,"3M":91,"6M":183,"12M":365,"1Y":365,"2Y":730,"3Y":1096};
 async function load(path){
   const r=await fetch(path+"?v="+Date.now(),{cache:"no-store"});
   if(!r.ok)throw Error(path+" HTTP "+r.status);
   return r.json();
 }
 function decode(src){
   if(!src || !src.n || !src.do || !src.eq)throw Error("缺失已保存的逐日历史净值");
   const d=Uint8Array.from(atob(src.do),c=>c.charCodeAt(0)),e=Uint8Array.from(atob(src.eq),c=>c.charCodeAt(0));
   if(d.length!==src.n*2||e.length!==src.n*8)throw Error(src.id+" 日期/净值字节数不匹配");
   const dd=new DataView(d.buffer),ee=new DataView(e.buffer),obs=[];
   for(let i=0;i<src.n;i++){
      const date=iso((src.base+dd.getUint16(i*2,true))*86400000),equity=ee.getFloat64(i*8,true);
      if(!Number.isFinite(equity)||equity<=0)throw Error(src.id+" 非正/无效净值 "+date);
      if(i&&obs[i-1].date>=date)throw Error(src.id+" 历史日期重复或逆序");
      obs.push({date,equity});
   }
   return {id:src.id,source:src.source,series:obs,byDate:new Map(obs.map(x=>[x.date,x.equity]))};
 }
 function getRangeDates(left,right){
   if(!allDates.length)throw Error("没有已核验历史观察日");
   const a=Math.max(0,allDates.findIndex(d=>d>=left));
   const b=allDates.findLastIndex(d=>d<=right);
   if(b<a||b<0)throw Error("所选日期没有历史交易日观察");
   if(b-a+1<MIN_POINTS)throw Error("最少需要连续 "+MIN_POINTS+" 个可验证历史观察日");
   return allDates.slice(a,b+1);
 }
 function clampIndexes(i,j){
   const n=allDates.length;
   i=Math.max(0,Math.min(n-1,i));
   j=Math.max(0,Math.min(n-1,j));
   if(i>j)[i,j]=[j,i];
   if(j-i+1<MIN_POINTS){
     const mid=Math.floor((i+j)/2),start=Math.max(0,Math.min(n-MIN_POINTS,mid-Math.floor(MIN_POINTS/2)));
     return [start,start+MIN_POINTS-1];
   }
   return [i,j];
 }
 function nearestIndex(time){
   if(!Number.isFinite(time))return 0;
   let low=0,hi=allDates.length-1;
   while(low<hi){const m=(low+hi)>>1;if(ms(allDates[m])<time)low=m+1;else hi=m}
   if(low>0&&Math.abs(ms(allDates[low-1])-time)<Math.abs(ms(allDates[low])-time))return low-1;
   return low;
 }
 function plotBounds(a,b){
   const n=allDates.length;
   let i=nearestIndex(ms(a)),j=nearestIndex(ms(b));
   [i,j]=clampIndexes(i,j);
   return [allDates[i],allDates[j]];
 }
 function analyze(obs){
   // Observed points only. First point is a display baseline, not an extra return day.
   const days=obs.length,returns=[];
   for(let i=1;i<days;i++)returns.push(obs[i].equity/obs[i-1].equity-1);
   const start=ms(obs[0].date),end=ms(obs.at(-1).date);
   const years=(end-start)/YEAR_MS;
   const total=100*(obs.at(-1).equity/obs[0].equity-1);
   const cagr=years>0?100*(Math.pow(obs.at(-1).equity/obs[0].equity,1/years)-1):null;
   let peak=obs[0].equity,mdd=0;
   for(const d of obs){peak=Math.max(peak,d.equity);mdd=Math.min(mdd,100*(d.equity/peak-1))}
   const pos=returns.filter(x=>x>1e-12).length,neg=returns.filter(x=>x< -1e-12).length;
   const flat=returns.length-pos-neg;
   const mean=returns.length?100*returns.reduce((a,b)=>a+b,0)/returns.length:null;
   const worst=returns.length?100*Math.min(...returns):null;
   const win=pos+neg?100*pos/(pos+neg):null;
   const avg=returns.length?returns.reduce((a,b)=>a+b,0)/returns.length:0;
   const sigma=returns.length>1?Math.sqrt(returns.reduce((v,x)=>v+(x-avg)**2,0)/(returns.length-1)):0;
   const sharpe=returns.length>1&&sigma>0?Math.sqrt(252)*avg/sigma:null; // rf=0 assumption
   let profitablePeriods=0,losingPeriods=0,maxWinStreak=0,maxLossStreak=0,winRun=0,lossRun=0;
   for(const r of returns){
     if(r>1e-12){if(winRun===0)profitablePeriods++;winRun++;lossRun=0;}
     else if(r< -1e-12){if(lossRun===0)losingPeriods++;lossRun++;winRun=0;}
     else{winRun=0;lossRun=0;}
     maxWinStreak=Math.max(maxWinStreak,winRun);
     maxLossStreak=Math.max(maxLossStreak,lossRun);
   }
   // Market observation spans many days. A non-flat NAV day does not prove a new order.
   return {start:obs[0].date,end:obs.at(-1).date,calendar:Math.round((end-start)/86400000)+1,
      marketDays:days,returnIntervals:returns.length,nonflat:pos+neg,pos,neg,flat,total,cagr,mdd,worst,mean,win,sharpe,
      profitablePeriods,losingPeriods,maxWinStreak,maxLossStreak,
      tradeDays:null,trades:null,tradeExpectancy:null,tradeWinRate:null};
 }
 function attachRecoveredPrefix(l,prefix){
   if(!prefix || !prefix.dates || !prefix.equity?.[l.id])return l;
   const values=prefix.equity[l.id];
   if(values.length!==prefix.dates.length)throw Error("恢复前缀长度不匹配："+l.id);
   const pre=prefix.dates.map((date,i)=>({date,equity:Number(values[i])}));
   if(!pre.length)return l;
   if(pre[0].date!=="2019-01-02" || Math.abs(pre[0].equity-1)>1e-12)
     throw Error("2019恢复曲线没有从1.0000开始："+l.id);
   if(pre.at(-1).date>=l.series[0].date)throw Error("恢复前缀与现有曲线日期重叠："+l.id);
   const series=pre.concat(l.series);
   for(let i=1;i<series.length;i++)if(series[i].date<=series[i-1].date)throw Error("拼接后日期异常："+l.id);
   return {...l,series,byDate:new Map(series.map(x=>[x.date,x.equity])),recoveredStart:pre[0].date,recoveredPrefixCount:pre.length};
 }
 function rowFor(l,dates){
   const first=dates[0],last=dates.at(-1);
   const obs=l.series.filter(x=>x.date>=first&&x.date<=last);
   if(obs.length<MIN_POINTS)throw Error("策略 "+l.id+" 在此区间缺少10个有效观测");
   return {id:l.id,stats:analyze(obs),obs,anchor:obs[0].equity};
 }
 function tableRows(rows, caption){
   if(!rows?.length)return '<div class="empty">暂无可验证区间</div>';
   const cols=[
     ["策略",v=>v.id],
     ["起止日",v=>v.stats.start+" → "+v.stats.end],
     ["日历天",v=>cash(v.stats.calendar)],
     ["观察交易日",v=>cash(v.stats.marketDays)],
     ["净值变动日",v=>cash(v.stats.nonflat)],
     ["实际成交日",v=>"未核验"],
     ["累计收益",v=>percent(v.stats.total)],
     ["CAGR",v=>percent(v.stats.cagr)],
     ["Sharpe*",v=>fmt(v.stats.sharpe)],
     ["最大回撤",v=>percent(v.stats.mdd)],
     ["最差单日",v=>percent(v.stats.worst)],
     ["盈利日",v=>cash(v.stats.pos)],
     ["亏损日",v=>cash(v.stats.neg)],
     ["持平日",v=>cash(v.stats.flat)],
     ["连续盈利段",v=>cash(v.stats.profitablePeriods)],
     ["连续亏损段",v=>cash(v.stats.losingPeriods)],
     ["最长盈利连续日",v=>cash(v.stats.maxWinStreak)],
     ["最长亏损连续日",v=>cash(v.stats.maxLossStreak)],
     ["上涨日占比*",v=>percent(v.stats.win)],
     ["日收益期望*",v=>percent(v.stats.mean,4)],
     ["交易胜率/单笔期望",v=>"交易账本不足"]
   ];
   return '<div class="tablewrap" style="max-height:none"><table><caption style="text-align:left;padding:8px;color:#b5c4d7">'+esc(caption)+'</caption><thead><tr>'+
     cols.map(x=>'<th>'+x[0]+'</th>').join("")+'</tr></thead><tbody>'+
     rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(c[1](r))+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
 }
 function traces(rows,field){
   return rows.map((r,i)=>({x:r.obs.map(x=>x.date),
       y:r.obs.map(x=>field==="equity"?x.equity/r.anchor:100*(x.equity/r.anchor-1)),
       name:r.id,type:"scatter",mode:"lines",line:{color:colors[i],width:2.3},
       hovertemplate:"%{x}<br>%{fullData.name}<br>%{y:."+ (field==="equity"?"4":"2")+"f}"+(field==="equity"?"×":"%")+"<extra></extra>"}));
 }
 function svgFallback(sel,series,label,unit){
   const el=$(sel),W=1100,H=390,left=78,right=25,top=32,bottom=48;
   const pts=series.flatMap(t=>t.x.map((date,i)=>[ms(date),Number(t.y[i])])).filter(v=>v.every(Number.isFinite));
   if(!pts.length){el.innerHTML='<div class="empty">缺少有效观察点</div>';return}
   const xmin=Math.min(...pts.map(v=>v[0])),xmax=Math.max(...pts.map(v=>v[0]));
   let ymin=Math.min(...pts.map(v=>v[1])),ymax=Math.max(...pts.map(v=>v[1]));
   const padding=(ymax-ymin||1)*0.08;ymin-=padding;ymax+=padding;
   const X=v=>left+(v-xmin)/(xmax-xmin||1)*(W-left-right);
   const Y=v=>H-bottom-(v-ymin)/(ymax-ymin)*(H-top-bottom);
   const lines=series.map((t,i)=>'<path fill="none" stroke="'+colors[i]+'" stroke-width="2.5" d="'+
      t.x.map((date,k)=>(k?"L":"M")+X(ms(date)).toFixed(2)+","+Y(t.y[k]).toFixed(2)).join(" ")+'"/>').join("");
   const ygrid=Array.from({length:5},(_,i)=>{const y=ymin+i*(ymax-ymin)/4;return '<line x1="'+left+'" y1="'+Y(y)+'" x2="'+(W-right)+'" y2="'+Y(y)+'" stroke="#344052"/><text x="'+(left-10)+'" y="'+(Y(y)+5)+'" fill="#aab9ce" text-anchor="end">'+y.toFixed(2)+unit+'</text>'}).join("");
   el.innerHTML='<svg style="width:100%;height:auto" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'">'+
       ygrid+lines+'<text x="'+left+'" y="'+(H-12)+'" fill="#c2cddd">'+iso(xmin)+'</text><text x="'+(W-right)+'" y="'+(H-12)+'" fill="#c2cddd" text-anchor="end">'+iso(xmax)+'</text></svg>'+
       '<div class="small">浏览器未加载 Plotly，已自动使用原生 SVG。使用上方日期范围按钮及输入框更改区间。</div>';
 }
 function marksAndRatio(){
   const start=allDates[0],end=allDates.at(-1);
   $("#historicalCoverage").innerHTML=
     '<b>当前曲线可见范围：</b>'+esc(start)+' → '+esc(end)+
     ' · FWD-01～04 已接入2019-01-02起的真实逐日历史；FWD-05/06因2019–2021逐日原件仍缺，曲线暂从2022-01-03开始。'+
     ' · 图表不会为缺失时期插值。所选区间内各策略各自从首个真实观察点归一化为1。';
 }
 function showOriginalMultipliers(){
   if(!historicalAudit||historicalAudit.historical_start!=="2019-01-02"||historicalAudit.historical_sessions!==1821)
     throw Error("2019原始回测起点审计缺失");
   const keys=new Map(historicalAudit.lanes.map(x=>[x.id,x]));
   const heading=["策略","2019-01-02初始资金","2026-03-31历史终值","真正历史CAGR","2026-10-09含研究Forward终值","2019逐日原件"];
   const rows=lanes.map(l=>{
     const a=keys.get(l.id);
     if(!a || !Number.isFinite(a.historical_end_x) || !Number.isFinite(a.historical_cagr_pct))
       throw Error("缺失原始2019历史统计："+l.id);
     const savedEnd=l.byDate.get("2026-10-09");
     if(!Number.isFinite(savedEnd)||Math.abs(savedEnd/a.combined_research_end_x-1)>0.0001)
       throw Error("截至2026-10-09存档历史曲线与2019回测收据不一致："+l.id);
     return [l.id,"1.0000×",fmt(a.historical_end_x,4)+"×",
       percent(a.historical_cagr_pct),fmt(a.combined_research_end_x,4)+"×",
       a.full_2019_daily_source_available?"已接入2019逐日折线":"尚缺，禁止插值"];
   });
   $("#originalMultipleTable").innerHTML=
     '<div class="small">原始回测：2019-01-02 → 2026-03-31，1,821个历史交易日；初始资本1.0000。 CAGR使用完整7.24日历年计算（ACT/365.2425）。研究Forward 2026-04-01 → 2026-10-09，另有133个交易日。</div>'+
     '<table><thead><tr>'+heading.map(v=>'<th>'+esc(v)+'</th>').join("")+'</tr></thead><tbody>'+
     rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
 }
  function setButtons(selected){
   $$("#historicalWindowPresets button").forEach(b=>b.classList.toggle("active",b.dataset.period===selected));
 }
 function constrainDateInputs(){
   const first=allDates[0],last=allDates.at(-1);
   for(const id of ["#historyStart","#historyEnd"]){
     $(id).min=first;$(id).max=last;
   }
 }
 function applyPeriod(period){
   const last=allDates.at(-1);
   if(period==="ALL"){render(allDates[0],last,"ALL");return}
   const n=monthDays[period];if(!n)return;
   const first=iso(Math.max(ms(allDates[0]),ms(last)-n*86400000));
   render(first,last,period);
 }
 function onPan(ev){
   if(interacting||!range)return;
   let a=ev["xaxis.range[0]"],b=ev["xaxis.range[1]"];
   if(ev["xaxis.autorange"]){render(allDates[0],allDates.at(-1),"ALL");return}
   if(a==null||b==null)return;
   const date1=String(a).slice(0,10),date2=String(b).slice(0,10);
   // Plotly mouse/touch pan must stay within saved observation dates.
   // Preserve selected width at the boundary instead of extending into future.
   const span=range[1]-range[0];
   let left=nearestIndex(ms(date1)),right=nearestIndex(ms(date2));
   if(Math.abs(span-(right-left))<=3){
     if(left<=0){left=0;right=Math.min(allDates.length-1,span)}
     if(right>=allDates.length-1){right=allDates.length-1;left=Math.max(0,right-span)}
   }
   [left,right]=clampIndexes(left,right);
   render(allDates[left],allDates[right],"CUSTOM").catch(e=>showError(e));
 }
 function showError(err){
   const el=$("#historySelectionError");if(el)el.textContent="数据或区间检查失败："+String(err.message||err);
 }
 async function drawCharts(selectedRows){
   const equity=traces(selectedRows,"equity"), returns=traces(selectedRows,"returns");
   // All selected lines originate at 1.0000 and 0.0000% respectively.
   for(const t of equity)if(Math.abs(t.y[0]-1)>1e-12)throw Error("历史策略净值起点不是 1："+t.name);
   const xLimits=[selectedRows[0].stats.start,selectedRows[0].stats.end];
   if(typeof Plotly!=="undefined"){
      const common={...chartLayout,xaxis:{...chartLayout.xaxis,range:xLimits}};
      await Plotly.react("historyEquityChart",equity,{...common,yaxis:{...chartLayout.yaxis,title:"归一化净值（首日 1.0000）",ticksuffix:"×"}},chartConfig);
      await Plotly.react("historyReturnChart",returns,{...common,yaxis:{...chartLayout.yaxis,title:"区间累计收益率",ticksuffix:"%"}},chartConfig);
      for(const id of ["historyEquityChart","historyReturnChart"]){
        const el=$("#"+id);
        if(!el._historyBound){el.on("plotly_relayout",onPan);el._historyBound=true}
      }
   }else{
      svgFallback("#historyEquityChart",equity,"历史净值","×");
      svgFallback("#historyReturnChart",returns,"历史累计收益率","%");
   }
 }
 async function render(start,end,preset){
   if(!lanes?.length)return;
   if(interacting)return;
   interacting=true;
   try{
      const [a,b]=plotBounds(start,end);
      const selectedDates=getRangeDates(a,b);
      const selectedRows=lanes.map(l=>rowFor(l,selectedDates));
      lastSelected=selectedRows;
      range=[allDates.indexOf(a),allDates.indexOf(b)];
      $("#historyStart").value=a;$("#historyEnd").value=b;
      $("#historyActiveWindow").textContent=a+" → "+b+" · "+selectedDates.length+" 个市场观察日";
      $("#historicalSelectionMetrics").innerHTML=tableRows(selectedRows,"所选区间（每条策略按区间首日净值=1独立计算）");
      setButtons(preset);
      $("#historySelectionError").textContent="";
      await drawCharts(selectedRows);
   }catch(e){showError(e);throw e}
   finally{interacting=false}
 }
 function benchmarkComparison(){
   if(!benchmarks || !lanes?.length)return;
   const symbols=["SPY","QQQ","DIA"],commonDates=allDates.filter(date=>
     symbols.every(s=>(benchmarks.benchmarks[s]?.series||[]).some(r=>r.date===date)) &&
     lanes.every(l=>l.byDate.has(date)));
   if(commonDates.length<MIN_POINTS){
      $("#historyBenchmarkSummary").innerHTML='<div class="empty">三大指数可比数据少于10个共同交易日，不进行比较或补造。</div>';
      return;
   }
   const first=commonDates[0],last=commonDates.at(-1);
   const strategies=lanes.map(l=>{
      const start=l.byDate.get(first),end=l.byDate.get(last);
      return {id:l.id,returnPct:100*(end/start-1),first,last,kind:"研究策略"};
   });
   const idx=symbols.map(symbol=>{
      const series=benchmarks.benchmarks[symbol].series;
      const m=new Map(series.map(x=>[x.date,Number(x.close)]));
      return {id:symbol,returnPct:100*(m.get(last)/m.get(first)-1),first,last,
              kind:symbol==="SPY"?"标普500ETF价格代理":symbol==="QQQ"?"纳斯达克100ETF价格代理":"道琼斯ETF价格代理"};
   });
   const rows=strategies.concat(idx);
   $("#historyBenchmarkSummary").innerHTML=
      '<div class="note">可核实共同区间：<b>'+first+" → "+last+"</b>，共 "+commonDates.length+
      ' 个共同日。来源：已保存 Massive 日线 ETF 价格数据（SPY、QQQ、DIA），属于价格回报代理，不含分红，不是指数全收益。'+
      '目前缺少 2022—2026 年完整同源指数历史，因此<b>没有</b>把这张同期对比冒称整个历史回测对比。</div>'+
      '<div class="tablewrap section"><table><thead><tr><th>策略或市场基准</th><th>类型</th><th>比较起点</th><th>比较终点</th><th>共同区间累计收益</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+esc(r.id)+'</td><td>'+esc(r.kind)+'</td><td>'+first+'</td><td>'+last+
       '</td><td>'+percent(r.returnPct)+'</td></tr>').join("")+'</tbody></table></div>';
   const traces=[];
   for(let i=0;i<lanes.length;i++){
      const l=lanes[i],base=l.byDate.get(first);
      traces.push({x:commonDates,y:commonDates.map(d=>100*(l.byDate.get(d)/base-1)),
        name:l.id,type:"scatter",mode:"lines",line:{color:colors[i],width:2}});
   }
   for(let i=0;i<symbols.length;i++){
      const symbol=symbols[i],m=new Map(benchmarks.benchmarks[symbol].series.map(x=>[x.date,Number(x.close)])),base=m.get(first);
      traces.push({x:commonDates,y:commonDates.map(d=>100*(m.get(d)/base-1)),
        name:symbol,type:"scatter",mode:"lines",line:{color:["#ffe3a0","#a8fdbe","#e8c0ff"][i],width:2.6,dash:"dash"}});
   }
   if(typeof Plotly!=="undefined"){
     Plotly.react("historyBenchmarkChart",traces,{...chartLayout,
        xaxis:{...chartLayout.xaxis,range:[first,last],fixedrange:true},
        yaxis:{...chartLayout.yaxis,title:"同期累计价格/策略收益（%）",ticksuffix:"%",fixedrange:true},
        dragmode:false
     },{...chartConfig,staticPlot:false}).catch(e=>showError(e));
   }else svgFallback("#historyBenchmarkChart",traces,"SPY QQQ DIA 同期比较","%");
 }
 function bind(){
   $("#historicalWindowPresets")?.addEventListener("click",e=>{
      const button=e.target.closest("button[data-period]");if(!button)return;
      applyPeriod(button.dataset.period);
   });
   $("#historyApply")?.addEventListener("click",()=>{
      try{
       const a=$("#historyStart").value,b=$("#historyEnd").value;
       if(!a||!b||a>b)throw Error("请选择有效的起止日期，开始不能晚于结束");
       render(a,b,"CUSTOM").catch(showError);
      }catch(e){showError(e)}
   });
   $$(".tabs button").forEach(b=>b.addEventListener("click",()=>{
      if(b.dataset.tab!=="timeline")return;
      setTimeout(()=>{if(ready&&lastSelected)drawCharts(lastSelected).catch(showError)},150);
   }));
 }
 bind();
 Promise.all([...laneIds.map(x=>load("data/history/"+x+".json")),load("data/benchmarks.json"),load("data/full_historical_audit.json"),load("data/history_prefix_2019_2021.json")]).then(async raw=>{
   lanes=raw.slice(0,6).map(decode);
   benchmarks=raw[6];historicalAudit=raw[7];
   const prefix=raw[8];
   if(JSON.stringify(lanes.map(l=>l.id))!==JSON.stringify(laneIds))throw Error("六条策略身份与顺序异常");
   lanes=lanes.map(l=>["FWD-01","FWD-02","FWD-03","FWD-04"].includes(l.id)?attachRecoveredPrefix(l,prefix):l);
   if(lanes.slice(0,4).some(l=>l.series[0].date!=="2019-01-02"))throw Error("FWD-01～04未真正接入2019曲线");
   // Navigation uses the longest verified daily lane. Shorter lanes simply begin
   // at their own first verified observation; missing history is never interpolated.
   allDates=lanes[0].series.map(x=>x.date);
   if(allDates.length<1800)throw Error("恢复后的历史观察点异常偏少");
   marksAndRatio();showOriginalMultipliers();constrainDateInputs();
   const fullRows=lanes.map(l=>rowFor(l,allDates));
   $("#historicalAllMetrics").innerHTML=tableRows(fullRows,"当前可验证逐日曲线：FWD-01～04为2019-01-02起；FWD-05/06暂为2022-01-03起。表内起止日就是每条线真正有数据的范围。");
   benchmarkComparison();
   await render(allDates[0],allDates.at(-1),"ALL");
   ready=true;
 }).catch(e=>{
   showError(e);
   const el=$("#historyEquityChart");
   if(el)el.innerHTML='<div class="empty">历史数据验证失败，停止展示以防误导：'+esc(e.message||e)+'</div>';
   console.error("BOX historical audit failure",e);
 });
})();
