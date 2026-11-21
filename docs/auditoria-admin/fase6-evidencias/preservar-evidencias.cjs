"use strict";
const fs=require('node:fs'),path=require('node:path');
const audit=path.resolve(__dirname,'..');
const write=fs.writeFileSync.bind(fs),asyncWrite=fs.promises.writeFile.bind(fs.promises),unlink=fs.unlinkSync.bind(fs);
function remap(file){
 if(typeof file!=='string')return file;
 const absolute=path.resolve(file),relative=path.relative(audit,absolute);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||relative.startsWith('fase6-evidencias'+path.sep))return file;
 const target=path.join(__dirname,'regresion',relative);fs.mkdirSync(path.dirname(target),{recursive:true});return target;
}
fs.writeFileSync=(file,...args)=>write(remap(file),...args);
fs.promises.writeFile=(file,...args)=>asyncWrite(remap(file),...args);
fs.unlinkSync=file=>{const target=remap(file);if(target!==file&&!fs.existsSync(target))return;return unlink(target);};
