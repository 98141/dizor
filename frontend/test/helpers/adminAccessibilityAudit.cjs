"use strict";
// Browser-computed basic audit, not a claim of full WCAG conformance.
module.exports=function audit(){
 const rgba=value=>{const parts=value.match(/[\d.]+/g)?.map(Number);return parts?.length>=3?[...parts.slice(0,3),parts[3]??1]:[0,0,0,0];};
 const over=(a,b)=>{const alpha=a[3]+b[3]*(1-a[3]);return alpha?[...a.slice(0,3).map((v,i)=>(v*a[3]+b[i]*b[3]*(1-a[3]))/alpha),alpha]:b;};
 const background=e=>e?over(rgba(getComputedStyle(e).backgroundColor),background(e.parentElement)):[255,255,255,1];
 const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);};
 const text=[],controls=[];
 for(const e of document.querySelectorAll('.admin-shell *')){
  const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||s.opacity==='0'||e.closest('[hidden],[inert]')||e.disabled)continue;
  const own=[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
  if(own&&!['SCRIPT','STYLE','OPTION','SVG','PATH'].includes(e.tagName)){
   const bg=background(e),fg=over(rgba(s.color),bg),contrast=ratio(fg,bg),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700),required=large?3:4.5;
   if(contrast+.01<required)text.push({text:own.slice(0,80),class:String(e.className).slice(0,100),color:s.color,background:bg,contrast:+contrast.toFixed(2),required});
  }
  if(e.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),textarea,select')){const contrast=ratio(rgba(s.borderTopColor),background(e));if(contrast+.01<3)controls.push({name:e.name||e.id,contrast:+contrast.toFixed(2),border:s.borderTopColor});}
 }
 return {text,controls};
};
