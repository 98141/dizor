"use strict";
const fs=require('node:fs'),path=require('node:path');
const audit=path.resolve(__dirname,'..');
function dest(file){
 if(typeof file!=='string')return file;
 const absolute=path.resolve(file),relative=path.relative(audit,absolute),own=path.relative(__dirname,absolute);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||(!own.startsWith('..')&&!path.isAbsolute(own)))return file;
 const target=path.join(__dirname,'regresion',relative);fs.mkdirSync(path.dirname(target),{recursive:true});return target;
}
const write=fs.writeFileSync.bind(fs),asyncWrite=fs.promises.writeFile.bind(fs.promises),open=fs.openSync.bind(fs),unlink=fs.unlinkSync.bind(fs),append=fs.appendFileSync.bind(fs);
fs.writeFileSync=(file,...args)=>write(dest(file),...args);
fs.promises.writeFile=(file,...args)=>asyncWrite(dest(file),...args);
fs.openSync=(file,flags,...args)=>open(typeof flags==='string'&&/[wa+]/.test(flags)?dest(file):file,flags,...args);
fs.appendFileSync=(file,...args)=>append(dest(file),...args);
fs.unlinkSync=file=>{const target=dest(file);if(target!==file&&!fs.existsSync(target))return;return unlink(target);};
