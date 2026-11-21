"use strict";
const fs=require('node:fs'),path=require('node:path');
const sharp=require('../../../frontend/node_modules/sharp');
const out=__dirname;
(async()=>{
 const screens=JSON.parse(fs.readFileSync(path.join(out,'despues/pantallas.json'))).filter(x=>x.width===360);
 for(const width of [1440,360])for(let part=0;part<4;part++){
  const selected=screens.slice(part*9,(part+1)*9),tileW=width===360?270:480,tileH=width===360?675:300,items=[];
  for(let i=0;i<selected.length;i++)items.push({input:await sharp(path.join(out,'despues',`${selected[i].name}-${width}.png`)).resize(tileW,tileH).toBuffer(),left:i%3*tileW,top:Math.floor(i/3)*tileH});
  await sharp({create:{width:tileW*3,height:tileH*Math.ceil(selected.length/3),channels:3,background:'#eee'}}).composite(items).png().toFile(path.join(out,`despues-${width}-contacto-${part+1}.png`));
 }
 console.log('8 contactos generados para revisión visual de las 33 vistas.');
})().catch(error=>{console.error(error);process.exitCode=1;});
