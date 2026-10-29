/* BOX Dashboard: daily research-Forward timeline + separated paper trade blotter.
   The historical observation file contains exact stored daily equity observations.
   It must NOT be relabelled as clean prospective OOS or broker executions. */
(() => {
  "use strict";
  const $$ = (s) => [...document.querySelectorAll(s)];
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const finite = (v) => v !== null && v !== "" && Number.isFinite(Number(v));
  const number = (v, digits=2) => finite(v) ? Number(v).toFixed(digits) : "—";
  const usd = (v) => finite(v) ? "$" + number(v, 2) : "—";
  const ym = (v) => String(v||"").slice(0,10);
  const chartBase = {
    paper_bgcolor:"rgba(0,0,0,0)", plot_bgcolor:"rgba(0,0,0,0)",
    font:{color:"#cdd7e8"}, margin:{l:65,r:16,t:38,b:46},
    hovermode:"x unified", legend:{orientation:"h",y:1.19,x:0},
    xaxis:{gridcolor:"#172034",type:"date"}, yaxis:{gridcolor:"#172034"},
    dragmode:"pan"
  };
  const options={responsive:true,displaylogo:false,displayModeBar:true,scrollZoom:false};
  const laneIds=["FWD-01","FWD-02","FWD-03","FWD-04","FWD-05","FWD-06"];
  const colors=["#79b8ff","#68d8be","#ffc270","#c2a4ff","#f37b98","#8fd3e6"];
  const researchStart="2026-04-01";
  const frozenResearchEnd="2026-10-09";
  let researchReady=false, tradeReady=false, researchSet=null, tradeSet=null;
  let curveMode="ALL", tradeRows=[];

  async function json(url) {
    const response=await fetch(url+"?v="+Date.now(),{cache:"no-store"});
    if(!response.ok)throw new Error(url+" HTTP "+response.status);
    return response.json();
  }
  function decode(l) {
    if(!l)return {series:[]};
    if(Array.isArray(l.series))return l;
    if(!(l.do && l.eq && l.n))throw new Error("历史曲线缺少正式观察数据："+l.id);
    const d=Uint8Array.from(atob(l.do),c=>c.charCodeAt(0));
    const e=Uint8Array.from(atob(l.eq),c=>c.charCodeAt(0));
    if(d.byteLength !== l.n*2 || e.byteLength !== l.n*8)throw new Error("历史曲线长度错误："+l.id);
    const dv=new DataView(d.buffer),ev=new DataView(e.buffer),series=[];
    for(let i=0;i<l.n;i++){
      const day=l.base+dv.getUint16(i*2,true), equity=ev.getFloat64(i*8,true);
      const date=new Date(day*86400000).toISOString().slice(0,10);
      if(!Number.isFinite(equity)||equity<=0)throw new Error("净值不是有效正数："+l.id+" "+date);
      if(i>0&&date<=series[i-1].date)throw new Error("日期顺序错误："+l.id+" "+date);
      series.push({date,equity});
    }
    return {...l,series};
  }
  function textError(sel,e){
    const el=$(sel);
    if(el)el.innerHTML='<div class="empty bad">数据未能通过检查，图表不会使用估算值：'+esc(e.message||e)+'</div>';
  }
  function researchTraces(series,mode){
    return series.map((l,i)=>{
      const obs=l.series.filter(r=>r.date>=researchStart&&r.date<=frozenResearchEnd);
      if(!obs.length)throw new Error("研究期无真实净值记录："+l.id);
      let selected=obs;
      if(mode==="1M"||mode==="3M"){
        const end=new Date(obs.at(-1).date+"T00:00:00Z");
        const diff=mode==="1M"?30:90;
        const cutoff=new Date(end.getTime()-diff*86400000).toISOString().slice(0,10);
        selected=obs.filter(r=>r.date>=cutoff);
      }
      // REBASE EACH VISIBLE PERIOD INDEPENDENTLY. The stored daily P&L
      // curve remains immutable: only its plot y-values are changed.
      // Historical 2022, research Apr, official Oct all start at 1.0x.
      const anchor=Number(selected[0]?.equity);
      if(!Number.isFinite(anchor)||anchor<=0)throw new Error("研究期首日净值无效："+l.id);
      const x=selected.map(r=>r.date);
      const y=selected.map(r=>Number(r.equity)/anchor);
      if(Math.abs(y[0]-1)>1e-12)throw new Error("研究期净值基准不是1："+l.id);
      return {x,y,name:l.id,type:"scatter",mode:"lines",line:{width:2.1,color:colors[i]},
        hovertemplate:"%{x}<br>%{fullData.name}<br>区间归一化净值 %{y:.4f}×<extra></extra>"};
    });
  }
  function nativeSvgChart(selector,traces,title) {
    const width=1100,height=430,pad={left:68,right:18,top:48,bottom:48};
    const points=traces.flatMap(t=>t.x.map((date,i)=>({x:Date.parse(date),y:Number(t.y[i])}))).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    const el=$(selector);
    if(!el)return;
    if(!points.length){el.innerHTML='<div class="empty">暂无可验证的时间序列</div>';return}
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    if(xmax<=xmin)xmax=xmin+86400000;
    const range=(ymax-ymin)||1;ymin-=range*0.12;ymax+=range*0.12;
    const X=x=>pad.left+(x-xmin)/(xmax-xmin)*(width-pad.left-pad.right);
    const Y=y=>height-pad.bottom-(y-ymin)/(ymax-ymin)*(height-pad.top-pad.bottom);
    const grid=Array.from({length:6},(_,i)=>{
      const y=ymin+(ymax-ymin)*i/5;
      return '<line x1="'+pad.left+'" x2="'+(width-pad.right)+'" y1="'+Y(y)+'" y2="'+Y(y)+'" stroke="#29364a"/>'+
        '<text x="'+(pad.left-10)+'" y="'+(Y(y)+4)+'" fill="#99a8bd" text-anchor="end" font-size="13">'+y.toFixed(3)+'×</text>';
    }).join("");
    const paths=traces.map((t,i)=>{
      const d=t.x.map((date,j)=>[Date.parse(date),Number(t.y[j])]).filter(p=>p.every(Number.isFinite)).map((p,j)=>(j===0?'M':'L')+X(p[0]).toFixed(2)+','+Y(p[1]).toFixed(2)).join(' ');
      return '<path d="'+d+'" fill="none" stroke="'+colors[i]+'" stroke-width="2.7"/>'+
        '<text x="'+(pad.left+i*144)+'" y="34" fill="'+colors[i]+'" font-size="15">'+esc(t.name)+'</text>';
    }).join("");
    const dateText=ms=>new Date(ms).toISOString().slice(0,10);
    const svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(title)+'" style="width:100%;height:auto;max-height:460px">'+
      grid+paths+'<text x="'+pad.left+'" y="'+(height-12)+'" fill="#a8b5c9" font-size="14">'+dateText(xmin)+'</text>'+
      '<text x="'+(width-pad.right)+'" y="'+(height-12)+'" text-anchor="end" fill="#a8b5c9" font-size="14">'+dateText(xmax)+'</text>'+
      '</svg>';
    el.innerHTML=svg+'<p class="small">原生日线 SVG 曲线（Plotly 未加载）。折线来自保存的真实日期及净值点，不使用插值补点。</p>';
  }

  function prospectiveTraces(live){
    return (live.lanes||[]).map((l,i)=>{
      const rows=l.series||[];
      const anchor=Number(rows[0]?.equity);
      if(rows.length&&(!Number.isFinite(anchor)||anchor<=0))throw new Error("正式 Forward 基准错误："+l.id);
      return {x:rows.map(r=>r.date),y:rows.map(r=>Number(r.equity)/anchor),
        name:l.id,type:"scatter",mode:"lines+markers",line:{width:2.1,color:colors[i]},
        marker:{size:5},hovertemplate:"%{x}<br>%{fullData.name}<br>正式纸面 Forward %{y:.4f}×<extra></extra>"};
    });
  }
  async function renderResearch(){
    if(!researchSet)return;
    const panel=$("#timeline");
    if(!panel || !panel.classList.contains("on"))return;
    const {lanes,live}=researchSet;
    const endDates=lanes.map(l=>l.series.at(-1)?.date).filter(Boolean);
    const lastDataDate=endDates.sort().at(0);
    $("#timelineMeta").innerHTML=
      '<div class="metricgrid">'+
      '<div class="metric"><span class="small">研究期真实曲线</span><b>'+lanes.length+' 条</b></div>'+
      '<div class="metric"><span class="small">研究期截至</span><b>'+esc(lastDataDate)+'</b></div>'+
      '<div class="metric"><span class="small">正式 Forward 截至</span><b>'+esc(live.last_processed_market_date||"暂无")+'</b></div>'+
      '<div class="metric"><span class="small">正式交易事件</span><b>'+esc(live.official_trade_events||0)+'</b></div>'+
      '</div>';
    const traces=researchTraces(lanes,curveMode);
    if(typeof Plotly==="undefined") {
      nativeSvgChart("#researchTimelineChart",traces,"2026年4月—10月9日 BOX 六策略研究曲线");
    } else await Plotly.react("researchTimelineChart",traces,{...chartBase,
      title:{text:"2026年4月—10月9日 · 六策略区间净值（首日=1）",font:{size:15}},
      yaxis:{...chartBase.yaxis,title:"归一化净值（首日=1）",ticksuffix:"×"},
      xaxis:{...chartBase.xaxis,title:"美股交易日"}
    },options);
    const official=prospectiveTraces(live);
    const visible=official.some(t=>t.x.length>=2);
    if(visible){
      if(typeof Plotly==="undefined") {
        nativeSvgChart("#prospectiveTimelineChart",official,"2026年10月19日后正式纸面 Forward");
      } else await Plotly.react("prospectiveTimelineChart",official,{...chartBase,
        title:{text:"2026年10月19日以后 · 正式 Forward OOS（首日=1）",font:{size:15}},
        yaxis:{...chartBase.yaxis,title:"归一化净值（正式首日=1）",ticksuffix:"×"},
        xaxis:{...chartBase.xaxis,title:"美股交易日"}
      },options);
    }else $("#prospectiveTimelineChart").innerHTML='<div class="empty">正式 Forward 还没有足够的真实交易日观察。</div>';
    researchReady=true;
  }
  function tradeView(){
    if(!tradeSet)return;
    const universe=$("#tradeUniverse")?.value ||"ALL";
    const scale=$("#tradeScale")?.value||"ALL";
    const q=($("#tradeSearch")?.value||"").trim().toUpperCase();
    const rows=tradeSet.research.rows||[];
    tradeRows=rows.filter(r=>(universe==="ALL"||r.universe===universe)
      &&(scale==="ALL"||r.box_scale===scale)
      &&(!q||r.symbol.toUpperCase().includes(q)));

    const official=[...(tradeSet.official.rows||[])].sort((a,b)=>
      String(a.event_date).localeCompare(String(b.event_date)) ||
      String(a.lane_id||"").localeCompare(String(b.lane_id||""))
    );
    const asOf=tradeSet.official.as_of_market_date ||
      (official.length?official[official.length-1].event_date:"—");
    const lanes=["FWD-01","FWD-02","FWD-03","FWD-04","FWD-05","FWD-06"];
    const todayEvents=official.filter(r=>r.event_date===asOf);

    const open=new Map();
    const keyOf=r=>r.episode_id
      ? String(r.lane_id)+"|"+String(r.episode_id)
      : String(r.lane_id)+"|"+String(r.symbol)+"|"+String(r.entry_date||r.signal_date||r.event_date);
    official.forEach(r=>{
      const typ=String(r.event_type||"").toUpperCase();
      if(typ==="ENTRY"||typ==="ADD"||typ==="OPEN"){
        open.set(keyOf(r),r);
      }else if(typ==="EXIT"||typ==="CLOSE"||typ==="STOP"||typ==="TARGET"){
        if(r.episode_id) open.delete(keyOf(r));
        else{
          [...open.entries()].forEach(([k,v])=>{
            if(v.lane_id===r.lane_id&&v.symbol===r.symbol)open.delete(k);
          });
        }
      }
    });
    const openRows=[...open.values()].sort((a,b)=>
      String(a.lane_id||"").localeCompare(String(b.lane_id||"")) ||
      String(a.entry_date||"").localeCompare(String(b.entry_date||""))
    );

    $("#tradeSummary").innerHTML='<div class="metricgrid">'+
      '<div class="metric"><span class="small">最新已处理交易日</span><b>'+esc(asOf)+'</b></div>'+
      '<div class="metric"><span class="small">今日正式动作</span><b>'+todayEvents.length+'</b></div>'+
      '<div class="metric"><span class="small">当前开放持仓</span><b>'+openRows.length+'</b></div>'+
      '<div class="metric"><span class="small">正式 Forward 事件累计</span><b>'+official.length+'</b></div></div>';

    if($("#tradeAsOf")) $("#tradeAsOf").innerHTML='账本截至 <b>'+esc(asOf)+'</b> · 当日没有事件的 Lane 明确显示「无动作」。';
    const actionHeaders=["Lane","今日动作","标的","信号日","事件日","入场/离场价","仓位","备注"];
    const actionRows=lanes.map(lane=>{
      const ev=todayEvents.filter(r=>r.lane_id===lane);
      if(!ev.length)return [[lane,"无动作","—","—",asOf,"—","—",""]];
      return ev.map(r=>[
        lane,String(r.event_type||"—").toUpperCase(),r.symbol||"—",
        r.signal_date||"—",r.event_date||"—",
        String(r.event_type||"").toUpperCase()==="EXIT"?usd(r.exit_price):usd(r.entry_price),
        finite(r.capital_allocated_pct)?number(r.capital_allocated_pct,1)+"%":"—",
        r.mechanism||"Forward paper event"
      ]);
    }).flat();
    $("#todayActionTable").innerHTML='<table><thead><tr>'+actionHeaders.map(h=>'<th>'+esc(h)+'</th>').join("")+
      '</tr></thead><tbody>'+actionRows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table>';

    const posHeaders=["Lane","标的","入场日期","模型成本","仓位","风险预算","止损","目标","浮盈亏","状态"];
    $("#currentPositionTable").innerHTML=openRows.length
      ? '<table><thead><tr>'+posHeaders.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+
        openRows.map(r=>'<tr>'+[
          r.lane_id,r.symbol,r.entry_date||"—",usd(r.entry_price),
          finite(r.capital_allocated_pct)?number(r.capital_allocated_pct,1)+"%":"—",
          finite(r.risk_budget_pct)?number(r.risk_budget_pct,2)+"%":"—",
          usd(r.stop),usd(r.target),"—","持有中"
        ].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table>'
      : '<div class="empty">截至 '+esc(asOf)+'，正式 Forward 账本没有开放持仓。</div>';

    const header=["策略宇宙","代码","证券品种","箱体种类","信号日期","买入日期","买入价","卖出日期","卖出价","单笔净收益","离场原因","时间精度"];
    const cols=[r=>r.universe,r=>r.symbol,r=>r.asset_type,r=>r.box_scale,r=>r.signal_date,
      r=>r.entry_date,r=>usd(r.entry_price),r=>r.exit_date||"未记录",r=>usd(r.exit_price),
      r=>finite(r.net_return_pct)?number(r.net_return_pct,2)+"%":"—",
      r=>r.exit_reason||"—",r=>"日线日期"];
    const body=tradeRows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(c(r))+'</td>').join("")+'</tr>').join("");
    $("#researchTradeTable").innerHTML=tradeRows.length
      ? '<table><thead><tr>'+header.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+body+'</tbody></table>'
      : '<div class="empty">当前筛选条件下没有研究交易。</div>';

    const officialHeaders=["Lane","标的","动作","信号日期","进场日期","进场价","仓位","风险预算","止损","目标","离场日期","离场价","收益","离场原因"];
    const history=[...official].sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date))||String(a.lane_id||"").localeCompare(String(b.lane_id||"")));
    $("#officialTradeTable").innerHTML=history.length
      ? '<table><thead><tr>'+officialHeaders.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+
       history.map(r=>'<tr>'+[
         r.lane_id,r.symbol,String(r.event_type||"—").toUpperCase(),
         r.signal_date||"—",r.entry_date||"—",usd(r.entry_price),
         finite(r.capital_allocated_pct)?number(r.capital_allocated_pct,1)+"%":"—",
         finite(r.risk_budget_pct)?number(r.risk_budget_pct,2)+"%":"—",
         usd(r.stop),usd(r.target),r.exit_date||"—",usd(r.exit_price),
         finite(r.net_return_pct)?number(r.net_return_pct,2)+"%":"—",r.exit_reason||"—"
       ].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table>'
      : '<div class="empty">截至 '+esc(asOf)+'，FWD-01～06 尚无正式交易事件。</div>';
    tradeReady=true;
  }
  function exportVisibleCsv(){
    if(!tradeRows.length)return;
    const fields=["universe","symbol","asset_type","box_scale","signal_date","entry_date","entry_price","exit_date","exit_price","net_return_pct","exit_reason","time_precision"];
    const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const content=[fields.join(","),...tradeRows.map(r=>fields.map(k=>quote(r[k])).join(","))].join("\r\n")+"\r\n";
    const link=document.createElement("a");
    link.href=URL.createObjectURL(new Blob(["\ufeff",content],{type:"text/csv;charset=utf-8"}));
    link.download="BOX_research_trades_2026-04_to_10.csv";
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }
  function bind(){
    $("#timelineRange")?.addEventListener("click",e=>{
      const target=e.target.closest("button[data-period]");
      if(!target)return;
      curveMode=target.dataset.period;
      $$("#timelineRange button").forEach(b=>b.classList.toggle("active",b===target));
      renderResearch().catch(e=>textError("#researchTimelineChart",e));
    });
    ["#tradeUniverse","#tradeScale","#tradeSearch"].forEach(sel=>{
      $(sel)?.addEventListener(sel==="#tradeSearch"?"input":"change",tradeView);
    });
    $("#downloadResearchTrades")?.addEventListener("click",exportVisibleCsv);
    $$(".tabs button").forEach(b=>b.addEventListener("click",()=>{
      const id=b.dataset.tab;
      setTimeout(()=>{
        if(id==="timeline")renderResearch().catch(e=>textError("#researchTimelineChart",e));
        if(id==="trades")tradeView();
      },90);
    }));
  }
  bind();
  Promise.all([
    ...laneIds.map(id=>json("data/history/"+id+".json")),
    json("data/robust_forward_live.json"),json("data/trades_research.json"),json("data/trades_official.json")
  ]).then(all=>{
    const lanes=all.slice(0,6).map(decode);
    const ids=lanes.map(x=>x.id);
    if(JSON.stringify(ids)!==JSON.stringify(laneIds))throw new Error("曲线与六条冻结 Lane 的身份不匹配");
    researchSet={lanes,live:all[6]};
    tradeSet={research:all[7],official:all[8]};
    if($("#timeline")?.classList.contains("on"))
      requestAnimationFrame(()=>renderResearch().catch(e=>textError("#researchTimelineChart",e)));
    if($("#trades")?.classList.contains("on"))tradeView();
  }).catch(e=>{textError("#researchTimelineChart",e);textError("#researchTradeTable",e);console.error("BOX timeline/trade data rejected:",e)});
})();
