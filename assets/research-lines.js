(()=>{
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const num=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
  const pct=(v,d=2)=>Number.isFinite(Number(v))?num(v,d)+"%":"—";
  function renderLine(l){
    const hist=[
      ["研究线",l.name],
      ["分类",l.classification],
      ["历史区间",l.historical_start+" → "+l.historical_end],
      ["历史终点",num(l.historical_ending_x,6)+"×"],
      ["CAGR",pct(l.historical_cagr_pct)],
      ["最大回撤",pct(l.historical_mdd_pct)],
      ["Sharpe",num(l.historical_sharpe,3)],
      ["组合研究终点",num(l.combined_research_ending_x,6)+"×"],
      ["组合峰值",num(l.combined_peak_x,6)+"× · "+l.combined_peak_date]
    ];
    const fwd=[
      ["研究 Forward",l.research_forward_start+" → "+l.research_forward_end],
      ["区间收益",pct(l.research_forward_return_pct,3)],
      ["加速器触发次数",String(l.research_forward_accelerator_triggers)],
      ["直接 Forward 证据",l.direct_forward_evidence?"有":"无"],
      ["真正 Prospective Forward",l.true_prospective_forward_status]
    ];
    const table=rows=>'<table><tbody>'+rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>').join("")+'</tbody></table>';
    const h=document.getElementById("historicalResearchLineTable");if(h)h.innerHTML=table(hist)+'<div class="note section">'+esc(l.identity_note)+'</div>';
    const f=document.getElementById("researchShadowForwardTable");if(f)f.innerHTML=table(fwd)+'<div class="note section">2026年4–10月这条加速器本身0次触发；区间收益来自父级路径，因此不能当成该加速器已经通过 Forward 验证。</div>';
  }
  fetch("data/research_lines.json?x="+Date.now()).then(r=>{if(!r.ok)throw Error("research lines HTTP "+r.status);return r.json()}).then(d=>{
    const l=(d.lines||[]).find(x=>x.id==="A2-BROAD-PULLBACK-RISK-ACCELERATOR-V1");
    if(l)renderLine(l);
  }).catch(e=>{
    for(const id of ["historicalResearchLineTable","researchShadowForwardTable"]){const el=document.getElementById(id);if(el)el.innerHTML='<div class="empty">研究线数据读取失败：'+esc(e.message||e)+'</div>';}
  });
})();