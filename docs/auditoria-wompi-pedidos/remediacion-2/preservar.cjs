// New output destinations only; historical sources and assertions stay unchanged.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),own=__dirname;
const out=path.join(own,'evidencias',process.env.REMEDIATION2_RUN || 'sin-nombre');
for(const name of ['writeFileSync','appendFileSync']){
  const original=fs[name];
  fs[name]=function(file,...args){
    if(typeof file==='string'){
      const absolute=path.resolve(file);
      if(absolute.startsWith(path.join(root,'docs')+path.sep)&&!absolute.startsWith(own+path.sep)){
        file=path.join(out,path.relative(root,absolute));fs.mkdirSync(path.dirname(file),{recursive:true});
      }
    }
    return original.call(this,file,...args);
  };
}
