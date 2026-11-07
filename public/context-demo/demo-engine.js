(function (root) {
  'use strict';
  const definitions = {
    away: { gate:3, verify:5, last:6, cases:['retail','tech'] },
    lifecycle: { gate:5, verify:7, last:8, cases:['tech'] }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  function freshScenario(id) {
    return {step:0, approvals:Object.fromEntries(definitions[id].cases.map(c=>[c,false])), confirmations:Object.fromEntries(definitions[id].cases.map(c=>[c,false]))};
  }
  function createState() {
    return {active:'away',away:freshScenario('away'),lifecycle:freshScenario('lifecycle')};
  }
  function all(state,id,key) { return definitions[id].cases.every(c=>state[id][key][c]===true); }
  function status(state,id=state.active) {
    const d=definitions[id],s=state[id];
    return {step:s.step, total:d.last+1, approvalGate:s.step===d.gate&&!all(state,id,'approvals'), confirmationGate:s.step===d.verify&&!all(state,id,'confirmations'), finished:s.step===d.last};
  }
  function advance(state,id=state.active) {
    const v=status(state,id);if(v.approvalGate||v.confirmationGate||v.finished)return state;
    const next=clone(state);next[id].step++;return next;
  }
  function approve(state,caseId,reviewed,id=state.active) {
    const d=definitions[id];if(state[id].step!==d.gate||!d.cases.includes(caseId)||reviewed!==true)return state;
    const next=clone(state);next[id].approvals[caseId]=true;return next;
  }
  function invalidateApproval(state,caseId,id=state.active) {
    const d=definitions[id];if(!d.cases.includes(caseId)||!state[id].approvals[caseId])return state;
    const next=clone(state);next[id].approvals[caseId]=false;
    d.cases.forEach(c=>next[id].confirmations[c]=false);
    next[id].step=Math.min(next[id].step,d.gate);return next;
  }
  function confirm(state,id=state.active) {
    const d=definitions[id];if(state[id].step!==d.verify||!all(state,id,'approvals'))return state;
    const next=clone(state);d.cases.forEach(c=>next[id].confirmations[c]=true);return advance(next,id);
  }
  function reset(state,id=state.active) { const next=clone(state);next[id]=freshScenario(id);return next; }
  function restore(value) {
    const next=createState();if(!value||typeof value!=='object')return next;
    if(Object.hasOwn(definitions,value.active))next.active=value.active;
    for(const id of Object.keys(definitions)){
      const raw=value[id],d=definitions[id];if(!raw)continue;
      next[id].step=Number.isInteger(raw.step)?Math.max(0,Math.min(d.last,raw.step)):0;
      for(const c of d.cases)next[id].approvals[c]=next[id].step>=d.gate&&raw.approvals?.[c]===true;
      if(next[id].step>d.gate&&!all(next,id,'approvals'))next[id].step=d.gate;
      const confirmed=next[id].step===d.last&&d.cases.every(c=>raw.confirmations?.[c]===true);
      for(const c of d.cases)next[id].confirmations[c]=confirmed;
      if(next[id].step>d.verify&&!confirmed)next[id].step=d.verify;
    }
    return next;
  }
  const api={definitions,createState,status,advance,approve,invalidateApproval,confirm,reset,restore};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.DemoEngine=api;
})(globalThis);
