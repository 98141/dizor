"use strict";
// Runs in Chrome. Checks clipping ancestors, text bounds and hit targets, not just document width.
module.exports=function taxonomyActionVisibility(){
 const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const wrap=document.querySelector('.taxonomy-list-card .admin-table-wrap'),table=wrap?.querySelector('table');
 const actions=[...document.querySelectorAll('.taxonomy-list-card td.admin-table__actions button')].map(button=>{
  const r=rect(button),range=document.createRange();range.selectNodeContents(button);const label=rect(range);
  let left=0,right=innerWidth;
  const clippedBy=[];
  for(let parent=button.parentElement;parent;parent=parent.parentElement){
   if(['auto','scroll','hidden','clip'].includes(getComputedStyle(parent).overflowX)){
    const p=parent.getBoundingClientRect(),l=p.left+parent.clientLeft,rr=l+parent.clientWidth;
    left=Math.max(left,l);right=Math.min(right,rr);if(r.left<l-.5||r.right>rr+.5)clippedBy.push(parent.className||parent.tagName);
   }
  }
  const inBounds=r.width>0&&r.left>=left-.5&&r.right<=right+.5&&label.left>=left-.5&&label.right<=right+.5&&button.scrollWidth<=button.clientWidth+1;
  const hitPoints=[[r.left+3,r.top+3],[r.right-3,r.top+3],[r.left+3,r.bottom-3],[r.right-3,r.bottom-3],[r.left+r.width/2,r.top+r.height/2]];
  const visiblePoints=hitPoints.filter(([,y])=>y>=0&&y<innerHeight);
  const hittable=visiblePoints.length>0&&visiblePoints.every(([x,y])=>{const hit=document.elementFromPoint(x,y);return hit===button||button.contains(hit);});
  return {label:button.textContent.trim(),rect:r,text:label,complete:inBounds,hasViewportHitPoints:visiblePoints.length>0,hittable,clippedBy};
 });
 const headings=[...document.querySelectorAll('.taxonomy-list-card th')].filter(e=>getComputedStyle(e.closest('thead')).position!=='absolute').map(e=>{const range=document.createRange();range.selectNodeContents(e);const r=rect(range),w=wrap.getBoundingClientRect();return {text:e.textContent.trim(),complete:r.left>=w.left&&r.right<=w.right};});
 return {width:innerWidth,document:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.taxonomy-grid')).gridTemplateColumns,tableMinimum:table?getComputedStyle(table).minWidth:null,wrap:wrap?{...rect(wrap),client:wrap.clientWidth,scroll:wrap.scrollWidth,left:wrap.scrollLeft}:null,actions,headings};
};
